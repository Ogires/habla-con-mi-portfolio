// Validación de la entrada de /api/pregunta: pregunta + historial corto (§6 del diseño)
import { recortar } from "./texto";

export const MAX_PREGUNTA = 400;
export const MAX_TURNO = 300;

export interface Turno {
  p: string;
  r: string;
}

export interface Entrada {
  pregunta: string;
  historial: Turno[];
}

// La pregunta va al prompt como DATO: fuera controles y cualquier etiqueta del delimitador.
// Los controles que son espacio (\t \n \v \f \r) no se borran: los colapsa \s+ para no pegar palabras
function limpiar(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000E-\u001F\u007F]/g, "")
    .replace(/<\/?\s*fragmentos[^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function validarEntrada(cuerpo: Record<string, unknown> | null): Entrada | null {
  if (!cuerpo || typeof cuerpo.pregunta !== "string") return null;
  const pregunta = limpiar(cuerpo.pregunta);
  if (pregunta.length < 3 || pregunta.length > MAX_PREGUNTA) return null;
  const crudo = cuerpo.historial ?? [];
  if (!Array.isArray(crudo) || crudo.length > 2) return null;
  const historial: Turno[] = [];
  for (const t of crudo) {
    if (!t || typeof t !== "object" || typeof t.p !== "string" || typeof t.r !== "string") return null;
    historial.push({ p: recortar(limpiar(t.p), MAX_TURNO), r: recortar(limpiar(t.r), MAX_TURNO) });
  }
  return { pregunta, historial };
}
