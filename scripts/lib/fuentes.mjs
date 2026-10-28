// scripts/lib/fuentes.mjs — extracción de fuentes e ingesta incremental
import { VERSION_TROCEO } from "./troceo.mjs";

// De las guías de LinkedIn SOLO el post: las instrucciones del agente serían ruido y vía de inyección
export function extraerPost(guia) {
  const i = guia.search(/^#{2,4}[^\n]*\bel post\b/im);
  if (i < 0) return null;
  const m = /```[^\n]*\n([\s\S]*?)\n```/.exec(guia.slice(i));
  return m ? m[1].trim() : null;
}

// Del perfil, solo las secciones públicas (fuera "Open to Work", "Pendiente"...). Una sección
// incluida arrastra sus subsecciones (los ### de "Proyectos") hasta el siguiente encabezado de su nivel
export function filtrarSecciones(md, incluir) {
  const out = [];
  let nivelIncluido = 0; // 0 = fuera
  for (const bloque of md.split(/\r?\n(?=#{1,4}\s)/)) {
    const m = /^(#{1,4})\s+(.+)$/m.exec(bloque);
    const nivel = m && bloque.startsWith("#") ? m[1].length : 0;
    if (nivel && nivelIncluido && nivel > nivelIncluido) {
      out.push(bloque.trim());
      continue;
    }
    nivelIncluido = nivel && incluir.some((x) => m[2].includes(x)) ? nivel : 0;
    if (nivelIncluido) out.push(bloque.trim());
  }
  return out.join("\n\n");
}

export async function sha256(texto) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// El hash cubre todo lo que acaba en los fragmentos, no solo el texto: si no, cambiar un título en
// data/fuentes.json, una URL o el troceo no reindexaría nada
export function hashFuente(f) {
  return sha256(JSON.stringify([VERSION_TROCEO, f.tipo, f.titulo, f.url, f.anclar ?? false, f.minimo ?? null, f.texto]));
}

// Dos fuentes con el mismo id se pisarían en D1 (y la segunda borraría los fragmentos de la primera)
export function idsRepetidos(fuentes) {
  const vistos = new Set();
  const repetidos = new Set();
  for (const { id } of fuentes) (vistos.has(id) ? repetidos : vistos).add(id);
  return [...repetidos];
}

// Vectorize admite ids de hasta 64 bytes: hash corto de la fuente + orden
export async function idFragmento(fuenteId, orden) {
  return `${(await sha256(fuenteId)).slice(0, 16)}-${orden}`;
}

export function planificar(antes, ahora) {
  const r = { nuevas: [], cambiadas: [], borradas: [], iguales: [] };
  for (const [id, h] of ahora) {
    if (!antes.has(id)) r.nuevas.push(id);
    else if (antes.get(id) !== h) r.cambiadas.push(id);
    else r.iguales.push(id);
  }
  for (const id of antes.keys()) if (!ahora.has(id)) r.borradas.push(id);
  return r;
}
