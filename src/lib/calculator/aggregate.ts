/**
 * Pure helpers for per-exercise aggregation.
 *
 * Used by the refactored `/history` list (issue 0038) and the per-exercise
 * analysis view (issue 0039). Side-effect-free.
 */
import type { SavedWeightRecord } from "../types";
import { aggregateExerciseOneRepMax } from "./one-rm";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExerciseSummary {
  /**
   * The exercise's display name. Case-preserving: the capitalization of
   * the most recent matching record wins (matches the "most-recent-wins"
   * convention from `dedupeExercises`).
   */
  name: string;
  /** Number of records for this exercise. */
  recordCount: number;
  /** ISO timestamp of the most recent record. */
  lastRecordAt: string;
  /** `totalKg` of the most recent record. */
  lastTotalKg: number;
  /**
   * Best single-rep totalKg observed for this exercise (only considers
   * records with `reps === 1`). 0 if none — `estimatedOneRmKg` is the
   * primary signal in that case.
   */
  bestTotalKg: number;
  /**
   * Epley-pieceswise 1RM estimate (or `null` if no usable data — see
   * `aggregateExerciseOneRepMax` for the contract).
   */
  estimatedOneRmKg: number | null;
}

// ─── aggregateByExercise ─────────────────────────────────────────────────────

/**
 * Groups records by exercise name (case-insensitive dedupe) and produces
 * a `ExerciseSummary` per unique exercise. Sorted by `lastRecordAt` desc
 * (most recently used exercises first).
 *
 * Records with `exercise === null` (auto-log, foto) are excluded — they
 * have no exercise identity to group by.
 */
export function aggregateByExercise(
  records: SavedWeightRecord[],
): ExerciseSummary[] {
  // First, find all records with a non-null exercise. We index them by
  // the lowercased name (the dedupe key) and preserve the original
  // capitalization for display.
  const eligible = records.filter(
    (r): r is SavedWeightRecord & { exercise: string } => r.exercise !== null,
  );

  // Group by lowercased name. Within each group, sort by createdAt desc
  // so the "most recent" record is index 0. The Map's value type is the
  // narrowed `SavedWeightRecord & { exercise: string }` (not the wider
  // `SavedWeightRecord`) so we can read `mostRecent.exercise` as `string`
  // without an extra cast.
  const groups = new Map<
    string,
    Array<SavedWeightRecord & { exercise: string }>
  >();
  for (const record of eligible) {
    const key = record.exercise.toLowerCase();
    const group = groups.get(key);
    if (group) {
      group.push(record);
    } else {
      groups.set(key, [record]);
    }
  }

  const summaries: ExerciseSummary[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const mostRecent = group[0];

    const bestTotalKg = group.reduce((max, r) => {
      if (r.reps !== 1) return max;
      return Math.max(max, r.totalKg);
    }, 0);

    summaries.push({
      name: mostRecent.exercise,
      recordCount: group.length,
      lastRecordAt: mostRecent.createdAt,
      lastTotalKg: mostRecent.totalKg,
      bestTotalKg,
      estimatedOneRmKg: aggregateExerciseOneRepMax(group),
    });
  }

  // Sort the summary list by most recent activity (most recent exercise
  // training session at the top).
  summaries.sort((a, b) => b.lastRecordAt.localeCompare(a.lastRecordAt));
  return summaries;
}

// ─── getRecordsForExercise ───────────────────────────────────────────────────

/**
 * Returns the records for a single exercise, case-insensitive match on
 * the name. Sorted by `createdAt` desc (most recent first). Returns `[]`
 * when the exercise has no records (rather than throwing).
 *
 * Mirrors the case-insensitive matching used by `aggregateByExercise`
 * and `dedupeExercises`, so navigating from the list to the per-exercise
 * view always finds the same set of records that produced the summary.
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
