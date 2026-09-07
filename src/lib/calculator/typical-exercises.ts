/**
 * Curated catalog of typical barbell / strength training exercises (issue 0043,
 * revised by issue 0044).
 *
 * This is a static, code-defined list — not persisted. Its sole purpose in the
 * current scope is to **seed the `<datalist>` autocomplete** of the weight
 * calculator's save form with a sensible list of common lifts, so that the
 * coach gets useful suggestions even when their history is empty.
 *
 * As of 0044 the visible "chips" row in the form is driven by the coach's own
 * favorites (see `lib/calculator/favorites.ts`), not by this catalog. The
 * catalog still feeds the datalist, so the canonical names here are what
 * coaches see when they start typing in the empty form.
 *
 * Shape: each entry has a canonical English `name` (the string the form will
 * match against) and a `category` for a future grouping surface. Names use
 * the standard English stronglifting / powerlifting nomenclature — this is
 * the same vocabulary the existing placeholder ("Ej. Back Squat") already
 * invites, and the field's `dedupeExercises` makes capitalization tolerant
 * regardless.
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
  /** Canonical English name. This is the string matched against typed input. */
  name: string;
  /** Coarse category for future grouping. Not surfaced in the UI yet. */
  category: ExerciseCategory;
}

// ─── Catalog ─────────────────────────────────────────────────────────────────

export const TYPICAL_EXERCISES: readonly TypicalExercise[] = [
  // Squat pattern
  { name: "Back Squat", category: "squat" },
  { name: "Front Squat", category: "squat" },
  { name: "Bulgarian Split Squat", category: "squat" },
  { name: "Lunge", category: "squat" },

  // Hinge pattern
  { name: "Conventional Deadlift", category: "hinge" },
  { name: "Sumo Deadlift", category: "hinge" },
  { name: "Romanian Deadlift", category: "hinge" },
  { name: "Hip Thrust", category: "hinge" },
  { name: "Good Morning", category: "hinge" },

  // Push pattern (horizontal)
  { name: "Bench Press", category: "push" },
  { name: "Incline Bench Press", category: "push" },
  { name: "Decline Bench Press", category: "push" },
  { name: "Dip", category: "push" },
  { name: "Dumbbell Bench Press", category: "push" },

  // Overhead
  { name: "Overhead Press", category: "overhead" },

  // Pull pattern
  { name: "Barbell Row", category: "pull" },
  { name: "Pendlay Row", category: "pull" },
  { name: "Pull-up", category: "pull" },
  { name: "Lat Pulldown", category: "pull" },

  // Olympic
  { name: "Power Clean", category: "olympic" },
  { name: "Power Snatch", category: "olympic" },

  // Accessory
  { name: "Barbell Curl", category: "accessory" },
  { name: "Barbell Shrug", category: "accessory" },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the canonical English names of the typical exercises, in catalog
 * order. Used to seed the `<datalist>` of the save-record form alongside the
 * coach's own history.
 */
export function getTypicalExerciseNames(): string[] {
  return TYPICAL_EXERCISES.map((e) => e.name);
}

/**
 * Resolves a (possibly-typed) name to its typical exercise entry, comparing
 * case-insensitively against the canonical `name`. Returns `undefined` when
 * the input does not match any typical — including when the input is empty
 * or contains only whitespace.
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
 * canonical English spelling always precedes any freeform variant the coach
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
