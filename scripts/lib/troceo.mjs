// scripts/lib/troceo.mjs — markdown → fragmentos de ~300 palabras (§4.4 del diseño)
export const PALABRAS = 300;
export const SOLAPE = 50;
export const MINIMO = 40;

// Anclaje de GitHub: minúsculas, fuera la puntuación (salvo - y _), espacios → guiones
export function slugGithub(titulo) {
  return titulo.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
}

export function secciones(md) {
  const out = [];
  let actual = { titulo: "", lineas: [] };
  let enCodigo = false;
  for (const linea of md.split(/\r?\n/)) {
    if (/^\s*```/.test(linea)) enCodigo = !enCodigo;
    const m = enCodigo ? null : /^(#{1,4})\s+(.+?)\s*#*\s*$/.exec(linea);
    if (m) {
      if (actual.lineas.join("").trim()) out.push(actual);
      actual = { titulo: m[2], lineas: [] };
      continue;
    }
    actual.lineas.push(linea);
  }
  if (actual.lineas.join("").trim()) out.push(actual);
  return out.map((s) => ({ titulo: s.titulo, texto: s.lineas.join("\n").trim() }));
}

const contar = (s) => s.split(/\s+/).filter(Boolean).length;

export function trocear(md, { palabras = PALABRAS, solape = SOLAPE, minimo = MINIMO } = {}) {
  const res = [];
  let pendiente = null;
  for (const s of secciones(md)) {
    const sec = pendiente ? { titulo: pendiente.titulo, texto: `${pendiente.texto}\n\n${s.texto}` } : s;
    if (contar(sec.texto) < minimo) {
      pendiente = sec;
      continue;
    }
    pendiente = null;
    const ps = sec.texto.split(/\s+/).filter(Boolean);
    for (let i = 0; i < ps.length; i += palabras - solape) {
      res.push({ titulo: sec.titulo, texto: ps.slice(i, i + palabras).join(" ") });
      if (i + palabras >= ps.length) break;
    }
  }
  if (pendiente) res.push(pendiente);
  return res;
}
