/**
 * Unit tests for `getRecordsForExercise` in
 * `src/lib/calculator/aggregate.ts`.
 *
 * Drives the per-exercise analysis view (issue 0039): the helper
 * returns the records for the exercise the coach opened, so the
 * view can render its charts + history + Prilepin table.
 *
 * Pure function, no DOM, no storage — same discipline as
 * `history.test.ts` and `exercise-index.test.ts`.
 *
 * Note: this module previously also covered `aggregateByExercise` and
 * its `ExerciseSummary` return type, which fed the catalog page. That
 * surface was replaced by `deriveExerciseIndex` in issue 0042 and the
 * corresponding tests were removed; see `exercise-index.test.ts` for
 * the current coverage.
 */
import { describe, it, expect } from "vitest";
import type { SavedWeightRecord } from "../types";
import { getRecordsForExercise } from "./aggregate";

// ─── Test factory ────────────────────────────────────────────────────────────

/**
 * Minimal factory for `SavedWeightRecord`. Only the fields the helper
 * reads (`exercise`, `createdAt`) are customizable; the rest are
 * hardcoded to valid placeholders that satisfy the Zod schema.
 */
function mkRecord(overrides: {
  exercise: string | null;
  createdAt: string;
}): SavedWeightRecord {
  return {
    id: `rec-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: overrides.createdAt,
    exercise: overrides.exercise,
    barKg: 20,
    discs: [],
    totalKg: 100,
    totalLb: 220.462,
    breakdownLine: "100kg",
    source: "manual",
    reps: null,
    isOneRepMax: false,
  };
}

// ─── getRecordsForExercise ───────────────────────────────────────────────────

describe("getRecordsForExercise", () => {
  it("filters by case-insensitive exercise name", () => {
    const records = [
      mkRecord({ exercise: "Back Squat", createdAt: "2026-09-01T10:00:00.000Z" }),
      mkRecord({ exercise: "Press militar", createdAt: "2026-08-30T10:00:00.000Z" }),
      mkRecord({ exercise: "back squat", createdAt: "2026-08-20T10:00:00.000Z" }),
    ];
    const result = getRecordsForExercise(records, "BACK SQUAT");
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.exercise !== null)).toBe(true);
  });

  it("sorts the matched records by createdAt desc", () => {
    const records = [
      mkRecord({ exercise: "Back Squat", createdAt: "2026-08-15T10:00:00.000Z" }),
      mkRecord({ exercise: "Back Squat", createdAt: "2026-09-01T10:00:00.000Z" }),
      mkRecord({ exercise: "Back Squat", createdAt: "2026-08-20T10:00:00.000Z" }),
    ];
    const result = getRecordsForExercise(records, "Back Squat");
    expect(result[0].createdAt).toBe("2026-09-01T10:00:00.000Z");
    expect(result[1].createdAt).toBe("2026-08-20T10:00:00.000Z");
    expect(result[2].createdAt).toBe("2026-08-15T10:00:00.000Z");
  });

  it("returns an empty array for an exercise with no records", () => {
    const records = [
      mkRecord({ exercise: "Back Squat", createdAt: "2026-09-01T10:00:00.000Z" }),
    ];
    expect(getRecordsForExercise(records, "Press militar")).toEqual([]);
  });

  it("returns an empty array when the target name is empty or whitespace", () => {
    const records = [
      mkRecord({ exercise: "Back Squat", createdAt: "2026-09-01T10:00:00.000Z" }),
    ];
    expect(getRecordsForExercise(records, "")).toEqual([]);
    expect(getRecordsForExercise(records, "   ")).toEqual([]);
  });
});
