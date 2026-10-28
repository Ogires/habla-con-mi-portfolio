import { describe, expect, it } from "vitest";
import { claveIp, leerJson } from "../src/http/util";

const conCuerpo = (trozos: string[]) => {
  const codificador = new TextEncoder();
  const cuerpo = new ReadableStream<Uint8Array>({
    start(c) {
      for (const t of trozos) c.enqueue(codificador.encode(t));
      c.close();
    },
  });
  return new Request("https://webninja.fyi/api/pregunta", { method: "POST", body: cuerpo, duplex: "half" } as RequestInit);
};

describe("leerJson", () => {
  it("lee un objeto JSON", async () => {
    expect(await leerJson(conCuerpo(['{"pregunta":', '"hola"}']))).toEqual({ pregunta: "hola" });
  });

  it("sin content-length (chunked) deja de leer al pasar de 4 KB", async () => {
    let leidos = 0;
    const infinito = new ReadableStream<Uint8Array>({
      pull(c) {
        // 1 MB en trozos de 1 KB: finito para que el código sin tope termine (y falle) en vez de colgarse
        if (++leidos > 1_024) return c.close();
        c.enqueue(new Uint8Array(1_024).fill(120));
      },
    });
    const r = new Request("https://webninja.fyi/x", { method: "POST", body: infinito, duplex: "half" } as RequestInit);
    expect(await leerJson(r)).toBeNull();
    expect(leidos).toBeLessThan(10);
  });

  it("arrays, JSON roto y content-length declarado de más → null", async () => {
    expect(await leerJson(conCuerpo(["[1,2]"]))).toBeNull();
    expect(await leerJson(conCuerpo(["{roto"]))).toBeNull();
    const grande = new Request("https://webninja.fyi/x", { method: "POST", headers: { "content-length": "99999" }, body: "{}" });
    expect(await leerJson(grande)).toBeNull();
  });
});

describe("claveIp", () => {
  it("IPv4 tal cual", () => {
    expect(claveIp("203.0.113.7")).toBe("203.0.113.7");
  });

  it("IPv6 por su /64: un cliente suele tener el bloque entero", () => {
    expect(claveIp("2001:db8:abcd:12:1:2:3:4")).toBe("2001:db8:abcd:12::/64");
    expect(claveIp("2001:DB8:ABCD:0012::9")).toBe("2001:db8:abcd:12::/64");
    expect(claveIp("2001:db8::1")).toBe("2001:db8:0:0::/64");
  });

  it("IPv4 mapeada en IPv6 → la IPv4", () => {
    expect(claveIp("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });
});
