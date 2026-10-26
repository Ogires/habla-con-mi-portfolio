// Reciprocal Rank Fusion (k = 60, el valor del artículo original)
export interface Coincidencia {
  id: string;
  score: number;
}

export type Origen = "vector" | "texto" | "ambos";

export interface Fusionado {
  id: string;
  puntuacion: number;
  origen: Origen;
}

const K = 60;

export function fusionarRrf(vector: Coincidencia[], texto: string[], n = 5): Fusionado[] {
  const mapa = new Map<string, Fusionado>();
  const sumar = (id: string, posicion: number, origen: Exclude<Origen, "ambos">) => {
    const puntos = 1 / (K + posicion + 1);
    const actual = mapa.get(id);
    if (!actual) return void mapa.set(id, { id, puntuacion: puntos, origen });
    actual.puntuacion += puntos;
    if (actual.origen !== origen) actual.origen = "ambos";
  };
  vector.forEach((c, i) => sumar(c.id, i, "vector"));
  texto.forEach((id, i) => sumar(id, i, "texto"));
  return [...mapa.values()].sort((a, b) => b.puntuacion - a.puntuacion || a.id.localeCompare(b.id)).slice(0, n);
}

// "Permitir no lo sé": lo vectorial siempre devuelve algo; por debajo del umbral no cuenta
export const filtrarPorUmbral = (vector: Coincidencia[], umbral: number) => vector.filter((c) => c.score >= umbral);
