// src/contadores/uso.ts — nombres de instancia del DO en un solo sitio
import type { Env } from "../env";

export const LIMITE_POR_MINUTO = 10;

export function limitar(env: Env, ip: string) {
  return env.CONTADOR.get(env.CONTADOR.idFromName(`rl:pregunta:${ip}`)).consumir(LIMITE_POR_MINUTO, 60_000, Date.now());
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
