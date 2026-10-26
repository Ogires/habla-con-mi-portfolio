// scripts/lib/embeddings.mjs — embeddings y Vectorize desde local con el login de wrangler
// Vía elegida en la Tarea 0: getPlatformProxy con "remote": true en los bindings ai y vectorize
import { getPlatformProxy } from "wrangler";

const LOTE = 20;

export async function abrirCloudflare(modelo, configPath = "wrangler.jsonc") {
  const { env, dispose } = await getPlatformProxy({ configPath });
  return {
    async embeber(textos) {
      const out = [];
      for (let i = 0; i < textos.length; i += LOTE) {
        const r = await env.AI.run(modelo, { text: textos.slice(i, i + LOTE) });
        out.push(...r.data);
      }
      if (out.length !== textos.length) throw new Error(`embeber: ${textos.length} textos y ${out.length} vectores`);
      return out;
    },
    consultar: (vector, topK) => env.VECTORIZE.query(vector, { topK }),
    cerrar: dispose,
  };
}
