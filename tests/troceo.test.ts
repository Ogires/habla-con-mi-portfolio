import { describe, expect, it } from "vitest";
import { secciones, slugGithub, trocear } from "../scripts/lib/troceo.mjs";

const palabras = (n: number, p = "palabra") => Array.from({ length: n }, (_, i) => `${p}${i}`).join(" ");

describe("slugGithub", () => {
  it("como los anclajes de GitHub", () => {
    expect(slugGithub("3.0 Contadores exactos: Durable Object `Contador` (lección 9)")).toBe("30-contadores-exactos-durable-object-contador-lección-9");
  });
});

describe("secciones", () => {
  it("parte por encabezados e ignora los # dentro de bloques de código", () => {
    const md = "# Título\nintro\n## Uno\n```bash\n# no es encabezado\n```\ntexto\n## Dos\nmás";
    expect(secciones(md).map((s: { titulo: string }) => s.titulo)).toEqual(["Título", "Uno", "Dos"]);
  });
});

describe("trocear", () => {
  it("una sección larga se parte en trozos de 300 con solape de 50", () => {
    const trozos = trocear(`## Larga\n${palabras(600)}`);
    expect(trozos.map((t: { texto: string }) => t.texto.split(" ").length)).toEqual([300, 300, 100]);
    expect(trozos[1].texto.startsWith("palabra250 ")).toBe(true);
    expect(trozos.every((t: { titulo: string }) => t.titulo === "Larga")).toBe(true);
  });

  it("las secciones de menos de 40 palabras se unen a la siguiente", () => {
    const trozos = trocear(`# Corta\nhola\n## Normal\n${palabras(50)}`);
    expect(trozos).toHaveLength(1);
    expect(trozos[0].titulo).toBe("Corta");
    expect(trozos[0].texto.startsWith("hola")).toBe(true);
  });

  it("la sección fundida conserva su encabezado en el texto (si no, no se encontraría por él)", () => {
    const [trozo] = trocear(`# Corta\nhola\n## Habilidades técnicas\n${palabras(50)}`);
    expect(trozo.texto).toContain("hola Habilidades técnicas palabra0");
  });
});
