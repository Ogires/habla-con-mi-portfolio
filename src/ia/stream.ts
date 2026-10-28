// src/ia/stream.ts — SSE propio hacia el navegador: fuentes → texto* → fin | error
import { normalizadorCitas } from "../dominio/citas";
import type { Origen } from "../dominio/fusion";
import { leerSseOpenAi } from "./sse";

export const CABECERAS_SSE = { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store" };

// Lección 2: el trabajo pendiente se registra en ctx.waitUntil
export type Esperar = (p: Promise<unknown>) => void;

export interface FuenteEvento {
  n: number;
  titulo: string;
  url: string;
  tipo: string;
  extracto: string;
  origen: Origen;
}

export interface FinRespuesta {
  modelo: string | null;
  degradado: boolean;
  sinFuente: boolean;
  citasDudosas: number[];
  citasInvalidas: number[];
  truncada: boolean; // stream cortado, inactivo o al límite de max_tokens: la respuesta puede estar incompleta
}

// Lo que decide quien llama; truncada lo sabe solo el stream
export type ResumenFin = Omit<FinRespuesta, "truncada">;

const MENSAJE_ERROR = "Algo ha fallado al responder. Prueba otra vez en un momento.";
const codificador = new TextEncoder();

function emisor(controller: ReadableStreamDefaultController<Uint8Array>) {
  return (evento: string, datos: unknown) => {
    try {
      controller.enqueue(codificador.encode(`event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`));
    } catch {
      // el cliente se fue: se sigue para sumar tokens igualmente
    }
  };
}

export function streamRespuesta(o: {
  fuentes: FuenteEvento[];
  upstream?: ReadableStream<Uint8Array>;
  textoFijo: string;
  alTerminar(r: { texto: string; tokens: number | null }): Promise<ResumenFin>;
  esperar?: Esperar;
}): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const trabajo = (async () => {
        const enviar = emisor(controller);
        enviar("fuentes", o.fuentes);
        let texto = "";
        let tokens: number | null = null;
        let truncada = false;
        try {
          if (o.upstream) {
            const citas = normalizadorCitas();
            const emitir = (t: string) => {
              if (!t) return;
              texto += t;
              enviar("texto", { t });
            };
            try {
              for await (const d of leerSseOpenAi(o.upstream)) {
                if (d.tokens !== undefined) tokens = d.tokens;
                if (d.motivo === "length") truncada = true;
                if (d.texto) emitir(citas.empujar(d.texto));
              }
            } catch (err) {
              // stream cortado o inactivo: se cierra con lo recibido y se avisa
              truncada = true;
              console.error(JSON.stringify({ evento: "stream_error", fase: "proveedor", mensaje: String(err) }));
            }
            emitir(citas.vaciar());
          }
          if (!texto.trim()) {
            texto = o.textoFijo;
            enviar("texto", { t: o.textoFijo });
          }
          enviar("fin", { ...(await o.alTerminar({ texto, tokens })), truncada });
        } catch (err) {
          console.error(JSON.stringify({ evento: "stream_error", mensaje: String(err) }));
          enviar("error", { mensaje: MENSAJE_ERROR });
        }
        try {
          controller.close();
        } catch {
          /* ya cerrado */
        }
      })();
      o.esperar?.(trabajo);
      return trabajo;
    },
  });
}
