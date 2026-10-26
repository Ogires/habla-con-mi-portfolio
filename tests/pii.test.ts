import { describe, expect, it } from "vitest";
import { buscarDatosPersonales } from "../scripts/lib/pii.mjs";

describe("buscarDatosPersonales", () => {
  it("detecta email, teléfono, DNI, NIE, IBAN y dirección, con línea y sin el dato", () => {
    const texto = [
      "Contacto: sergio.ejemplo@gmail.com",
      "Móvil 612 345 678",
      "DNI 12345678Z",
      "NIE X1234567L",
      "IBAN ES91 2100 0418 4502 0005 1332",
      "Vivo en Calle Mayor 12, 28013 Madrid",
    ].join("\n");
    expect(buscarDatosPersonales(texto)).toEqual([
      { linea: 1, tipo: "email" },
      { linea: 2, tipo: "teléfono" },
      { linea: 3, tipo: "DNI/NIE" },
      { linea: 4, tipo: "DNI/NIE" },
      { linea: 5, tipo: "IBAN" },
      { linea: 6, tipo: "dirección" },
    ]);
  });

  it("no salta con datos técnicos del corpus", () => {
    const tecnico = "D1 71fe4cb9-1110-41c0-be4d-c3615607a613 · KV 0ce67492b8fe49b1961e598371cb4d22 · 110 tests · 2026-10-21 · 200000 tokens · 40 → 6";
    expect(buscarDatosPersonales(tecnico)).toEqual([]);
  });

  it("respeta la lista de permitidos", () => {
    expect(buscarDatosPersonales("escríbeme a hola@webninja.fyi", ["hola@webninja.fyi"])).toEqual([]);
  });
});
