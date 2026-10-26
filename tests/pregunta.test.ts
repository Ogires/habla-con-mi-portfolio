import { afterEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { depsDesdeEnv, preguntar } from "../src/handlers/pregunta";
import { leerEventos, mockGroq, restaurarFetch, sseGroq } from "./helpers";

afterEach(restaurarFetch);

const peticion = (pregunta: string) =>
  new Request("https://webninja.fyi/api/pregunta", { method: "POST", headers: { "cf-connecting-ip": "10.9.9.9" }, body: JSON.stringify({ pregunta }) });

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
