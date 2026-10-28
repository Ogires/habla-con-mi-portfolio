// §5.3: imita las garantías de la API Citations en el servidor
import { FRASE_NO_APARECE } from "./respuestas";
import { normalizarTexto, terminosSignificativos } from "./texto";

export interface AnalisisCitas {
  validas: number[];
  fueraDeRango: number[];
  dudosas: number[];
  sinFuente: boolean;
}

const CITA = /\[(\d{1,2})\]/g;
// Sin \s* al final del grupo: los espacios entre dos citas solo pueden ir a un sitio. Con
// /^(\s*\[n\]\s*)+$/ el reparto era ambiguo y "[1]   " × 13 + "x" tardaba 1 s (ReDoS)
const SOLO_CITAS = /^(?:\s*\[\d{1,2}\])+\s*$/;

// Frases; una "frase" que solo tiene citas ("... limit. [1]") se pega a la anterior
function frases(texto: string): string[] {
  const out: string[] = [];
  for (const trozo of texto.split(/(?<=[.!?])\s+|\n+/)) {
    if (!trozo.trim()) continue;
    if (SOLO_CITAS.test(trozo) && out.length) out[out.length - 1] += " " + trozo;
    else out.push(trozo);
  }
  return out;
}

const ordenar = (s: Set<number>) => [...s].sort((a, b) => a - b);

// gpt-oss a veces cita al estilo interno de OpenAI, 【3】 o 【3†L1-L4】, en vez de [3]
const CITA_ANCHA = /【\s{0,2}(\d{1,2})\s{0,2}(?:†[^】]{0,20})?】/g;
const MAX_CITA_ANCHA = 30; // la cita ancha más larga que casa: 29 caracteres

// Se aplica a los deltas del stream, así que una cita puede llegar partida ("D1 【" + "1】"): lo que
// va desde un 【 sin cerrar se retiene hasta el siguiente delta, y como mucho MAX_CITA_ANCHA
export function normalizadorCitas() {
  let pendiente = "";
  return {
    empujar(trozo: string): string {
      const t = (pendiente + trozo).replace(CITA_ANCHA, "[$1]");
      const i = t.lastIndexOf("【");
      pendiente = i >= 0 && !t.includes("】", i) && t.length - i < MAX_CITA_ANCHA ? t.slice(i) : "";
      return pendiente ? t.slice(0, i) : t;
    },
    vaciar(): string {
      const t = pendiente;
      pendiente = "";
      return t;
    },
  };
}

export function analizarCitas(respuesta: string, fragmentos: { n: number; texto: string }[]): AnalisisCitas {
  const terminosDe = new Map(fragmentos.map((f) => [f.n, new Set(terminosSignificativos(f.texto))]));
  const validas = new Set<number>();
  const fuera = new Set<number>();
  const dudosas = new Set<number>();
  for (const frase of frases(respuesta)) {
    const ns = [...frase.matchAll(CITA)].map((m) => Number(m[1]));
    if (!ns.length) continue;
    const terminos = terminosSignificativos(frase.replace(CITA, " "));
    for (const n of ns) {
      const delFragmento = terminosDe.get(n);
      if (!delFragmento) {
        fuera.add(n);
        continue;
      }
      validas.add(n);
      // Respaldo heurístico: la frase debe compartir al menos un término significativo con su fragmento
      if (!terminos.some((t) => delFragmento.has(t))) dudosas.add(n);
    }
  }
  const noAparece = normalizarTexto(respuesta).includes(normalizarTexto(FRASE_NO_APARECE));
  return { validas: ordenar(validas), fueraDeRango: ordenar(fuera), dudosas: ordenar(dudosas), sinFuente: validas.size === 0 && !noAparece };
}
