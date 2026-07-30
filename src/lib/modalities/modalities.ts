/**
 * Shared modality constants.
 *
 * This file contains only plain values (no Node.js built-ins, no React).
 * Safe to import from both server and client contexts.
 */
import type { Modality } from "./crossfit-schemas";

export { type Modality };

export const MODALITIES: readonly Modality[] = [
  {
    id: "crossfit",
    label: "CrossFit",
    description:
      "Cuatro fases: Warm-Up, Strength/Skill, WOD y Cool Down. Genera sesiones equilibradas con formato AMRAP, EMOM, For Time, Tabata o Intervalos.",
    accent: "signal",
    iconKey: "Dumbbell",
  },
] as const;

export function getModality(id: string): Modality | undefined {
  return MODALITIES.find((m) => m.id === id);
}
