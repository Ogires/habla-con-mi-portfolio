// src/http/util.ts — utilidades HTTP compartidas
export function json(datos: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(datos, { status, headers: { "cache-control": "no-store", ...extra } });
}

const MAX_CUERPO = 4_096;

// Sin content-length (chunked), request.text() leería el cuerpo entero antes de poder medirlo
async function leerConTope(cuerpo: ReadableStream<Uint8Array> | null, max: number): Promise<string | null> {
  if (!cuerpo) return "";
  const lector = cuerpo.getReader();
  const trozos: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await lector.cancel();
      return null;
    }
    trozos.push(value);
  }
  const todo = new Uint8Array(total);
  let i = 0;
  for (const t of trozos) {
    todo.set(t, i);
    i += t.byteLength;
  }
  return new TextDecoder().decode(todo);
}

// A05: JSON con tamaño máximo (en bytes leídos) y forma (objeto plano) validada a mano
export async function leerJson(request: Request): Promise<Record<string, unknown> | null> {
  if (Number(request.headers.get("content-length") ?? "0") > MAX_CUERPO) return null;
  const texto = await leerConTope(request.body, MAX_CUERPO);
  if (texto === null) return null;
  try {
    const v = JSON.parse(texto);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

// CSRF: sin esto, cualquier web (o un subdominio de webninja.fyi) podría gastar la cuota de IA desde
// el navegador de sus visitantes con un fetch "simple" en text/plain. application/json obliga al
// preflight de CORS, que nadie aprueba, y Origin y Sec-Fetch-Site delatan a las demás webs
export function rechazoCsrf(request: Request): Response | null {
  const tipo = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (tipo !== "application/json") return json({ error: "tipo" }, 415);
  const origen = request.headers.get("origin");
  const sitio = request.headers.get("sec-fetch-site");
  if ((origen && origen !== new URL(request.url).origin) || (sitio && sitio !== "same-origin" && sitio !== "none")) {
    return json({ error: "origen" }, 403);
  }
  return null;
}

export const ip = (request: Request) => request.headers.get("cf-connecting-ip") ?? "0.0.0.0";
