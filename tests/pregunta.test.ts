import { afterEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { depsDesdeEnv, preguntar } from "../src/handlers/pregunta";
import { leerEventos, mockGroq, restaurarFetch, sseGroq } from "./helpers";

afterEach(restaurarFetch);

const peticion = (pregunta: string, ipCliente = "10.9.9.9", historial: { p: string }[] = []) =>
  new Request("https://webninja.fyi/api/pregunta", { method: "POST", headers: { "cf-connecting-ip": ipCliente }, body: JSON.stringify({ pregunta, historial }) });

describe("preguntar con búsqueda vectorial", () => {
  it("un resultado vectorial por encima del umbral entra con origen 'vector'", async () => {
    mockGroq(() => sseGroq(["Es un Wordle con la palabra en D1 [1]."]));
    const deps = {
      ...depsDesdeEnv(env),
      recuperador: { vector: async () => [{ id: "frk0000000000000-0", score: 0.8 }], texto: async () => [] },
    };
    const ev = await leerEventos(await preguntar(peticion("¿Qué juego hizo?"), deps));
    expect(ev[0].datos.map((f: { origen: string }) => f.origen)).toEqual(["vector"]);
    expect(ev.at(-1)?.datos.sinFuente).toBe(false);
  });
});

describe("tope diario de IA por cliente", () => {
  it("sin cupo → fuentes y texto fijo, sin llamar a Groq", async () => {
    const llamadas = mockGroq(() => sseGroq(["no"]));
    const deps = { ...depsDesdeEnv(env), cupoIa: async () => ({ permitido: false, retryAfter: 3600 }) };
    const ev = await leerEventos(await preguntar(peticion("¿Usa Durable Objects?"), deps));
    expect(ev[0].datos.length).toBeGreaterThan(0);
    expect(ev.at(-1)?.datos.degradado).toBe(true);
    expect(llamadas).toHaveLength(0);
  });

  it("si el contador no responde → sin IA (fail-closed), con fuentes", async () => {
    const llamadas = mockGroq(() => sseGroq(["no"]));
    const deps = {
      ...depsDesdeEnv(env),
      cupoIa: async () => {
        throw new Error("DO caído");
      },
    };
    const ev = await leerEventos(await preguntar(peticion("¿Usa Durable Objects?"), deps));
    expect(ev.at(-1)?.datos.degradado).toBe(true);
    expect(llamadas).toHaveLength(0);
  });

  it("limita por la clave del cliente (IPv6 por /64)", async () => {
    mockGroq(() => sseGroq(["ok [1]."]));
    const vistas: string[] = [];
    const deps = {
      ...depsDesdeEnv(env),
      limitar: async (clave: string) => (vistas.push(clave), { permitido: true, retryAfter: 0 }),
      cupoIa: async (clave: string) => (vistas.push(clave), { permitido: true, retryAfter: 0 }),
    };
    await leerEventos(await preguntar(peticion("¿Usa Durable Objects?", "2001:db8:5:6:7:8:9:a"), deps));
    expect(vistas).toEqual(["2001:db8:5:6::/64", "2001:db8:5:6::/64"]);
  });
});

describe("historial", () => {
  it("una pregunta privada anterior no entra en la búsqueda ni en el prompt", async () => {
    const llamadas = mockGroq(() => sseGroq(["Usa un Durable Object [1]."]));
    const consultas: string[] = [];
    const deps = {
      ...depsDesdeEnv(env),
      recuperador: { vector: async (q: string) => (consultas.push(q), []), texto: async () => ["ifc0000000000000-0"] },
    };
    await leerEventos(await preguntar(peticion("¿Usa Durable Objects?", "10.9.9.8", [{ p: "¿Cuál es su salario?" }]), deps));
    expect(consultas).toEqual(["¿Usa Durable Objects?"]);
    expect(llamadas[0].messages.at(-1)?.content).not.toContain("salario");
  });
});
