// scripts/ingesta.mjs — §4 del diseño. Corre SOLO en el PC de Sergio (nunca en CI): npm run ingesta
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buscarDatosPersonales } from "./lib/pii.mjs";
import { extraerPost, filtrarSecciones, hashFuente, idFragmento, idsRepetidos, planificar } from "./lib/fuentes.mjs";
import { slugGithub, trocear } from "./lib/troceo.mjs";
import { abrirCloudflare } from "./lib/embeddings.mjs";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ruta = (...partes) => join(RAIZ, ...partes);
const INDICE = "portfolio-bge-m3";
const DB = "habla-con-mi-portfolio";
const TMP = ruta(".wrangler", "ingesta"); // gitignored: contiene texto ya filtrado, pero no se versiona
const WRANGLER_JS = ruta("node_modules", "wrangler", "bin", "wrangler.js");

// Solo quita comentarios de línea completa: un `//` dentro de una cadena (las URLs) no está al
// principio de la línea y se conserva. No admite comentarios al final de una línea con datos
export function leerModelo(jsonc) {
  return JSON.parse(jsonc.replace(/^\s*\/\/.*$/gm, "")).vars.MODELO_EMBEDDINGS;
}

// node + wrangler.js en vez de `npx` con shell: true. Con la shell, Node concatena los argumentos
// sin escaparlos (y en Node 24 avisa con DEP0190): cmd.exe interpretaría &, |, ^ o % del SQL
const wrangler = (args, opciones = {}) =>
  execFileSync(process.execPath, [WRANGLER_JS, ...args], { cwd: RAIZ, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opciones });

const sql = (s) => `'${String(s).replaceAll("'", "''")}'`;

function d1Json(comando) {
  const salida = wrangler(["d1", "execute", DB, "--remote", "--json", "--command", comando]);
  return JSON.parse(salida.slice(salida.indexOf("["))).flatMap((r) => r.results ?? []);
}

const ghRaw = (repo, fichero) =>
  execFileSync("gh", ["api", `repos/${repo}/contents/${fichero}`, "-H", "Accept: application/vnd.github.raw"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });

export function fuenteGaleria(apps) {
  return {
    id: "galeria",
    tipo: "galeria",
    titulo: "Galería de la factoría",
    url: "https://webninja.fyi/#galeria",
    texto: apps
      .map((a) => `## ${a.nombre}\n${a.nombre}: ${a.frase} Tipo: ${a.tipo === "web" ? "web" : "extensión de Chrome"}. Stack: ${a.stack.join(", ")}. Demo: ${a.demo}. Código: ${a.repo}. Lanzada en ${a.lanzada}.`)
      .join("\n\n"),
    anclar: false,
    // Cada app ocupa ~35 palabras: con el mínimo de 40 de trocear se fundirían varias apps en un
    // fragmento con el título de la primera. Un fragmento por app
    minimo: 0,
  };
}

export function fuentesPublicas({ repos }, apps, leer = ghRaw) {
  const out = [];
  for (const { repo, titulo, ficheros } of repos) {
    for (const fichero of ficheros) {
      const nombre = repo.split("/")[1];
      const esReadme = fichero === "README.md";
      out.push({
        id: `${nombre}/${fichero}`,
        tipo: esReadme ? "repo" : "doc",
        titulo: `${titulo} · ${esReadme ? "README" : "Diseño"}`,
        url: `https://github.com/${repo}/blob/main/${fichero}`,
        texto: leer(repo, fichero),
        anclar: true,
      });
    }
  }
  out.push(fuenteGaleria(apps));
  return out;
}

function fuentesPrivadas(config) {
  return config.fuentes.map((f) => {
    let texto = readFileSync(f.ruta, "utf8");
    if (f.modo === "post") {
      texto = extraerPost(texto) ?? (() => { throw new Error(`${f.id}: no encuentro el bloque del post`); })();
      console.log(`${f.id}: «${texto.slice(0, 70).replace(/\s+/g, " ")}…»`); // revisa que es el post y no otro bloque
    }
    if (f.incluir) texto = filtrarSecciones(texto, f.incluir);
    return { id: f.id, tipo: f.tipo, titulo: f.titulo, url: f.url, texto, anclar: false };
  });
}

export function hallazgosPersonales(fuentes, permitidos = []) {
  return fuentes.flatMap((f) => buscarDatosPersonales(f.texto, permitidos).map((h) => `${f.id}:${h.linea} (${h.tipo})`));
}

export async function fragmentar(fuentes) {
  const fragmentos = [];
  for (const f of fuentes) {
    const opciones = f.minimo === undefined ? {} : { minimo: f.minimo };
    for (const [orden, t] of trocear(f.texto, opciones).entries()) {
      fragmentos.push({
        id: await idFragmento(f.id, orden),
        fuente: f.id,
        orden,
        titulo: t.titulo ? `${f.titulo} · ${t.titulo}` : f.titulo,
        url: f.anclar && t.titulo ? `${f.url}#${slugGithub(t.titulo)}` : f.url,
        texto: t.texto,
      });
    }
  }
  return fragmentos;
}

async function main() {
  const config = JSON.parse(readFileSync(ruta("fuentes.local.json"), "utf8"));
  const { apps } = JSON.parse(readFileSync(ruta("public", "apps.json"), "utf8"));
  const fuentes = [...fuentesPublicas(JSON.parse(readFileSync(ruta("data", "fuentes.json"), "utf8")), apps), ...fuentesPrivadas(config)];

  const repetidos = idsRepetidos(fuentes);
  if (repetidos.length) {
    console.error(`Ingesta abortada: ids de fuente repetidos: ${repetidos.join(", ")}`);
    process.exit(1);
  }

  // §5.1: un solo dato personal aborta TODO antes de subir nada
  const hallazgos = hallazgosPersonales(fuentes, config.permitidos);
  if (hallazgos.length) {
    console.error(`Ingesta abortada: posibles datos personales en\n  ${hallazgos.join("\n  ")}\nRevísalos o añádelos a "permitidos" si son públicos.`);
    process.exit(1);
  }

  const ahora = new Map();
  for (const f of fuentes) ahora.set(f.id, await hashFuente(f));
  const antes = new Map(d1Json("SELECT id, hash FROM fuentes").map((r) => [r.id, r.hash]));
  const plan = planificar(antes, ahora);
  console.log(`Nuevas ${plan.nuevas.length} · cambiadas ${plan.cambiadas.length} · borradas ${plan.borradas.length} · iguales ${plan.iguales.length}`);

  const tocadas = [...plan.cambiadas, ...plan.borradas];
  if (!tocadas.length && !plan.nuevas.length) return console.log("Nada que hacer.");
  const idsViejos = tocadas.length ? d1Json(`SELECT id FROM fragmentos WHERE fuente IN (${tocadas.map(sql).join(", ")})`).map((r) => r.id) : [];

  const fragmentos = await fragmentar(fuentes.filter((f) => plan.nuevas.includes(f.id) || plan.cambiadas.includes(f.id)));
  const idsNuevos = new Set(fragmentos.map((fr) => fr.id));
  // El upsert sobrescribe los ids que se repiten; solo sobran los de fragmentos que ya no existen
  const idsSobrantes = idsViejos.filter((id) => !idsNuevos.has(id));

  mkdirSync(TMP, { recursive: true });
  const cf = await abrirCloudflare(leerModelo(readFileSync(ruta("wrangler.jsonc"), "utf8")), ruta("wrangler.jsonc"));
  try {
    // Orden: embeddings (sin efectos) → Vectorize (upsert idempotente) → D1 → borrado de sobrantes.
    // D1 guarda el hash de cada fuente, así que va al final: si algo falla antes, D1 sigue con el
    // hash viejo y relanzar la ingesta lo repite todo. Si fallase el último borrado, los vectores
    // huérfanos no hacen daño: el Worker los descarta al no encontrarlos en D1
    if (fragmentos.length) {
      const vectores = await cf.embeber(fragmentos.map((fr) => `${fr.titulo}\n${fr.texto}`));
      writeFileSync(join(TMP, "vectores.ndjson"), fragmentos.map((fr, i) => JSON.stringify({ id: fr.id, values: vectores[i] })).join("\n"));
      wrangler(["vectorize", "upsert", INDICE, "--file", join(TMP, "vectores.ndjson")], { stdio: "inherit" });
    }

    const sentencias = [];
    for (const id of tocadas) {
      sentencias.push(`DELETE FROM fragmentos_fts WHERE id IN (SELECT id FROM fragmentos WHERE fuente = ${sql(id)});`);
      sentencias.push(`DELETE FROM fuentes WHERE id = ${sql(id)};`); // ON DELETE CASCADE borra sus fragmentos
    }
    const fecha = new Date().toISOString();
    for (const f of fuentes.filter((x) => plan.nuevas.includes(x.id) || plan.cambiadas.includes(x.id))) {
      sentencias.push(`INSERT INTO fuentes (id, tipo, titulo, url, hash, actualizada) VALUES (${[f.id, f.tipo, f.titulo, f.url, ahora.get(f.id), fecha].map(sql).join(", ")});`);
    }
    for (const fr of fragmentos) {
      sentencias.push(`INSERT INTO fragmentos (id, fuente, orden, titulo, url, texto) VALUES (${[fr.id, fr.fuente, fr.orden, fr.titulo, fr.url, fr.texto].map(sql).join(", ")});`);
      sentencias.push(`INSERT INTO fragmentos_fts (id, titulo, texto) VALUES (${[fr.id, fr.titulo, fr.texto].map(sql).join(", ")});`);
    }
    writeFileSync(join(TMP, "ingesta.sql"), sentencias.join("\n"));
    wrangler(["d1", "execute", DB, "--remote", "--file", join(TMP, "ingesta.sql"), "--yes"], { stdio: "inherit" });

    // Por lotes de 100 ids (~1.900 caracteres por llamada)
    for (let i = 0; i < idsSobrantes.length; i += 100) {
      wrangler(["vectorize", "delete-vectors", INDICE, "--ids", ...idsSobrantes.slice(i, i + 100)], { stdio: "inherit" });
    }
    console.log(`Listo: ${fragmentos.length} fragmentos indexados, ${idsSobrantes.length} vectores sobrantes borrados.`);
    console.log("Vectorize es eventualmente consistente: los vectores tardan unos segundos en aparecer en las consultas.");
  } finally {
    await cf.cerrar();
  }
}

// Solo al ejecutarlo (`npm run ingesta`); al importarlo (pruebas) no toca nada. Sin distinguir
// mayúsculas: en Windows `f:\` y `F:\` son la misma ruta
const esPrincipal = process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === resolve(process.argv[1]).toLowerCase();
if (esPrincipal) await main();
