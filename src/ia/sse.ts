// src/ia/sse.ts — lector SSE OpenAI-compatible
export interface Delta {
  texto?: string;
  tokens?: number;
  motivo?: string; // finish_reason: "stop", "length"...
}

// El timeout del primer byte (cadena.ts) solo cubre hasta las cabeceras: si Groq se queda callado a
// mitad, sin este plazo el visitante esperaría hasta que Cloudflare cortase la petición
export const INACTIVIDAD_MS = 15_000;

async function leerConPlazo<T>(lector: ReadableStreamDefaultReader<T>, ms: number): Promise<ReadableStreamReadResult<T>> {
  let rechazar!: (e: Error) => void;
  const plazo = new Promise<never>((_, r) => (rechazar = r));
  const temporizador = setTimeout(() => rechazar(new Error(`inactividad: ${ms} ms sin datos`)), ms);
  try {
    return await Promise.race([lector.read(), plazo]);
  } finally {
    clearTimeout(temporizador);
  }
}

// Groq manda el uso en x_groq.usage del último chunk. Un cuerpo que se acaba sin [DONE] es un stream
// cortado: lanza para que quien lo lea lo marque como truncado
export async function* leerSseOpenAi(cuerpo: ReadableStream<Uint8Array>, inactividadMs = INACTIVIDAD_MS): AsyncGenerator<Delta> {
  const lector = cuerpo.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await leerConPlazo(lector, inactividadMs);
      buffer += done ? "\n" : value; // al final, el salto procesa una última línea sin "\n"
      let salto: number;
      while ((salto = buffer.indexOf("\n")) >= 0) {
        const linea = buffer.slice(0, salto).trim();
        buffer = buffer.slice(salto + 1);
        if (!linea.startsWith("data:")) continue;
        const dato = linea.slice(5).trim();
        if (dato === "[DONE]") return;
        try {
          const json = JSON.parse(dato);
          const texto = json?.choices?.[0]?.delta?.content;
          const motivo = json?.choices?.[0]?.finish_reason;
          const tokens = json?.x_groq?.usage?.total_tokens ?? json?.usage?.total_tokens;
          yield {
            texto: typeof texto === "string" ? texto : undefined,
            tokens: typeof tokens === "number" ? tokens : undefined,
            motivo: typeof motivo === "string" ? motivo : undefined,
          };
        } catch {
          // línea malformada: se ignora
        }
      }
      if (done) throw new Error("stream cortado: terminó sin [DONE]");
    }
  } finally {
    lector.cancel().catch(() => {}); // libera la conexión con Groq si se sale antes de tiempo
  }
}
