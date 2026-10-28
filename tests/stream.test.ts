import { describe, expect, it } from "vitest";
import { streamRespuesta, type ResumenFin } from "../src/ia/stream";
import { leerEventos, sseGroq } from "./helpers";

const FUENTES = [{ n: 1, titulo: "t", url: "https://github.com/Ogires/x", tipo: "repo", extracto: "e", origen: "texto" as const }];
const FIN: ResumenFin = { modelo: "m", degradado: false, sinFuente: false, citasDudosas: [], citasInvalidas: [] };
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

  it("respuesta completa → fin con truncada: false", async () => {
    const ev = await leer(streamRespuesta({ fuentes: [], upstream: sseGroq(["Hola [1]."]).body!, textoFijo: "x", alTerminar: async () => FIN }));
    expect(ev.at(-1)).toEqual({ evento: "fin", datos: { ...FIN, truncada: false } });
  });

  it("upstream cortado a mitad → texto recibido y fin con truncada: true", async () => {
    const cortado = new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: "Usa un Durable" } }] })}\n\n`).body!;
    let visto: unknown;
    const ev = await leer(streamRespuesta({ fuentes: [], upstream: cortado, textoFijo: "x", alTerminar: async (r) => ((visto = r), FIN) }));
    expect(visto).toEqual({ texto: "Usa un Durable", tokens: null });
    expect(ev.at(-1)?.datos.truncada).toBe(true);
  });

  it("finish_reason 'length' (max_tokens) → truncada: true", async () => {
    const largo = new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: "Usa" }, finish_reason: "length" }] })}\n\ndata: [DONE]\n\n`).body!;
    const ev = await leer(streamRespuesta({ fuentes: [], upstream: largo, textoFijo: "x", alTerminar: async () => FIN }));
    expect(ev.at(-1)?.datos.truncada).toBe(true);
  });

  it("normaliza las citas 【n】 aunque lleguen partidas: el navegador y alTerminar ven [n]", async () => {
    let visto: unknown;
    const ev = await leer(
      streamRespuesta({
        fuentes: FUENTES,
        upstream: sseGroq(["Usa D1 【", "1】."], 50).body!,
        textoFijo: "x",
        alTerminar: async (r) => ((visto = r), FIN),
      })
    );
    expect(ev.filter((e) => e.evento === "texto").map((e) => e.datos.t).join("")).toBe("Usa D1 [1].");
    expect(visto).toEqual({ texto: "Usa D1 [1].", tokens: 50 });
  });

  it("si el stream se corta con una cita a medias, sale lo retenido", async () => {
    const cortado = new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: "Usa D1 【1" } }] })}\n\n`).body!;
    let visto: unknown;
    await leer(streamRespuesta({ fuentes: [], upstream: cortado, textoFijo: "x", alTerminar: async (r) => ((visto = r), FIN) }));
    expect(visto).toEqual({ texto: "Usa D1 【1", tokens: null });
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
