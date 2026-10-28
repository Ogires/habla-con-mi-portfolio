// src/contadores/uso.ts — nombres de instancia del DO en un solo sitio
import type { Env } from "../env";

export const LIMITE_POR_MINUTO = 10;
// LLM10: con ~3K tokens por respuesta, una sola IP vaciaba el presupuesto diario en minutos
export const LIMITE_IA_POR_DIA = 20;
const DIA_MS = 86_400_000; // la ventana fija de un día coincide con el día UTC

export function limitar(env: Env, clave: string) {
  return env.CONTADOR.get(env.CONTADOR.idFromName(`rl:pregunta:${clave}`)).consumir(LIMITE_POR_MINUTO, 60_000, Date.now());
}

export function cupoIa(env: Env, clave: string) {
  return env.CONTADOR.get(env.CONTADOR.idFromName(`ia:${clave}`)).consumir(LIMITE_IA_POR_DIA, DIA_MS, Date.now());
}

// Groq reinicia las cuotas diarias en UTC
export function fechaUtc(ahoraMs = Date.now()): string {
  return new Date(ahoraMs).toISOString().slice(0, 10);
}

const presupuesto = (env: Env, modelo: string) => env.CONTADOR.get(env.CONTADOR.idFromName(`tokens:${fechaUtc()}:${modelo}`));

export const tokensUsados = (env: Env, modelo: string) => presupuesto(env, modelo).leer();
export const sumarTokens = (env: Env, modelo: string, n: number) => presupuesto(env, modelo).sumar(n);

// Solo un agregado por día para el post de seguimiento: nunca se guardan preguntas (§5.5)
export const contarPregunta = (env: Env) => env.CONTADOR.get(env.CONTADOR.idFromName(`preguntas:${fechaUtc()}`)).sumar(1);
