import { describe, expect, it } from "vitest";
import { bloques, segmentos } from "../public/render.js";

describe("segmentos", () => {
  it("texto, negrita y citas", () => {
    expect(segmentos("Usa **Durable Objects** [1] y D1 [2].")).toEqual([
      { tipo: "texto", valor: "Usa " },
      { tipo: "negrita", valor: "Durable Objects" },
      { tipo: "texto", valor: " " },
      { tipo: "cita", n: 1 },
      { tipo: "texto", valor: " y D1 " },
      { tipo: "cita", n: 2 },
      { tipo: "texto", valor: "." },
    ]);
  });

  it("el HTML y las URLs se quedan como texto plano", () => {
    expect(segmentos('<img src=x onerror=alert(1)> https://phishing.example')).toEqual([
      { tipo: "texto", valor: '<img src=x onerror=alert(1)> https://phishing.example' },
    ]);
  });
});

describe("bloques", () => {
  it("párrafos y listas", () => {
    expect(bloques("Hola [1].\n\n- uno\n- **dos**")).toEqual([
      { tipo: "parrafo", segmentos: [{ tipo: "texto", valor: "Hola " }, { tipo: "cita", n: 1 }, { tipo: "texto", valor: "." }] },
      { tipo: "lista", items: [[{ tipo: "texto", valor: "uno" }], [{ tipo: "negrita", valor: "dos" }]] },
    ]);
  });
});
