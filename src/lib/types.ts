export type Level = "beginner" | "intermediate" | "advanced";

export interface PlanInput {
  sport: string;
  level: Level;
  daysPerWeek: number;
  sessionMinutes: number;
  goals: string[];
  equipment: string;
  notes?: string;
}

export interface GeneratedPlan {
  id: string;
  createdAt: string;
  input: PlanInput;
  content: string;
  model: string;
}

export const LEVEL_LABELS: Record<Level, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

export const GOAL_OPTIONS = [
  "Hipertrofia",
  "Fuerza",
  "Resistencia",
  "Movilidad",
  "Pérdida de peso",
  "Rehabilitación",
  "Velocidad",
  "Coordinación",
] as const;

export const MAX_HISTORY = 20;

export const DEFAULT_STRUCTURE = `# Plan de {sport} — {level}

**Frecuencia:** {daysPerWeek} días/semana
**Duración por sesión:** {sessionMinutes} min
**Objetivos:** {goals}

---

## Semana 1

### Día 1 — Pierna
- **Calentamiento (10 min):** movilidad articular + activación glúteo/isquios.
- **Bloque principal (40 min):** sentadilla, peso muerto rumano, zancadas, prensa.
- **Cool-down (10 min):** estiramiento estático + foam roller.

### Día 2 — Upper
- **Calentamiento (10 min):** bandas, push-ups escalados.
- **Bloque principal (40 min):** press banca, remo, press militar, curl bíceps.
- **Cool-down (10 min):** estiramiento de pectoral, dorsal y bíceps.

### Día 3 — Full body metabólico
- **Calentamiento (10 min):** salto de cuerda + movilidad.
- **Bloque principal (40 min):** circuito 4 rondas (kettlebell swing, burpees, pull-ups, box jump).
- **Cool-down (10 min):** respiración diafragmática.

## Semana 2 (progresión)

[Sigue el mismo patrón, sumando carga o volumen]

## Notas del coach
{notes}
`;
