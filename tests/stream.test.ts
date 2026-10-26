import { describe, expect, it } from "vitest";
import { streamRespuesta, type FinRespuesta } from "../src/ia/stream";
import { leerEventos, sseGroq } from "./helpers";

const FUENTES = [{ n: 1, titulo: "t", url: "https://github.com/Ogires/x", tipo: "repo", extracto: "e", origen: "texto" as const }];
const FIN: FinRespuesta = { modelo: "m", degradado: false, sinFuente: false, citasDudosas: [], citasInvalidas: [] };
const leer = (s: ReadableStream<Uint8Array>) => leerEventos(new Response(s));

describe("streamRespuesta", () => {
  it("fuentes → texto → fin, y pasa el texto completo y los tokens a alTerminar", async () => {
    let visto: unknown;
    const ev = await leer(
      streamRespuesta({
        fuentes: FUENTES,
        upstream: sseGroq(["Hola ", "[1]."], 321).body!,
        textoFijo: "vacía",
        alTerminar: async (r) => ((visto = r), FIN),
      })
    );
    expect(ev.map((e) => e.evento)).toEqual(["fuentes", "texto", "texto", "fin"]);
    expect(ev[0].datos).toEqual(FUENTES);
    expect(visto).toEqual({ texto: "Hola [1].", tokens: 321 });
  });

  it("sin upstream: emite el texto fijo", async () => {
    const ev = await leer(streamRespuesta({ fuentes: [], textoFijo: "Eso pregúntaselo a Sergio.", alTerminar: async () => FIN }));
    expect(ev.map((e) => [e.evento, e.datos?.t])).toEqual([
      ["fuentes", undefined],
      ["texto", "Eso pregúntaselo a Sergio."],
      ["fin", undefined],
    ]);
  });

  it("upstream vacío: cae al texto fijo", async () => {
    const ev = await leer(streamRespuesta({ fuentes: [], upstream: sseGroq([]).body!, textoFijo: "vacía", alTerminar: async () => FIN }));
    expect(ev.find((e) => e.evento === "texto")?.datos.t).toBe("vacía");
  });

  it("si alTerminar falla → evento error", async () => {
    const ev = await leer(
      streamRespuesta({
        fuentes: [],
        textoFijo: "x",
        alTerminar: async () => {
          throw new Error("DO caído");
        },
      })
    );
    expect(ev.at(-1)?.evento).toBe("error");
  });
});
