// scripts/lib/pii.mjs — §5.1: si aparece un dato personal, la ingesta aborta (sin mostrar el dato)
const PATRONES = [
  ["email", /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[a-z]{2,}/giu],
  // 9 cifras con separador opcional entre cualquiera de ellas: 612 345 678, 612 34 56 78, 612-34-56-78…
  ["teléfono", /(?<![\p{L}\p{N}-])(?:\+\d{2,3}[\s.-]?)?[6789](?:[\s.-]?\d){8}(?![\p{L}\p{N}-])/gu],
  ["DNI/NIE", /(?<![\p{L}\p{N}])[XYZ]?\d{7,8}[\s-]?[A-Z](?![\p{L}\p{N}])/gu],
  ["IBAN", /(?<![\p{L}\p{N}])[A-Z]{2}\d{2}(?:\s?\d{4}){4,7}(?![\p{L}\p{N}])/gu],
  ["dirección", /(?<![\p{L}])(?:calle|c\/|avenida|avda\.?|plaza|paseo|camino)\s+[^\n,]{2,40},?\s*\d{1,4}[^\n]*?\b\d{5}\b/giu],
];

export function buscarDatosPersonales(texto, permitidos = []) {
  const permitidosMin = permitidos.map((p) => p.toLowerCase());
  const hallazgos = [];
  texto.split(/\r?\n/).forEach((linea, i) => {
    for (const [tipo, re] of PATRONES) {
      for (const m of linea.matchAll(re)) {
        if (permitidosMin.includes(m[0].toLowerCase())) continue;
        hallazgos.push({ linea: i + 1, tipo });
      }
    }
  });
  return hallazgos;
}
