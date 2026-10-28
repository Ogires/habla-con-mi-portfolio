// Utilidades de texto puras: normalizado para comparar y términos para FTS5 y el respaldo de citas

// Rango de diacríticos combinantes escrito con escapes (no con los caracteres literales) para que
// ningún editor ni heredoc lo corrompa
const DIACRITICOS = /[̀-ͯ]/g;

export function normalizarTexto(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(DIACRITICOS, "").normalize("NFC");
}

// "sergio" es stopword: aparece en casi todo el corpus y no discrimina
const STOPWORDS = new Set(
  (
    "que los las del con por para una uno unos unas como mas pero sus este esta esto estos estas ese esa eso " +
    "hay han fue ser son sobre entre sin tambien muy cuando donde quien cual cuales porque usa uso usar usado " +
    "hace hizo hecho tiene tienen puede sabe algo todo nada ella ellos aqui alli asi cada otro otra " +
    "sergio ogires the and for with that this what which does did has have his are was how from about your you " +
    // De 2 letras: el resto (D1, KV, IA, JS, Go...) son siglas que importan en un portfolio técnico
    "de la el en es un lo se al su ha he me mi tu te le si no ya yo ni os va ve da di " +
    "is it in on of to an as at be by do if my or so up us we am"
  ).split(" ")
);

export function terminosSignificativos(s: string): string[] {
  const tokens = normalizarTexto(s).match(/[\p{L}\p{N}]+/gu) ?? [];
  return [...new Set(tokens.filter((t) => t.length >= 2 && !STOPWORDS.has(t)))];
}

export const recortar = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s).trim();
