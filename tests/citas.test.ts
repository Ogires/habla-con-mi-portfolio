import { describe, expect, it } from "vitest";
import { analizarCitas, normalizadorCitas } from "../src/dominio/citas";
import { FRASE_NO_APARECE } from "../src/dominio/respuestas";

const F = [
  { n: 1, texto: "El rate limit va en un Durable Object Contador con SQLite." },
  { n: 2, texto: "Frikile guarda la palabra del día en D1 y nunca llega al cliente." },
];

describe("analizarCitas", () => {
  it("citas válidas y respaldadas", () => {
    const a = analizarCitas("Usa un Durable Object para el rate limit [1]. La palabra vive en D1 [2].", F);
    expect(a).toEqual({ validas: [1, 2], fueraDeRango: [], dudosas: [], sinFuente: false });
  });

  it("la cita tras el punto cuenta para la frase anterior", () => {
    expect(analizarCitas("Usa un Durable Object para el rate limit. [1]", F).dudosas).toEqual([]);
  });

  it("cita fuera de rango", () => {
    const a = analizarCitas("Usa Kubernetes [7].", F);
    expect(a.fueraDeRango).toEqual([7]);
    expect(a.sinFuente).toBe(true);
  });

  it("cita que no comparte ningún término con su fragmento → dudosa", () => {
    expect(analizarCitas("Sergio domina Kubernetes y Terraform [2].", F).dudosas).toEqual([2]);
  });

  it("sin citas → sinFuente", () => {
    expect(analizarCitas("Es un desarrollador estupendo.", F).sinFuente).toBe(true);
  });

  it("la frase de 'no aparece' no es sinFuente", () => {
    expect(analizarCitas(FRASE_NO_APARECE, F).sinFuente).toBe(false);
  });

  it("muchas citas seguidas no disparan el backtracking (ReDoS)", () => {
    const inicio = performance.now();
    analizarCitas("[1]   ".repeat(13) + "x", F);
    expect(performance.now() - inicio).toBeLessThan(100);
  });
});

// gpt-oss a veces cita al estilo interno de OpenAI (visto en local el 2026-10-28)
describe("normalizadorCitas", () => {
  const normalizar = (trozos: string[]) => {
    const n = normalizadorCitas();
    const salidas = trozos.map((t) => n.empujar(t));
    return { salidas, total: salidas.join("") + n.vaciar() };
  };

  it("【n】 y 【n†…】 pasan a [n]", () => {
    expect(normalizar(["Usa D1【2】 y KV【3†L1-L4】."]).total).toBe("Usa D1[2] y KV[3].");
  });

  it("una cita partida entre trozos se retiene hasta que se cierra", () => {
    const { salidas, total } = normalizar(["Usa D1 【", "1", "2】."]);
    expect(salidas).toEqual(["Usa D1 ", "", "[12]."]);
    expect(total).toBe("Usa D1 [12].");
  });

  it("un 【 que no es cita no retiene el texto para siempre", () => {
    const largo = "x".repeat(40);
    const { salidas, total } = normalizar(["a【", largo, "b"]);
    expect(salidas[1]).toBe(`【${largo}`);
    expect(total).toBe(`a【${largo}b`);
  });

  it("lo que no es una cita numérica se deja tal cual", () => {
    expect(normalizar(["【nota】 y 【123】"]).total).toBe("【nota】 y 【123】");
  });

  it("al vaciar sale lo retenido aunque no se haya cerrado", () => {
    expect(normalizar(["Usa D1 【1"]).total).toBe("Usa D1 【1");
  });
});
