// src/handlers/pregunta.ts — §3.2 del diseño
import type { Env } from "../env";
import { analizarCitas } from "../dominio/citas";
import { construirMensajes, nuevoNonce } from "../dominio/prompt";
import { esPreguntaPrivada, RESPUESTAS } from "../dominio/respuestas";
import { recortar } from "../dominio/texto";
import { validarEntrada } from "../dominio/validacion";
import { recuperadorCloudflare, recuperar, type Recuperador } from "../busqueda/recuperador";
import { contarPregunta, cupoIa, limitar, sumarTokens } from "../contadores/uso";
import { construirCadena, depsCadena, primeraRespuesta, type DepsCadena } from "../ia/cadena";
import type { LlmProvider } from "../ia/proveedor";
import { CABECERAS_SSE, streamRespuesta, type Esperar, type FinRespuesta, type FuenteEvento } from "../ia/stream";
import { leerFragmentos } from "../repos/fragmentos";
import { claveCliente, json, leerJson } from "../http/util";

const MAX_TOKENS = 700;
const MAX_FUENTES = 5;

export interface DepsPregunta {
  db: D1Database;
  recuperador: Recuperador;
  proveedores: LlmProvider[];
  cadena: DepsCadena;
  umbral: number;
  limitar(clave: string): Promise<{ permitido: boolean; retryAfter: number }>;
  cupoIa(clave: string): Promise<{ permitido: boolean; retryAfter: number }>;
  sumarTokens(modelo: string, n: number): Promise<unknown>;
  contarPregunta(): Promise<unknown>;
}

export function depsDesdeEnv(env: Env): DepsPregunta {
  return {
    db: env.DB,
    recuperador: recuperadorCloudflare(env),
    proveedores: construirCadena(env),
    cadena: depsCadena(env),
    umbral: Number(env.UMBRAL_COSENO),
    limitar: (clave) => limitar(env, clave),
    cupoIa: (clave) => cupoIa(env, clave),
    sumarTokens: (modelo, n) => sumarTokens(env, modelo, n),
    contarPregunta: () => contarPregunta(env),
  };
}

const finSimple = (o: Partial<FinRespuesta> = {}): FinRespuesta => ({
  modelo: null,
  degradado: false,
  sinFuente: false,
  citasDudosas: [],
  citasInvalidas: [],
  ...o,
});

const sse = (cuerpo: ReadableStream<Uint8Array>) => new Response(cuerpo, { headers: CABECERAS_SSE });

const fija = (texto: string, fuentes: FuenteEvento[] = [], fin: Partial<FinRespuesta> = {}) =>
  sse(streamRespuesta({ fuentes, textoFijo: texto, alTerminar: async () => finSimple(fin) }));

// Solo gasta cupo lo que de verdad va a llamar a Groq. Si el contador no responde, sin IA (fail-closed)
async function hayCupoIa(deps: DepsPregunta, cliente: string): Promise<boolean> {
  if (!deps.proveedores.length) return true;
  try {
    return (await deps.cupoIa(cliente)).permitido;
  } catch (err) {
    console.error(JSON.stringify({ evento: "cupo_ilegible", error: String(err) }));
    return false;
  }
}

export async function preguntar(request: Request, deps: DepsPregunta, esperar?: Esperar): Promise<Response> {
  const entrada = validarEntrada(await leerJson(request));
  if (!entrada) return json({ error: "validacion", mensaje: RESPUESTAS.validacion }, 400);

  const cliente = claveCliente(request);
  const rl = await deps.limitar(cliente);
  if (!rl.permitido) return json({ error: "limite", mensaje: RESPUESTAS.limite, retryAfter: rl.retryAfter }, 429, { "retry-after": String(rl.retryAfter) });
  esperar?.(deps.contarPregunta().catch(() => {}));

  if (esPreguntaPrivada(entrada.pregunta)) return fija(RESPUESTAS.privada);

  // Una pregunta privada anterior tampoco entra por la puerta de atrás (búsqueda o prompt)
  const historial = entrada.historial.filter((t) => !esPreguntaPrivada(t.p));
  // Seguimientos ("¿y en esa?"): el embedding lleva también la pregunta anterior
  const consulta = [historial.at(-1)?.p, entrada.pregunta].filter(Boolean).join("\n");
  const fusion = await recuperar(deps.recuperador, consulta, entrada.pregunta, deps.umbral);
  const fragmentos = (await leerFragmentos(deps.db, fusion.map((f) => f.id))).slice(0, MAX_FUENTES);
  if (!fragmentos.length) return fija(RESPUESTAS.sinFuentes);

  const origenDe = new Map(fusion.map((f) => [f.id, f.origen]));
  const fuentes: FuenteEvento[] = fragmentos.map((f, i) => ({
    n: i + 1,
    titulo: f.titulo,
    url: f.url,
    tipo: f.tipo,
    extracto: recortar(f.texto, 240),
    origen: origenDe.get(f.id) ?? "texto",
  }));
  const paraPrompt = fragmentos.map((f, i) => ({ n: i + 1, titulo: f.titulo, texto: f.texto }));
  const mensajes = construirMensajes({ pregunta: entrada.pregunta, historial, fragmentos: paraPrompt, nonce: nuevoNonce() });

  if (!(await hayCupoIa(deps, cliente))) return fija(RESPUESTAS.cupo, fuentes, { degradado: true });
  const r = await primeraRespuesta(deps.proveedores, { mensajes, maxTokens: MAX_TOKENS }, deps.cadena);
  if (!r) return fija(RESPUESTAS.degradado, fuentes, { degradado: true });

  return sse(
    streamRespuesta({
      fuentes,
      upstream: r.respuesta.body!,
      textoFijo: RESPUESTAS.vacia,
      esperar,
      alTerminar: async ({ texto, tokens }) => {
        const gastados = tokens ?? Math.ceil((JSON.stringify(mensajes).length + texto.length) / 4);
        await deps.sumarTokens(r.proveedor.id, gastados).catch((err) => console.error(JSON.stringify({ evento: "presupuesto_no_sumado", error: String(err) })));
        console.log(JSON.stringify({ evento: "pregunta", modelo: r.proveedor.id, tokens: gastados })); // Tarea 16: medir tokens con wrangler tail
        const a = analizarCitas(texto, paraPrompt);
        return finSimple({ modelo: r.proveedor.id, sinFuente: a.sinFuente, citasDudosas: a.dudosas, citasInvalidas: a.fueraDeRango });
      },
    })
  );
}
