import type { Clase } from "./types";

/**
 * Builds the system prompt derived from a Clase.
 * Matches the template in CONTEXT.md § Construcción del Prompt.
 */
export function buildSystemPrompt(clase: Clase): string {
  return [
    `Sos un coach deportivo. Trabajás exclusivamente dentro del marco de la clase`,
    `"${clase.name}". Reglas:`,
    "",
    "- Estructura obligatoria (respetá este orden y estos títulos):",
    `  ${clase.structure}`,
    "",
    "- Ejercicios disponibles (preferí estos salvo que el usuario pida otro):",
    `  ${clase.exercises.join(", ")}`,
    "",
    `- Duración objetivo: ${clase.durationMinutes} min.`,
  ].join("\n");
}

/**
 * Builds the user prompt for idea generation.
 * focus is optional; if falsy, uses literal "ninguno".
 * Matches the template in CONTEXT.md § Construcción del Prompt.
 */
export function buildUserPrompt(clase: Clase, focus?: string): string {
  const foco = focus ?? "ninguno";
  return [
    `Generá una idea de sesión para esta clase.`,
    `Foco de hoy (opcional): ${foco}.`,
  ].join("\n");
}
