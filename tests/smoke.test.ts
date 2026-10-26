import { describe, expect, it } from "vitest";
import { SELF } from "cloudflare:test";

describe("router", () => {
  it("sirve la portada con CSP", async () => {
    const r = await SELF.fetch("https://webninja.fyi/");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-security-policy")).toContain("default-src 'self'");
  });

  it("www redirige a la raíz conservando la ruta", async () => {
    const r = await SELF.fetch("https://www.webninja.fyi/apps.json?x=1", { redirect: "manual" });
    expect(r.status).toBe(301);
    expect(r.headers.get("location")).toBe("https://webninja.fyi/apps.json?x=1");
  });

  it("api desconocida → 404 JSON", async () => {
    const r = await SELF.fetch("https://webninja.fyi/api/nada");
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "no_existe" });
  });
});
