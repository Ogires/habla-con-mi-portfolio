// src/busqueda/recuperador.ts — puerto de búsqueda + adaptador Cloudflare (Workers AI + Vectorize + FTS5)
import type { Env } from "../env";
import { filtrarPorUmbral, fusionarRrf, type Coincidencia, type Fusionado } from "../dominio/fusion";
import { buscarTexto } from "../repos/fragmentos";

export interface Recuperador {
  vector(consulta: string): Promise<Coincidencia[]>;
  texto(pregunta: string): Promise<string[]>;
}

export function recuperadorCloudflare(env: Env): Recuperador {
  return {
    async vector(consulta) {
      if (!env.AI || !env.VECTORIZE) throw new Error("sin bindings de IA");
      const r = (await env.AI.run(env.MODELO_EMBEDDINGS as Parameters<Ai["run"]>[0], { text: [consulta] })) as { data?: number[][] };
      const v = r.data?.[0];
      if (!v) throw new Error("embedding vacío");
      const { matches } = await env.VECTORIZE.query(v, { topK: 8 });
      return matches.map((m) => ({ id: m.id, score: m.score }));
    },
    texto: (pregunta) => buscarTexto(env.DB, pregunta),
  };
}

// Todos los candidatos (hasta 8 + 8), no el top 5: un vector huérfano (fragmento ya borrado de D1)
// ocuparía una plaza. El handler se queda con los 5 primeros que sí existen en D1
const CANDIDATOS = 16;

export async function recuperar(r: Recuperador, consulta: string, pregunta: string, umbral: number): Promise<Fusionado[]> {
  const [v, t] = await Promise.allSettled([r.vector(consulta), r.texto(pregunta)]);
  if (v.status === "rejected") console.log(JSON.stringify({ evento: "vector_degradado", error: String(v.reason) }));
  if (t.status === "rejected") console.log(JSON.stringify({ evento: "fts_fallo", error: String(t.reason) }));
  return fusionarRrf(v.status === "fulfilled" ? filtrarPorUmbral(v.value, umbral) : [], t.status === "fulfilled" ? t.value : [], CANDIDATOS);
}
