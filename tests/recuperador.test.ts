import { describe, expect, it } from "vitest";
import { recuperar, type Recuperador } from "../src/busqueda/recuperador";

const falso = (vector: Recuperador["vector"], texto: Recuperador["texto"]): Recuperador => ({ vector, texto });

describe("recuperar", () => {
  it("fusiona vector (filtrado por umbral) y texto", async () => {
    const r = await recuperar(
      falso(async () => [{ id: "a", score: 0.9 }, { id: "b", score: 0.2 }], async () => ["c", "a"]),
      "consulta",
      "pregunta",
      0.45
    );
    expect(r.map((x) => [x.id, x.origen])).toEqual([
      ["a", "ambos"],
      ["c", "texto"],
    ]);
  });

  it("si falla lo vectorial, sigue con FTS5 (degradación)", async () => {
    const r = await recuperar(
      falso(async () => {
        throw new Error("Vectorize caído");
      }, async () => ["c"]),
      "q",
      "p",
      0.45
    );
    expect(r.map((x) => x.id)).toEqual(["c"]);
  });

  it("usa la consulta (con historial) para vectores y la pregunta sola para FTS5", async () => {
    const vistos: string[] = [];
    await recuperar(
      falso(async (q) => (vistos.push("v:" + q), []), async (p) => (vistos.push("t:" + p), [])),
      "¿Frikile?\n¿y en esa?",
      "¿y en esa?",
      0.45
    );
    expect(vistos).toEqual(["v:¿Frikile?\n¿y en esa?", "t:¿y en esa?"]);
  });
});
