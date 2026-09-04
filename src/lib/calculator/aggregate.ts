/**
 * Pure helper: `getRecordsForExercise`.
 *
 * Used by the per-exercise analysis view (issue 0039) to look up the
 * full record list for the exercise the coach opened. Side-effect-free.
 *
 * Note: the previous home of this module also hosted `aggregateByExercise`
 * and its `ExerciseSummary` return type, which the catalog page
 * (`/tools/weight-calculator/exercises`, issue 0042) replaced with
 * `deriveExerciseIndex` (a different shape — the full last record instead
 * of derived aggregates). The aggregate-by-exercise helper is now
 * removed; see `exercise-index.ts` for the current surface.
 */
import type { SavedWeightRecord } from "../types";

// ─── getRecordsForExercise ───────────────────────────────────────────────────

/**
 * Returns the records for a single exercise, case-insensitive match on
 * the name. Sorted by `createdAt` desc (most recent first). Returns `[]`
 * when the exercise has no records (rather than throwing).
 *
 * Mirrors the case-insensitive matching used by `dedupeExercises` and
 * `deriveExerciseIndex`, so navigating from the list to the per-exercise
 * view always finds the same set of records that produced the entry.
 */
export function getRecordsForExercise(
  records: SavedWeightRecord[],
  exerciseName: string,
): SavedWeightRecord[] {
  const target = exerciseName.trim().toLowerCase();
  if (target === "") return [];

  return records
    .filter(
      (r) => r.exercise !== null && r.exercise.toLowerCase() === target,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
