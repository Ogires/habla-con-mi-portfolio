// Textos fijos (§6.2 del diseño)
import { normalizarTexto } from "./texto";

export const FRASE_NO_APARECE = "Eso no aparece en el portfolio de Sergio.";

export const RESPUESTAS = {
  sinFuentes: `${FRASE_NO_APARECE} Puedes preguntárselo directamente por LinkedIn.`,
  privada: "Eso pregúntaselo a Sergio por LinkedIn.",
  degradado: "Mi cerebro de IA está de descanso, pero esto es lo que he encontrado en el portfolio:",
  cupo: "Por hoy ya has gastado tus preguntas con IA, pero esto es lo que he encontrado en el portfolio:",
  vacia: "No he sabido responder a eso. Prueba a reformular la pregunta.",
  limite: "Demasiadas preguntas seguidas. Espera un minuto.",
  validacion: "La pregunta debe tener entre 3 y 400 caracteres.",
} as const;

// Se comprueba ANTES de llamar a Groq: ni siquiera se gastan tokens (LLM02). Sobre el texto
// normalizado (minúsculas, sin tildes). Las palabras ambiguas ("disponible", "móvil", "dirección",
// "tarifa", "address") solo cuentan en la construcción que habla de Sergio: sueltas daban falsos
// positivos como "¿Está el código disponible en GitHub?" o "¿Qué dirección IP usa?". Es una
// defensa más: la principal es que el corpus no tiene esos datos
const PRIVADO = new RegExp(
  "(?<![\\p{L}])(?:" +
    [
      // dinero
      "salari(?:o|os|al|ales)",
      "sueldo",
      "remuneracion",
      "pretensiones",
      "cuanto (?:quiere |suele |pide )?(?:cobra|cobrar|cobraria|gana|ganaria|le pagan|pagan|pide)",
      "(?:su|sus|tu|tus) tarifas?",
      "tarifas? (?:por hora|diaria|por dia)",
      "salary",
      "wages?",
      "how much (?:does (?:he|sergio)|do you) (?:charge|earn|make)",
      "hourly rate",
      "(?:his|your) rates?",
      // dónde vive
      "domicilio",
      "donde vive",
      "(?:su|tu) direccion",
      "direccion (?:postal|de casa|personal)",
      "(?:home|postal|his|your) address",
      "where does (?:he|sergio) live",
      // contacto
      "telefono",
      "(?:su|tu) (?:movil|whatsapp|email|e-mail|correo)",
      "numero de (?:movil|telefono|whatsapp)",
      "phone number",
      "(?:his|your) (?:phone|email|whatsapp)",
      "contactar",
      "(?:su|sus|datos de) contacto",
      // edad
      "edad",
      "cuantos anos tiene(?! de experiencia)",
      "nacimiento",
      "cuando nacio",
      "how old is (?:he|sergio)",
      "years old",
      "(?:his|your) age",
      "birthday",
      "dni",
      // disponibilidad
      "(?:esta|estaria|estas) disponible(?! (?:el|la|los|las|en|como|su|sus|para descargar)(?![\\p{L}]))",
      "(?<!alta )disponibilidad",
      "busca(?:ndo)? (?:trabajo|empleo)",
      "open to work",
      "is (?:he|sergio) available",
      "(?:available|availability) (?:for|to) (?:work|hire)",
    ].join("|") +
    ")(?![\\p{L}])",
  "u"
);

export const esPreguntaPrivada = (pregunta: string) => PRIVADO.test(normalizarTexto(pregunta));
