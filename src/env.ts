import type { Contador } from "./contadores/contador";

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  CONTADOR: DurableObjectNamespace<Contador>;
  ASSETS: Fetcher;
  // Opcionales: no existen en los tests (wrangler.test.jsonc) → el handler cae a FTS5
  AI?: Ai;
  VECTORIZE?: Vectorize;
  GROQ_API_KEY?: string;
  GROQ_MODEL: string;
  GROQ_MODEL_RESERVA_1: string;
  GROQ_MODEL_RESERVA_2: string;
  CUOTA_TOKENS_DIA: string;
  MODELO_EMBEDDINGS: string;
  UMBRAL_COSENO: string;
  URL_LINKEDIN: string;
}
