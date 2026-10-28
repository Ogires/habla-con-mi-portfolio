import { describe, expect, it } from "vitest";
import { leerSseOpenAi, type Delta } from "../src/ia/sse";
import { sseGroq } from "./helpers";

const cuerpo = (texto: string) => new Response(texto).body!;
const chunk = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;

async function leerTodo(c: ReadableStream<Uint8Array>, inactividadMs?: number): Promise<Delta[]> {
  const out: Delta[] = [];
  for await (const d of leerSseOpenAi(c, inactividadMs)) out.push(d);
  return out;
}

describe("leerSseOpenAi", () => {
  it("emite deltas de texto y los tokens del último chunk", async () => {
    const trozos = await leerTodo(sseGroq(["Hola", " mundo"], 777).body!);
    expect(trozos.map((t) => t.texto ?? "").join("")).toBe("Hola mundo");
    expect(trozos.at(-1)?.tokens).toBe(777);
  });

  it("procesa la última línea aunque no acabe en salto de línea", async () => {
    const trozos = await leerTodo(cuerpo(chunk({ choices: [{ delta: { content: "Hola" } }] }) + "data: [DONE]"));
    expect(trozos.map((t) => t.texto)).toEqual(["Hola"]);
  });

  it("emite el motivo de fin (finish_reason)", async () => {
    const trozos = await leerTodo(cuerpo(chunk({ choices: [{ delta: { content: "Ho" }, finish_reason: "length" }] }) + "data: [DONE]\n\n"));
    expect(trozos.at(-1)?.motivo).toBe("length");
  });

  it("un cuerpo que se acaba sin [DONE] es un stream cortado → lanza", async () => {
    await expect(leerTodo(cuerpo(chunk({ choices: [{ delta: { content: "Hola" } }] })))).rejects.toThrow(/cortado/);
  });

  it("sin datos durante el plazo de inactividad → lanza", async () => {
    const colgado = new ReadableStream<Uint8Array>({ start() {} });
    await expect(leerTodo(colgado, 50)).rejects.toThrow(/inactividad/);
  });
});
