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

  it("detecta teléfonos con cualquier agrupación de cifras", () => {
    const texto = ["612 34 56 78", "+34 612 34 56 78", "612-34-56-78", "+34612345678"].join("\n");
    expect(buscarDatosPersonales(texto).map((h) => h.tipo)).toEqual(["teléfono", "teléfono", "teléfono", "teléfono"]);
  });

  it("detecta DNI/NIE en minúsculas, con puntos o con guiones", () => {
    const texto = ["dni 12345678z", "12.345.678-Z", "x1234567l", "X-1234567-L"].join("\n");
    expect(buscarDatosPersonales(texto).map((h) => h.tipo)).toEqual(["DNI/NIE", "DNI/NIE", "DNI/NIE", "DNI/NIE"]);
  });

  it("detecta IBAN en minúsculas, con guiones o sin espacios", () => {
    const texto = ["iban es91 2100 0418 4502 0005 1332", "ES91-2100-0418-4502-0005-1332", "ES9121000418450200051332"].join("\n");
    expect(buscarDatosPersonales(texto).map((h) => h.tipo)).toEqual(["IBAN", "IBAN", "IBAN"]);
  });

  it("detecta teléfonos internacionales y con paréntesis, uno por línea", () => {
    const texto = ["(+34) 612 345 678", "0034 612 345 678", "+44 20 7946 0958", "+1 (415) 555-0132"].join("\n");
    expect(buscarDatosPersonales(texto)).toEqual([1, 2, 3, 4].map((linea) => ({ linea, tipo: "teléfono" })));
  });

  it("detecta emails ofuscados", () => {
    const texto = [
      "sergio [at] gmail [dot] com",
      "sergio(at)gmail.com",
      "sergio arroba gmail punto com",
      "sergio at gmail dot com",
      "sergio.bonet arroba gmail.com",
    ].join("\n");
    expect(buscarDatosPersonales(texto).map((h) => h.tipo)).toEqual(["email", "email", "email", "email", "email"]);
  });

  it("no salta con datos técnicos del corpus", () => {
    const tecnico = "D1 71fe4cb9-1110-41c0-be4d-c3615607a613 · KV 0ce67492b8fe49b1961e598371cb4d22 · 110 tests · 2026-10-21 · 200000 tokens · 40 → 6";
    expect(buscarDatosPersonales(tecnico)).toEqual([]);
    const frases = [
      "Deployed at Cloudflare. Then it scales",
      "rate limit at 10 req/min",
      "+100 tests y 1234567 Tokens",
      "Plan de 12 meses, 99.9 % de alta disponibilidad",
      "Groq: 30 RPM, 1K RPD, 8K TPM, 200K TPD",
    ].join("\n");
    expect(buscarDatosPersonales(frases)).toEqual([]);
  });

  it("respeta la lista de permitidos", () => {
    expect(buscarDatosPersonales("escríbeme a hola@webninja.fyi", ["hola@webninja.fyi"])).toEqual([]);
  });
});
