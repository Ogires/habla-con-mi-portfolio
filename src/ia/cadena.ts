// src/ia/cadena.ts — failover entre modelos + disyuntor (KV) + presupuesto de tokens (DO)
import type { Env } from "../env";
import { tokensUsados } from "../contadores/uso";
import { proveedorGroq, type LlmProvider, type PeticionLlm } from "./proveedor";

export interface DepsCadena {
  kv: KVNamespace;
  cuota: number; // tokens/día por modelo
  leerTokens(modelo: string): Promise<number>;
}

const TIMEOUT_PRIMER_BYTE_MS = 8_000;
const UMBRAL_PRESUPUESTO = 0.9;

function log(evento: string, datos: Record<string, unknown>): void {
  console.log(JSON.stringify({ evento, ...datos }));
}

async function abrirDisyuntor(kv: KVNamespace, id: string, retryAfter: string | null): Promise<void> {
  const segundos = Math.max(60, parseInt(retryAfter ?? "", 10) || 60); // TTL mínimo de KV: 60 s
  await kv.put(`caido:${id}`, "1", { expirationTtl: segundos });
  log("disyuntor_abierto", { modelo: id, segundos });
}

// Si KV no responde, el disyuntor se da por cerrado: lo que de verdad pone el límite es el
// presupuesto del DO, y una caída de KV no debe tumbar la respuesta con un 503
async function disyuntorAbierto(kv: KVNamespace, id: string): Promise<boolean> {
  try {
    return (await kv.get(`caido:${id}`)) !== null;
  } catch (err) {
    log("disyuntor_ilegible", { modelo: id, error: String(err) });
    return false;
  }
}

// Chain of Responsibility: el primer modelo con cuota que responda. null = modo degradado
export async function primeraRespuesta(
  proveedores: LlmProvider[],
  peticion: PeticionLlm,
  deps: DepsCadena
): Promise<{ proveedor: LlmProvider; respuesta: Response } | null> {
  for (const prov of proveedores) {
    if (await disyuntorAbierto(deps.kv, prov.id)) continue;
    let usados: number;
    try {
      usados = await deps.leerTokens(prov.id);
    } catch {
      log("presupuesto_ilegible", { modelo: prov.id });
      return null; // fail-closed: sin contador, nunca IA sin límite
    }
    if (usados >= deps.cuota * UMBRAL_PRESUPUESTO) {
      log("presupuesto_agotado", { modelo: prov.id, usados });
      continue;
    }
    // El timeout solo cubre hasta las cabeceras: abortar después cortaría el stream
    const control = new AbortController();
    const temporizador = setTimeout(() => control.abort(), TIMEOUT_PRIMER_BYTE_MS);
    try {
      const respuesta = await prov.llamar(peticion, control.signal);
      if (respuesta.ok && respuesta.body) return { proveedor: prov, respuesta };
      if (respuesta.status === 429) await abrirDisyuntor(deps.kv, prov.id, respuesta.headers.get("retry-after"));
      log("proveedor_fallback", { modelo: prov.id, status: respuesta.status });
    } catch (err) {
      log("proveedor_fallback", { modelo: prov.id, error: String(err) });
    } finally {
      clearTimeout(temporizador);
    }
  }
  return null;
}

export function construirCadena(env: Env): LlmProvider[] {
  const apiKey = env.GROQ_API_KEY;
  if (!apiKey) return [];
  return [env.GROQ_MODEL, env.GROQ_MODEL_RESERVA_1, env.GROQ_MODEL_RESERVA_2]
    .filter(Boolean)
    .map((m) => proveedorGroq(apiKey, m));
}

// Una cuota ilegible sería NaN, y `usados >= NaN` nunca se cumple: IA sin límite. Mejor 0 (fail-closed)
export function depsCadena(env: Env): DepsCadena {
  const cuota = parseInt(env.CUOTA_TOKENS_DIA, 10);
  return { kv: env.KV, cuota: Number.isFinite(cuota) && cuota > 0 ? cuota : 0, leerTokens: (m) => tokensUsados(env, m) };
}
