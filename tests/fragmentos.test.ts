import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { buscarTexto, consultaFts, leerFragmentos } from "../src/repos/fragmentos";

describe("consultaFts", () => {
  it("términos significativos entre comillas unidos con OR", () => {
    expect(consultaFts("¿Usa Durable Objects?")).toBe('"durable" OR "objects"');
  });

  it("sin términos útiles → null", () => {
    expect(consultaFts("¿Qué es eso?")).toBeNull();
  });
});

describe("buscarTexto (FTS5 en D1)", () => {
  it("encuentra por palabras e ignora tildes", async () => {
    expect(await buscarTexto(env.DB, "durable objects")).toEqual(["ifc0000000000000-0"]);
    expect(await buscarTexto(env.DB, "configuracion")).toEqual(["frk0000000000000-0"]);
  });

  it("encuentra siglas de 2 letras", async () => {
    expect(await buscarTexto(env.DB, "¿Qué guarda en D1?")).toEqual(["frk0000000000000-0"]);
  });

  it("nada que buscar → []", async () => {
    expect(await buscarTexto(env.DB, "xilófono")).toEqual([]);
  });
});

describe("leerFragmentos", () => {
  it("respeta el orden pedido, añade el tipo de la fuente y omite ids inexistentes", async () => {
    const r = await leerFragmentos(env.DB, ["frk0000000000000-0", "no-existe", "ifc0000000000000-0"]);
    expect(r.map((f) => [f.id, f.tipo])).toEqual([
      ["frk0000000000000-0", "repo"],
      ["ifc0000000000000-0", "repo"],
    ]);
  });
});
