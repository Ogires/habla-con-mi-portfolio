import { applyD1Migrations, env } from "cloudflare:test";
import datos from "./fixtures/fragmentos.json";

// Idempotente: el setup corre una vez por fichero de test. fuentes/fragmentos con INSERT OR REPLACE;
// la tabla FTS5 no tiene clave primaria, así que se vacía antes de rellenarla
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
await env.DB.prepare("DELETE FROM fragmentos_fts").run();
await env.DB.batch(
  datos.flatMap(({ fuente, fragmentos }) => [
    env.DB.prepare("INSERT OR REPLACE INTO fuentes (id, tipo, titulo, url, hash, actualizada) VALUES (?, ?, ?, ?, 'h', '2026-10-26T00:00:00Z')").bind(
      fuente.id,
      fuente.tipo,
      fuente.titulo,
      fuente.url
    ),
    ...fragmentos.flatMap((f, i) => [
      env.DB.prepare("INSERT OR REPLACE INTO fragmentos (id, fuente, orden, titulo, url, texto) VALUES (?, ?, ?, ?, ?, ?)").bind(f.id, fuente.id, i, f.titulo, f.url, f.texto),
      env.DB.prepare("INSERT INTO fragmentos_fts (id, titulo, texto) VALUES (?, ?, ?)").bind(f.id, f.titulo, f.texto),
    ]),
  ])
);
