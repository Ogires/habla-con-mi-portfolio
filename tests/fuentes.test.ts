import { describe, expect, it } from "vitest";
import { extraerPost, filtrarSecciones, hashFuente, idFragmento, idsRepetidos, planificar, sha256 } from "../scripts/lib/fuentes.mjs";

describe("extraerPost", () => {
  it("devuelve solo el bloque de código bajo el encabezado del post", () => {
    const guia = "## INSTRUCCIONES PARA CLAUDE\nNo publiques sin permiso\n### 2A. El post (1.497 caracteres)\n\n```\nLe escribí al entrevistador...\n```\n### 2B. Comentario\n```\nenlaces\n```";
    expect(extraerPost(guia)).toBe("Le escribí al entrevistador...");
  });

  it("también vale con '## EL POST' (post-linkedin-final.md de Excusotron)", () => {
    expect(extraerPost("# x\n## EL POST (listo para copiar)\n```text\nHola\n```")).toBe("Hola");
  });

  it("sin post → null", () => {
    expect(extraerPost("# nada")).toBeNull();
  });
});

describe("filtrarSecciones", () => {
  it("se queda con las secciones cuyo título contiene alguno de los textos", () => {
    const md = "# Textos\npreámbulo\n## 1. Titular\nDev\n## 3. Open to Work\nprivado\n## 6. Acerca de: español\nHago apps";
    expect(filtrarSecciones(md, ["Titular", "Acerca de: español"])).toBe("## 1. Titular\nDev\n\n## 6. Acerca de: español\nHago apps");
  });

  it("incluye las subsecciones de una sección incluida y nada más", () => {
    const md = "## 10. Proyectos\nintro\n### Last listened\nextensión\n### Lotero\ncupones\n## 11. Pendiente\nnotas privadas";
    expect(filtrarSecciones(md, ["Proyectos"])).toBe("## 10. Proyectos\nintro\n\n### Last listened\nextensión\n\n### Lotero\ncupones");
  });
});

describe("idFragmento", () => {
  it("cabe en los 64 bytes de Vectorize y es estable", async () => {
    const id = await idFragmento("interview-fight-club/docs/plans/2026-10-21-interview-fight-club-design.md", 12);
    expect(id).toMatch(/^[0-9a-f]{16}-12$/);
    expect(await idFragmento("interview-fight-club/docs/plans/2026-10-21-interview-fight-club-design.md", 12)).toBe(id);
  });
});

describe("planificar", () => {
  it("clasifica en nuevas, cambiadas, borradas e iguales", () => {
    const antes = new Map([["a", "1"], ["b", "2"], ["c", "3"]]);
    const ahora = new Map([["a", "1"], ["b", "X"], ["d", "4"]]);
    expect(planificar(antes, ahora)).toEqual({ nuevas: ["d"], cambiadas: ["b"], borradas: ["c"], iguales: ["a"] });
  });
});

describe("sha256", () => {
  it("hex de 64", async () => {
    expect(await sha256("hola")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("hashFuente", () => {
  const base = { id: "x", tipo: "repo", titulo: "X · README", url: "https://github.com/Ogires/x", texto: "hola", anclar: true };

  it("es estable", async () => {
    expect(await hashFuente({ ...base })).toBe(await hashFuente(base));
  });

  it("cambia si cambian el texto o los metadatos que se guardan en cada fragmento", async () => {
    const h = await hashFuente(base);
    for (const cambio of [{ texto: "adiós" }, { titulo: "Otro" }, { url: "https://github.com/Ogires/y" }, { tipo: "doc" }, { anclar: false }, { minimo: 0 }])
      expect(await hashFuente({ ...base, ...cambio }), JSON.stringify(cambio)).not.toBe(h);
  });
});

describe("idsRepetidos", () => {
  it("devuelve cada id repetido una vez", () => {
    expect(idsRepetidos([{ id: "a" }, { id: "b" }, { id: "a" }, { id: "a" }])).toEqual(["a"]);
    expect(idsRepetidos([{ id: "a" }, { id: "b" }])).toEqual([]);
  });
});
