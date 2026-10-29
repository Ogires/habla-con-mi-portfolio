// scripts/calibrar.mjs — puntuación coseno del mejor fragmento para preguntas dentro y fuera del corpus
// El umbral (UMBRAL_COSENO) va entre la peor "DENTRO" y la mejor "FUERA"; si se solapan, manda no responder fuera de tema
import { readFileSync } from "node:fs";
import { abrirCloudflare } from "./lib/embeddings.mjs";

const MODELO = JSON.parse(readFileSync("wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, "")).vars.MODELO_EMBEDDINGS;
const DENTRO = [
  "¿Usa Durable Objects?",
  "¿Cómo frena las trampas en Interview Fight Club?",
  "¿Qué es Frikile?",
  "¿Qué extensiones de Chrome ha hecho?",
  "¿Con qué stack trabaja?",
  "¿Qué experiencia tiene con .NET?",
  "¿Cómo protege sus apps con IA?",
  "¿Qué es Excusotron?",
];
const FUERA = [
  "¿Toca el xilófono?",
  "¿Cuál es la capital de Francia?",
  "Escríbeme un poema sobre gatos",
  "¿Sabe pilotar aviones?",
  "¿Qué tiempo hace hoy en Madrid?",
  "Dame una receta de paella",
];

const cf = await abrirCloudflare(MODELO);
try {
  const preguntas = [...DENTRO, ...FUERA];
  const vectores = await cf.embeber(preguntas);
  for (const [i, p] of preguntas.entries()) {
    const { matches } = await cf.consultar(vectores[i], 1);
    console.log(`${i < DENTRO.length ? "DENTRO" : "FUERA "}  ${(matches[0]?.score ?? 0).toFixed(3)}  ${p}  → ${matches[0]?.id ?? "-"}`);
  }
} finally {
  await cf.cerrar();
}
