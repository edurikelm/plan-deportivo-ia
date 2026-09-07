/**
 * Curated catalog of typical barbell / strength training exercises (issue 0043).
 *
 * This is a static, code-defined list — not persisted. The intent is to give
 * the coach a one-click "obvious" name when saving a record from the weight
 * calculator, so the input does not start empty. The coach can still type any
 * freeform name; this catalog is a hint, not a constraint.
 *
 * Shape: each entry has a canonical Spanish `name` (the string that gets
 * persisted when the coach picks the chip) and an optional `alias` in
 * English (rendered in the chip label alongside the Spanish name). The
 * `category` field is recorded for a future grouping surface and is
 * exported as a literal union so it can be type-narrowed at use sites.
 *
 * The list is intentionally limited to ~25 compound + common accessory
 * movements that any coach who trains with a barbell would recognize.
 * Specialty / niche lifts are intentionally excluded — they belong to
 * follow-up edits, not the MVP.
 */
export type ExerciseCategory =
  | "squat"
  | "hinge"
  | "push"
  | "pull"
  | "overhead"
  | "olympic"
  | "accessory";

export interface TypicalExercise {
  /** Canonical Spanish name. This is the string persisted to the record. */
  name: string;
  /** English alias (rendered in parentheses in the chip label). */
  alias?: string;
  /** Coarse category for future grouping. Not surfaced in the UI yet. */
  category: ExerciseCategory;
}

// ─── Catalog ─────────────────────────────────────────────────────────────────

export const TYPICAL_EXERCISES: readonly TypicalExercise[] = [
  // Squat pattern
  { name: "Sentadilla trasera", alias: "Back Squat", category: "squat" },
  { name: "Sentadilla frontal", alias: "Front Squat", category: "squat" },
  { name: "Sentadilla búlgara", alias: "Bulgarian Split Squat", category: "squat" },
  { name: "Zancada", alias: "Lunge", category: "squat" },

  // Hinge pattern
  { name: "Peso muerto convencional", alias: "Deadlift", category: "hinge" },
  { name: "Peso muerto sumo", alias: "Sumo Deadlift", category: "hinge" },
  { name: "Peso muerto rumano", alias: "Romanian Deadlift", category: "hinge" },
  { name: "Hip Thrust", category: "hinge" },
  { name: "Good Morning", category: "hinge" },

  // Push pattern (horizontal)
  { name: "Press banca", alias: "Bench Press", category: "push" },
  { name: "Press inclinado", alias: "Incline Bench Press", category: "push" },
  { name: "Press declinado", alias: "Decline Bench Press", category: "push" },
  { name: "Fondos", alias: "Dip", category: "push" },
  { name: "Press con mancuernas", alias: "Dumbbell Press", category: "push" },

  // Overhead
  { name: "Press militar", alias: "Overhead Press", category: "overhead" },

  // Pull pattern
  { name: "Remo con barra", alias: "Barbell Row", category: "pull" },
  { name: "Remo Pendlay", alias: "Pendlay Row", category: "pull" },
  { name: "Dominada", alias: "Pull-up", category: "pull" },
  { name: "Jalón al pecho", alias: "Lat Pulldown", category: "pull" },

  // Olympic
  { name: "Cargada", alias: "Power Clean", category: "olympic" },
  { name: "Envión", alias: "Snatch", category: "olympic" },

  // Accessory
  { name: "Curl con barra", alias: "Barbell Curl", category: "accessory" },
  { name: "Encogimiento", alias: "Shrug", category: "accessory" },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the canonical Spanish names of the typical exercises, in catalog
 * order. Used to seed the `<datalist>` of the save-record form alongside the
 * coach's own history.
 */
export function getTypicalExerciseNames(): string[] {
  return TYPICAL_EXERCISES.map((e) => e.name);
}

/**
 * Resolves a (possibly-typed) name to its typical exercise entry, comparing
 * case-insensitively against the canonical Spanish `name`. Returns `undefined`
 * when the input does not match any typical — including when the input is
 * empty or contains only whitespace.
 *
 * Used by the chip row to decide which chip should render as "active" given
 * the current value of the exercise input.
 */
export function findTypicalByName(name: string): TypicalExercise | undefined {
  const needle = name.trim().toLowerCase();
  if (needle === "") return undefined;
  return TYPICAL_EXERCISES.find((e) => e.name.toLowerCase() === needle);
}

/**
 * Merges two name lists into a single deduped list, preserving the order of
 * the first occurrence of each case-insensitive key. The first list wins on
 * ties — by design, this lets the caller pass typical names first so the
 * canonical Spanish spelling always precedes any freeform variant the coach
 * may have previously saved.
 *
 * Empty / whitespace-only entries are dropped from the output.
 */
export function mergeTypicalAndHistory(
  typicalNames: readonly string[],
  historyNames: readonly string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...typicalNames, ...historyNames]) {
    const name = raw.trim();
    if (name === "") continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}
