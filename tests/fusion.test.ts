import { describe, expect, it } from "vitest";
import { filtrarPorUmbral, fusionarRrf } from "../src/dominio/fusion";

describe("fusionarRrf", () => {
  it("premia lo que aparece en las dos listas y marca su origen", () => {
    const r = fusionarRrf(
      [{ id: "a", score: 0.9 }, { id: "b", score: 0.8 }],
      ["b", "c"]
    );
    expect(r.map((x) => [x.id, x.origen])).toEqual([
      ["b", "ambos"],
      ["a", "vector"],
      ["c", "texto"],
    ]);
  });

  it("devuelve como mucho n, con desempate estable por id", () => {
    const r = fusionarRrf([], ["e", "d", "c", "b", "a", "z"], 5);
    expect(r).toHaveLength(5);
    expect(r[0].id).toBe("e");
  });

  it("listas vacías → vacío", () => {
    expect(fusionarRrf([], [])).toEqual([]);
  });
});

describe("filtrarPorUmbral", () => {
  it("descarta los resultados vectoriales por debajo del umbral", () => {
    expect(filtrarPorUmbral([{ id: "a", score: 0.5 }, { id: "b", score: 0.3 }], 0.45)).toEqual([{ id: "a", score: 0.5 }]);
  });
});
