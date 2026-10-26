// src/http/util.ts — utilidades HTTP compartidas
export function json(datos: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(datos, { status, headers: { "cache-control": "no-store", ...extra } });
}

const MAX_CUERPO = 4_096;

// A05: JSON con tamaño máximo y forma (objeto plano) validada a mano
export async function leerJson(request: Request): Promise<Record<string, unknown> | null> {
  const declarado = Number(request.headers.get("content-length") ?? "0");
  if (declarado > MAX_CUERPO) return null;
  const texto = await request.text();
  if (texto.length > MAX_CUERPO) return null;
  try {
    const v = JSON.parse(texto);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

export const ip = (request: Request) => request.headers.get("cf-connecting-ip") ?? "0.0.0.0";
