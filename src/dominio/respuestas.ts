// Textos fijos (§6.2 del diseño)
import { normalizarTexto } from "./texto";

export const FRASE_NO_APARECE = "Eso no aparece en el portfolio de Sergio.";

export const RESPUESTAS = {
  sinFuentes: `${FRASE_NO_APARECE} Puedes preguntárselo directamente por LinkedIn.`,
  privada: "Eso pregúntaselo a Sergio por LinkedIn.",
  degradado: "Mi cerebro de IA está de descanso, pero esto es lo que he encontrado en el portfolio:",
  vacia: "No he sabido responder a eso. Prueba a reformular la pregunta.",
  limite: "Demasiadas preguntas seguidas. Espera un minuto.",
  validacion: "La pregunta debe tener entre 3 y 400 caracteres.",
} as const;

// Se comprueba ANTES de llamar a Groq: ni siquiera se gastan tokens (LLM02)
const PRIVADO =
  /(?<![\p{L}])(salario|sueldo|cobra|cobrar|tarifa|direccion|domicilio|donde vive|telefono|movil|whatsapp|edad|cuantos anos|nacimiento|dni|disponible|disponibilidad|salary|address|phone|age)(?![\p{L}])/u;

export const esPreguntaPrivada = (pregunta: string) => PRIVADO.test(normalizarTexto(pregunta));
