// src/repos/fragmentos.ts — lectura de fragmentos y búsqueda por palabras (FTS5). Solo lectura (LLM08)
import { terminosSignificativos } from "../dominio/texto";

export interface Fragmento {
  id: string;
  titulo: string;
  url: string;
  texto: string;
  tipo: string;
}

// Los términos solo contienen letras y números: entre comillas no pueden inyectar sintaxis FTS5
export function consultaFts(pregunta: string): string | null {
  const t = terminosSignificativos(pregunta).slice(0, 12);
  return t.length ? t.map((x) => `"${x}"`).join(" OR ") : null;
}

export async function buscarTexto(db: D1Database, pregunta: string, k = 8): Promise<string[]> {
  const q = consultaFts(pregunta);
  if (!q) return [];
  const { results } = await db
    .prepare("SELECT id FROM fragmentos_fts WHERE fragmentos_fts MATCH ? ORDER BY bm25(fragmentos_fts) LIMIT ?")
    .bind(q, k)
    .all<{ id: string }>();
  return results.map((r) => r.id);
}

export async function leerFragmentos(db: D1Database, ids: string[]): Promise<Fragmento[]> {
  if (!ids.length) return [];
  const { results } = await db
    .prepare(
      `SELECT f.id, f.titulo, f.url, f.texto, s.tipo FROM fragmentos f JOIN fuentes s ON s.id = f.fuente WHERE f.id IN (${ids.map(() => "?").join(", ")})`
    )
    .bind(...ids)
    .all<Fragmento>();
  const porId = new Map(results.map((r) => [r.id, r]));
  return ids.map((id) => porId.get(id)).filter((f): f is Fragmento => f !== undefined);
}
