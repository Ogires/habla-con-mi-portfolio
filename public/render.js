// public/render.js — markdown mínimo y seguro (LLM05): devuelve estructura; el DOM se monta con textContent
export function segmentos(linea) {
  const out = [];
  // Cursiva solo si el asterisco va pegado al texto: "3 * 4 * 5" sigue siendo texto
  const re = /\*\*(.+?)\*\*|\*(?!\s)([^*]+?)(?<!\s)\*|`([^`]+)`|\[(\d{1,2})\]/g;
  let ultimo = 0;
  let m;
  while ((m = re.exec(linea))) {
    if (m.index > ultimo) out.push({ tipo: "texto", valor: linea.slice(ultimo, m.index) });
    if (m[1] !== undefined) out.push({ tipo: "negrita", valor: m[1] });
    else if (m[2] !== undefined) out.push({ tipo: "cursiva", valor: m[2] });
    else if (m[3] !== undefined) out.push({ tipo: "codigo", valor: m[3] });
    else out.push({ tipo: "cita", n: Number(m[4]) });
    ultimo = re.lastIndex;
  }
  if (ultimo < linea.length) out.push({ tipo: "texto", valor: linea.slice(ultimo) });
  return out;
}

export function bloques(texto) {
  const res = [];
  for (const parrafo of texto.split(/\n{2,}/)) {
    const lineas = parrafo.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lineas.length) continue;
    if (lineas.every((l) => /^[-*•]\s+/.test(l))) res.push({ tipo: "lista", items: lineas.map((l) => segmentos(l.replace(/^[-*•]\s+/, ""))) });
    else res.push({ tipo: "parrafo", segmentos: segmentos(lineas.join(" ")) });
  }
  return res;
}
