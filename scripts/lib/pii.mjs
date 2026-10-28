// scripts/lib/pii.mjs — §5.1: si aparece un dato personal, la ingesta aborta (sin mostrar el dato)
// Todos los patrones son lineales: cada repetición consume una cifra o letra y el separador opcional
// nunca es una cifra, así que no hay repartos ambiguos (ReDoS)
const PATRONES = [
  ["email", /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[a-z]{2,}/giu],
  // Ofuscados: "nombre [at] dominio", "nombre(at)dominio.com", "nombre arroba dominio punto com",
  // "nombre at dominio dot com". El "at" inglés suelto exige "dot": "deployed at Cloudflare." no salta
  [
    "email",
    /(?<![\p{L}\p{N}])[\p{L}\p{N}._%+-]+\s?(?:[\[({]\s?(?:at|arroba)\s?[\])}]\s?[\p{L}\p{N}]|\sarroba\s[\p{L}\p{N}-]+(?:\.|\s(?:dot|punto)\s)[a-z]{2,}|\sat\s[\p{L}\p{N}-]+\s(?:dot|punto)\s[a-z]{2,})/giu,
  ],
  // 9 cifras con separador opcional entre cualquiera de ellas: 612 345 678, 612 34 56 78, 612-34-56-78…
  ["teléfono", /(?<![\p{L}\p{N}-])(?:\+\d{2,3}[\s.-]?)?[6789](?:[\s.-]?\d){8}(?![\p{L}\p{N}-])/gu],
  // Internacional con + o 00, también con paréntesis: +44 20 7946 0958, (+34) 612…, +1 (415) 555-0132
  ["teléfono", /(?<![\p{L}\p{N}+])(?:\+|00)[1-9]\d{0,2}(?:[\s.()-]{0,2}\d){7,12}(?![\p{L}\p{N}])/gu],
  // DNI (8 cifras, con puntos opcionales) o NIE (X/Y/Z + 7). Letra mayúscula, o minúscula sin espacio
  // delante para no confundir "1234567 y" con un DNI
  ["DNI/NIE", /(?<![\p{L}\p{N}])(?:[XYZxyz][\s-]?\d{7}|\d{1,2}\.?\d{3}\.?\d{3})(?:[\s.-]?[A-Z]|-?[a-z])(?![\p{L}\p{N}])/gu],
  ["IBAN", /(?<![\p{L}\p{N}])[A-Za-z]{2}\d{2}(?:[\s-]?\d){12,30}(?![\p{L}\p{N}])/gu],
  ["dirección", /(?<![\p{L}])(?:calle|c\/|avenida|avda\.?|plaza|paseo|camino)\s+[^\n,]{2,40},?\s*\d{1,4}[^\n]*?\b\d{5}\b/giu],
];

// Un hallazgo por línea y tipo: "(+34) 612 345 678" casa con los dos patrones de teléfono
export function buscarDatosPersonales(texto, permitidos = []) {
  const permitidosMin = permitidos.map((p) => p.toLowerCase());
  const hallazgos = [];
  const vistos = new Set();
  texto.split(/\r?\n/).forEach((linea, i) => {
    for (const [tipo, re] of PATRONES) {
      for (const m of linea.matchAll(re)) {
        if (permitidosMin.includes(m[0].toLowerCase()) || vistos.has(`${i}:${tipo}`)) continue;
        vistos.add(`${i}:${tipo}`);
        hallazgos.push({ linea: i + 1, tipo });
      }
    }
  });
  return hallazgos;
}
