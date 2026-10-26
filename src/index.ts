// src/index.ts — router + cabeceras de seguridad + try/catch global (A10)
import type { Env } from "./env";
import { conCabeceras } from "./http/cabeceras";
import { json } from "./http/util";
import { depsDesdeEnv, preguntar } from "./handlers/pregunta";
export { Contador } from "./contadores/contador";

async function enrutar(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  if (url.hostname === "www.webninja.fyi") {
    url.hostname = "webninja.fyi";
    return Response.redirect(url.toString(), 301);
  }
  if (url.pathname === "/api/pregunta") {
    if (request.method !== "POST") return json({ error: "metodo" }, 405, { allow: "POST" });
    return preguntar(request, depsDesdeEnv(env), (p) => ctx.waitUntil(p));
  }
  if (url.pathname.startsWith("/api/")) return json({ error: "no_existe" }, 404);
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return conCabeceras(await enrutar(request, env, ctx));
    } catch (err) {
      console.error(JSON.stringify({ evento: "error_no_controlado", mensaje: String(err) }));
      return conCabeceras(json({ error: "mantenimiento", mensaje: "El portfolio está en obras. Vuelve en un rato" }, 503));
    }
  },
} satisfies ExportedHandler<Env>;
