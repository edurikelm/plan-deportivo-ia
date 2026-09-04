/**
 * Pure helpers for the `/tools/weight-calculator/exercises` page.
 *
 * Backs the entry list above the per-exercise analysis view (0039). The
 * page shows one card per *unique* exercise, surfacing the most recent
 * record (date, weight, source, 1RM flag) so the coach can scan the
 * catalog without opening each exercise.
 *
 * Side-effect-free. No DOM, no localStorage, no React. The storage
 * layer (`lib/storage.ts`) handles the read/write side; this file is
 * responsible for the *shape* of the data and the *transformations* on
 * it.
 *
 * Relationship to existing helpers in this directory:
 *  - `getRecordsForExercise` returns the full record list for one
 *    exercise. Used by the per-exercise analysis view.
 *  - `deriveExerciseIndex` (this module) returns the *full last record*
 *    alongside the count and display name. Drives the catalog view
 *    where the most-recent record is the at-a-glance summary.
 *
 * The catalog used to be served by an older `aggregateByExercise` helper
 * returning derived aggregates (`bestTotalKg`, `estimatedOneRmKg`).
 * That surface was replaced by `deriveExerciseIndex` in issue 0042:
 * the new shape (the full last record) lets the card show the source
 * and 1RM flag inline, which `ExerciseSummary` did not surface.
 */
import type { SavedWeightRecord } from "../types";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * The display name of an exercise in the index. Case-preserving: when
 * the same exercise is recorded under multiple capitalizations, the
 * most recent record's spelling wins. Matches the "most-recent-wins"
 * convention from `dedupeExercises` and `getRecordsForExercise`.
 */
export interface ExerciseIndexEntry {
  name: string;
  /**
   * The full record object from the most recent log of this exercise.
   * Includes `createdAt`, `totalKg`, `totalLb`, `breakdownLine`, `source`,
   * and `isOneRepMax` so the entry can show a one-line summary (e.g.
   * "142.5kg · 03 sep · ⭐ 1RM") without re-fetching the record.
   */
  lastRecord: SavedWeightRecord;
  /** Number of records for this exercise. */
  count: number;
}

// ─── deriveExerciseIndex ─────────────────────────────────────────────────────

/**
 * Groups records by exercise name (case-insensitive dedupe) and produces
 * one `ExerciseIndexEntry` per unique exercise.
 *
 * Records with `exercise === null` (auto-log, foto legacy) are
 * excluded — they have no exercise identity to group by. This matches
 * the convention established by `dedupeExercises` and the
 * `getRecordsForExercise` filter.
 *
 * Sort order:
 *  1. Most recent record's `createdAt` descending (most recently trained
 *     first).
 *  2. Ties broken by display name ascending (case-sensitive). This is
 *     the second key the spec requires for stable ordering and is
 *     consistent with the alphabetical fallback a coach expects when
 *     two exercises share a session date.
 *
 * For each group, `lastRecord` is the record with the highest
 * `createdAt`. The display name uses the capitalization of that record.
 */
export function deriveExerciseIndex(
  records: SavedWeightRecord[],
): ExerciseIndexEntry[] {
  // Narrow to records that have an exercise identity. The widening
  // happens via the `eligible` array so that `record.exercise` can be
  // read as `string` (not `string | null`) below.
  const eligible = records.filter(
    (r): r is SavedWeightRecord & { exercise: string } => r.exercise !== null,
  );

  if (eligible.length === 0) return [];

  // Group by lowercased name. We walk the records in insertion order
  // (oldest first), push into the group, and rely on the sort below
  // to pick the most recent.
  type GroupRecord = SavedWeightRecord & { exercise: string };
  const groups = new Map<string, GroupRecord[]>();
  for (const record of eligible) {
    const key = record.exercise.toLowerCase();
    const group = groups.get(key);
    if (group) {
      group.push(record);
    } else {
      groups.set(key, [record]);
    }
  }

  const entries: ExerciseIndexEntry[] = [];
  for (const group of groups.values()) {
    // Sort by `createdAt` desc so `group[0]` is the most recent. Using
    // `localeCompare` (string compare) is valid for ISO 8601 timestamps
    // because the lexicographic order coincides with the chronological
    // order. This matches the convention `getRecordsForExercise` uses.
    group.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const mostRecent = group[0];
    entries.push({
      name: mostRecent.exercise,
      lastRecord: mostRecent,
      count: group.length,
    });
  }

  // Primary: most recent record's `createdAt` desc.
  // Tiebreaker: name asc (case-sensitive, matches the coach's reading
  // order for two exercises trained on the same day).
  entries.sort((a, b) => {
    const dateCmp = b.lastRecord.createdAt.localeCompare(a.lastRecord.createdAt);
    if (dateCmp !== 0) return dateCmp;
    return a.name.localeCompare(b.name);
  });

  return entries;
}
