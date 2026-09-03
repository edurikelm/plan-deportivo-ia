/**
 * Pure helper: suggests a reps default for the save form based on the
 * coach's most recent set of the same exercise.
 *
 * Rules (from the manual save form spec, issue 0037):
 *  - No previous records for the exercise → 1
 *  - Most recent record had `reps === 1` → 1 (coach is in a "singles" cycle)
 *  - Most recent record had `reps > 1` → `max(5, lastReps)`
 *    - Floor of 5 is the "hypertrophy" range; we don't suggest less than that
 *      when the coach has been doing multi-rep work.
 *    - If the coach was already at 8 reps, we don't drop them back to 5 —
 *      we keep their current working set.
 *  - Records with `reps === null` (legacy) and records with
 *    `exercise === null` (auto-log) are ignored — no data to learn from.
 *
 * Side-effect-free. Tested in `suggest-reps.test.ts`.
 */
import type { SavedWeightRecord } from "../types";

/** Floor for the "multi-rep" suggestion. Below this we round up to 5. */
const MULTI_REP_FLOOR = 5;

/** Default suggestion when no usable prior record exists. */
const NO_DATA_DEFAULT = 1;

export function suggestRepsForExercise(
  records: SavedWeightRecord[],
  exerciseName: string,
): number {
  const target = exerciseName.trim().toLowerCase();
  if (target === "") return NO_DATA_DEFAULT;

  // Find the most recent record for this exercise with a usable reps value.
  // We sort the filtered subset by createdAt desc and take the first.
  const lastRecord = records
    .filter(
      (r) =>
        r.exercise !== null &&
        r.reps !== null &&
        r.exercise.toLowerCase() === target,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (!lastRecord || lastRecord.reps === null) return NO_DATA_DEFAULT;
  if (lastRecord.reps === 1) return 1;
  return Math.max(MULTI_REP_FLOOR, lastRecord.reps);
}
