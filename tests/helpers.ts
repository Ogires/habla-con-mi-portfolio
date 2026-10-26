// tests/helpers.ts — mock de Groq parcheando globalThis.fetch (lección 1: sin fetchMock,
// FÁBRICA de Response porque un Response con stream no se consume dos veces)
export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const fetchReal = globalThis.fetch.bind(globalThis);

export interface PeticionGroq {
  model: string;
  stream: boolean;
  max_tokens: number;
  temperature: number;
  messages: { role: string; content: string }[];
  nonce: string | null;
}

// El nonce se lee del delimitador de fragmentos del prompt de sistema
export function mockGroq(crear: (p: PeticionGroq) => Response | Promise<Response>) {
  const llamadas: PeticionGroq[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url !== GROQ_URL) return fetchReal(input, init);
    const cuerpo = JSON.parse(String(init?.body));
    const p: PeticionGroq = { ...cuerpo, nonce: /<fragmentos-([0-9a-f]{8})>/.exec(cuerpo.messages[0].content)?.[1] ?? null };
    llamadas.push(p);
    return crear(p);
  }) as typeof fetch;
  return llamadas;
}

export function restaurarFetch(): void {
  globalThis.fetch = fetchReal;
}

export function sseGroq(trozos: string[], tokens = 900): Response {
  const lineas = trozos.map((t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`);
  lineas.push(`data: ${JSON.stringify({ choices: [{ delta: {} }], x_groq: { usage: { total_tokens: tokens } } })}\n\n`, "data: [DONE]\n\n");
  return new Response(lineas.join(""), { headers: { "content-type": "text/event-stream" } });
}

export async function leerEventos(r: Response): Promise<{ evento: string; datos: any }[]> {
  const texto = await r.text();
  return texto
    .split("\n\n")
    .filter((b) => b.trim())
    .map((b) => ({
      evento: /^event: (.+)$/m.exec(b)?.[1] ?? "message",
      datos: JSON.parse(/^data: (.+)$/m.exec(b)?.[1] ?? "null"),
    }));
}
