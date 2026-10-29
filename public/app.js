// public/app.js — chat en streaming + galería. TODO texto del modelo va por textContent (LLM05)
import { bloques } from "./render.js";

const $ = (s) => document.querySelector(s);
const estado = { historial: [], enCurso: false, turnos: 0 };
const form = $("#form-pregunta");
const input = $("#pregunta");
const conversacion = $("#conversacion");
const ORIGEN = { vector: "búsqueda semántica", texto: "palabras clave", ambos: "semántica y palabras clave" };
// El servidor ya corta a los 15 s sin datos de Groq; esto cubre la red. Holgado porque antes de las
// cabeceras la cadena puede probar hasta 3 modelos con 8 s de margen cada uno
const INACTIVIDAD_MS = 45_000;

const el = (tag, clase, texto) => {
  const n = document.createElement(tag);
  if (clase) n.className = clase;
  if (texto !== undefined) n.textContent = texto;
  return n;
};

// Solo https: un dato corrupto nunca se convierte en javascript: ni similares
const urlSegura = (u) => (typeof u === "string" && u.startsWith("https://") ? u : null);

async function* eventosSse(cuerpo) {
  const lector = cuerpo.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await lector.read();
    if (done) return;
    buffer += value;
    let i;
    while ((i = buffer.indexOf("\n\n")) >= 0) {
      const bloque = buffer.slice(0, i);
      buffer = buffer.slice(i + 2);
      const evento = /^event: (.+)$/m.exec(bloque)?.[1];
      const dato = /^data: (.+)$/m.exec(bloque)?.[1];
      if (evento && dato) yield { evento, datos: JSON.parse(dato) };
    }
  }
}

function crearTurno(pregunta) {
  const id = ++estado.turnos;
  const art = el("article", "turno");
  art.append(el("p", "turno__pregunta", pregunta));
  const respuesta = el("div", "turno__respuesta");
  respuesta.setAttribute("aria-live", "polite");
  respuesta.append(el("p", "turno__buscando", "Buscando en el portfolio…"));
  const listaFuentes = el("ol", "turno__fuentes");
  const origen = el("details", "turno__origen");
  origen.hidden = true;
  const aviso = el("p", "turno__aviso");
  aviso.hidden = true;
  art.append(respuesta, listaFuentes, origen, aviso);
  conversacion.append(art);
  art.scrollIntoView({ behavior: "smooth", block: "start" });

  let fuentes = [];
  const anclaFuente = (n) => `fuente-${id}-${n}`;

  function pintarSegmentos(padre, segs) {
    for (const s of segs) {
      if (s.tipo === "texto") padre.append(document.createTextNode(s.valor));
      else if (s.tipo === "negrita") padre.append(el("strong", null, s.valor));
      else if (s.tipo === "cursiva") padre.append(el("em", null, s.valor));
      else if (s.tipo === "codigo") padre.append(el("code", null, s.valor));
      else if (fuentes.some((f) => f.n === s.n)) {
        const a = el("a", "cita", `[${s.n}]`);
        a.href = `#${anclaFuente(s.n)}`;
        a.dataset.n = String(s.n);
        padre.append(a);
      } else padre.append(el("span", "cita cita--invalida", `[${s.n}]`));
    }
  }

  return {
    fuentes(lista) {
      fuentes = lista;
      listaFuentes.replaceChildren(
        ...lista.map((f) => {
          const li = el("li", "fuente");
          li.id = anclaFuente(f.n);
          const url = urlSegura(f.url);
          const a = el(url ? "a" : "span", "fuente__titulo", `[${f.n}] ${f.titulo}`);
          if (url) Object.assign(a, { href: url, target: "_blank", rel: "noopener noreferrer" });
          li.append(a, el("span", "fuente__tipo", f.tipo));
          return li;
        })
      );
      if (lista.length) {
        origen.replaceChildren(
          el("summary", null, "¿De dónde sale esta respuesta?"),
          ...lista.map((f) => {
            const p = el("p", "origen__item");
            p.append(el("strong", null, `[${f.n}] ${ORIGEN[f.origen] ?? f.origen}: `), document.createTextNode(f.extracto));
            return p;
          })
        );
        origen.hidden = false;
      }
    },
    texto(completo) {
      respuesta.replaceChildren(
        ...bloques(completo).map((b) => {
          if (b.tipo === "lista") {
            const ul = el("ul");
            for (const item of b.items) {
              const li = el("li");
              pintarSegmentos(li, item);
              ul.append(li);
            }
            return ul;
          }
          const p = el("p");
          pintarSegmentos(p, b.segmentos);
          return p;
        })
      );
    },
    fin(datos) {
      if (datos.degradado) art.classList.add("turno--degradado");
      for (const n of datos.citasDudosas ?? []) {
        for (const a of respuesta.querySelectorAll(`.cita[data-n="${n}"]`)) {
          a.classList.add("cita--dudosa");
          a.title = "Cita sin respaldo claro en la fuente";
        }
      }
      const avisos = [];
      if (datos.truncada) avisos.push("La respuesta se ha cortado: puede estar incompleta.");
      if (datos.sinFuente) avisos.push("Esta respuesta no cita ninguna fuente: verifícala.");
      if (avisos.length) this.aviso(avisos.join(" "));
    },
    aviso(mensaje) {
      aviso.textContent = mensaje;
      aviso.hidden = false;
      respuesta.querySelector(".turno__buscando")?.remove();
    },
  };
}

async function preguntar(texto) {
  if (estado.enCurso || !texto.trim()) return;
  estado.enCurso = true;
  form.classList.add("ocupado");
  input.value = "";
  const turno = crearTurno(texto);
  let respuesta = "";
  // Sin esto, un stream que se queda colgado dejaría el chat bloqueado en "Buscando…"
  const control = new AbortController();
  let vigilante;
  const rearmar = () => {
    clearTimeout(vigilante);
    vigilante = setTimeout(() => control.abort(), INACTIVIDAD_MS);
  };
  try {
    rearmar();
    const r = await fetch("/api/pregunta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pregunta: texto, historial: estado.historial }),
      signal: control.signal,
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      turno.aviso(e.mensaje ?? "Algo ha fallado. Prueba otra vez.");
      return;
    }
    for await (const { evento, datos } of eventosSse(r.body)) {
      rearmar();
      if (evento === "fuentes") turno.fuentes(datos);
      else if (evento === "texto") turno.texto((respuesta += datos.t));
      else if (evento === "fin") turno.fin(datos);
      else if (evento === "error") turno.aviso(datos.mensaje);
    }
    // Solo las preguntas: el servidor no se fía de una respuesta que le devuelva el navegador
    estado.historial = [...estado.historial, { p: texto.slice(0, 300) }].slice(-2);
    $("#nueva").hidden = false;
  } catch {
    turno.aviso("Se ha perdido la conexión. Prueba otra vez.");
  } finally {
    clearTimeout(vigilante);
    estado.enCurso = false;
    form.classList.remove("ocupado");
    input.focus();
  }
}

async function cargarGaleria() {
  const r = await fetch("/apps.json");
  const { perfil, apps } = await r.json();
  $("#nombre").textContent = perfil.nombre;
  $("#rol").textContent = perfil.rol;
  const linkedin = urlSegura(perfil.linkedin);
  if (linkedin) $("#enlace-linkedin").href = linkedin;
  const github = urlSegura(perfil.github);
  if (github) $("#enlace-github").href = github;
  $("#apps").replaceChildren(
    ...apps.map((a) => {
      const li = el("li", "app");
      li.style.setProperty("--color-app", a.color);
      li.append(el("h3", null, a.nombre), el("p", "app__frase", a.frase));
      const etiquetas = el("ul", "app__stack");
      etiquetas.append(...a.stack.map((s) => el("li", null, s)));
      const acciones = el("div", "app__acciones");
      for (const [texto, url] of [[a.tipo === "web" ? "Demo" : "Chrome Web Store", a.demo], ["Código", a.repo]]) {
        const enlace = el("a", null, texto);
        Object.assign(enlace, { href: urlSegura(url) ?? "#", target: "_blank", rel: "noopener noreferrer" });
        acciones.append(enlace);
      }
      const boton = el("button", "app__preguntar", "Pregúntale por esta app");
      boton.type = "button";
      boton.addEventListener("click", () => {
        $("#chat").scrollIntoView({ behavior: "smooth" });
        preguntar(`¿Cómo está hecha ${a.nombre}?`);
      });
      acciones.append(boton);
      li.append(etiquetas, acciones);
      return li;
    })
  );
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  preguntar(input.value);
});
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});
for (const b of document.querySelectorAll("#ejemplos button")) b.addEventListener("click", () => preguntar(b.dataset.pregunta));
$("#nueva").addEventListener("click", () => {
  estado.historial = [];
  conversacion.replaceChildren();
  $("#nueva").hidden = true;
  input.focus();
});
cargarGaleria().catch(() => {});
