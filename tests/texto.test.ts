import { describe, expect, it } from "vitest";
import { normalizarTexto, recortar, terminosSignificativos } from "../src/dominio/texto";

describe("normalizarTexto", () => {
  it("minúsculas y sin tildes", () => {
    expect(normalizarTexto("Configuración ÚNICA")).toBe("configuracion unica");
  });
});

describe("terminosSignificativos", () => {
  it("quita stopwords en español e inglés, palabras cortas y duplicados", () => {
    expect(terminosSignificativos("¿Qué usa Sergio para los contadores? Usa Durable Objects, the objects")).toEqual([
      "contadores",
      "durable",
      "objects",
    ]);
  });

  it("conserva números y siglas de 3+ caracteres", () => {
    expect(terminosSignificativos("Groq con gpt-oss 120b y D1")).toEqual(["groq", "gpt", "oss", "120b"]);
  });
});

describe("recortar", () => {
  it("añade puntos suspensivos solo si se pasa", () => {
    expect(recortar("hola", 10)).toBe("hola");
    expect(recortar("abcdefghijk", 5)).toBe("abcd…");
  });
});
