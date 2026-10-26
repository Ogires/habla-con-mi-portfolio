CREATE TABLE fuentes (
  id          TEXT PRIMARY KEY,
  tipo        TEXT NOT NULL,
  titulo      TEXT NOT NULL,
  url         TEXT NOT NULL,
  hash        TEXT NOT NULL,
  actualizada TEXT NOT NULL
);

CREATE TABLE fragmentos (
  id     TEXT PRIMARY KEY,
  fuente TEXT NOT NULL REFERENCES fuentes(id) ON DELETE CASCADE,
  orden  INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  url    TEXT NOT NULL,
  texto  TEXT NOT NULL
);

CREATE INDEX fragmentos_fuente ON fragmentos(fuente);

CREATE VIRTUAL TABLE fragmentos_fts USING fts5(
  id UNINDEXED, titulo, texto,
  tokenize = 'unicode61 remove_diacritics 2'
);
