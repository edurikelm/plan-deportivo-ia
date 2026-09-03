/**
 * Unit tests for the per-exercise aggregation helpers in
 * `src/lib/calculator/aggregate.ts`.
 *
 * These power the refactored `/history` list (issue 0038) and the analysis
 * view (issue 0039). Pure functions, no DOM, no storage.
 */
import { describe, it, expect } from "vitest";
import type { SavedWeightRecord } from "../types";
import { aggregateByExercise, getRecordsForExercise } from "./aggregate";

// ─── Test factory ────────────────────────────────────────────────────────────

/**
 * Minimal factory for SavedWeightRecord. Populates only the fields the
 * helpers read (`exercise`, `createdAt`, `totalKg`, `reps`, `isOneRepMax`,
 * `source`). Other fields are hardcoded to valid placeholders.
 */
function mkRecord(overrides: {
  exercise: string | null;
  createdAt: string;
  totalKg?: number;
  reps?: number | null;
  isOneRepMax?: boolean;
  source?: "auto-log" | "manual" | "foto";
}): SavedWeightRecord {
  return {
    id: `rec-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: overrides.createdAt,
    exercise: overrides.exercise,
    barKg: 20,
    discs: [],
    totalKg: overrides.totalKg ?? 100,
    totalLb: (overrides.totalKg ?? 100) * 2.20462,
    breakdownLine: `${overrides.totalKg ?? 100}kg`,
    source: overrides.source ?? "manual",
    reps: overrides.reps ?? null,
    isOneRepMax: overrides.isOneRepMax ?? false,
  };
}

// ─── aggregateByExercise ─────────────────────────────────────────────────────

describe("aggregateByExercise", () => {
  it("returns an empty array for an empty input", () => {
    expect(aggregateByExercise([])).toEqual([]);
  });

  it("returns a single summary for a single record", () => {
    const records = [
      mkRecord({ exercise: "Back Squat", createdAt: "2026-09-01T10:00:00.000Z" }),
    ];
    expect(aggregateByExercise(records)).toHaveLength(1);
    expect(aggregateByExercise(records)[0].name).toBe("Back Squat");
  });

  it("collapses case variations of the same exercise into one summary", () => {
    const records = [
      mkRecord({
        exercise: "Back Squat",
        createdAt: "2026-08-15T10:00:00.000Z",
      }),
      mkRecord({
        exercise: "back squat",
        createdAt: "2026-09-01T10:00:00.000Z", // most recent
      }),
      mkRecord({
        exercise: "BACK SQUAT",
        createdAt: "2026-08-01T10:00:00.000Z",
      }),
    ];
    const summaries = aggregateByExercise(records);
    expect(summaries).toHaveLength(1);
    // The most recent record wins on capitalization.
    expect(summaries[0].name).toBe("back squat");
    expect(summaries[0].recordCount).toBe(3);
  });

  it("returns multiple summaries ordered by lastRecordAt desc", () => {
    const records = [
      mkRecord({
        exercise: "Press militar",
        createdAt: "2026-08-20T10:00:00.000Z",
      }),
      mkRecord({
        exercise: "Back Squat",
        createdAt: "2026-09-01T10:00:00.000Z", // newer
      }),
      mkRecord({
        exercise: "Back Squat",
        createdAt: "2026-08-10T10:00:00.000Z",
      }),
    ];
    const summaries = aggregateByExercise(records);
    expect(summaries).toHaveLength(2);
    expect(summaries[0].name).toBe("Back Squat");
    expect(summaries[1].name).toBe("Press militar");
  });

  it("excludes records with exercise === null (auto-log and foto)", () => {
    const records = [
      mkRecord({ exercise: null, createdAt: "2026-09-01T10:00:00.000Z" }),
      mkRecord({ exercise: null, createdAt: "2026-08-30T10:00:00.000Z" }),
      mkRecord({
        exercise: "Back Squat",
        createdAt: "2026-08-20T10:00:00.000Z",
      }),
    ];
    const summaries = aggregateByExercise(records);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].name).toBe("Back Squat");
    expect(summaries[0].recordCount).toBe(1);
  });

  it("computes bestTotalKg from records with reps === 1 only", () => {
    const records = [
      mkRecord({
        exercise: "Back Squat",
        createdAt: "2026-08-01T10:00:00.000Z",
        totalKg: 200, // reps=1 candidate
        reps: 1,
      }),
      mkRecord({
        exercise: "Back Squat",
        createdAt: "2026-08-15T10:00:00.000Z",
        totalKg: 150, // higher total but reps=5, NOT eligible
        reps: 5,
      }),
      mkRecord({
        exercise: "Back Squat",
        createdAt: "2026-09-01T10:00:00.000Z",
        totalKg: 180, // reps=1 candidate
        reps: 1,
      }),
    ];
    const summaries = aggregateByExercise(records);
    // Max of {200, 180} = 200. The 150kg set with reps=5 is ignored.
    expect(summaries[0].bestTotalKg).toBe(200);
  });

  it("computes estimatedOneRmKg via aggregateExerciseOneRepMax", () => {
    // Epley: 100kg × (1 + 5/30) = 116.67
    const records = [
      mkRecord({
        exercise: "Back Squat",
        createdAt: "2026-09-01T10:00:00.000Z",
        totalKg: 100,
        reps: 5,
      }),
    ];
    const summaries = aggregateByExercise(records);
    expect(summaries[0].estimatedOneRmKg).toBeCloseTo(116.67, 1);
  });

  it("returns estimatedOneRmKg === null when no record has reps", () => {
    // Legacy records: all have reps === null. No flag set. No 1RM possible.
    const records = [
      mkRecord({
        exercise: "Back Squat",
        createdAt: "2026-09-01T10:00:00.000Z",
        totalKg: 100,
        reps: null,
      }),
    ];
    const summaries = aggregateByExercise(records);
    expect(summaries[0].estimatedOneRmKg).toBeNull();
  });
});

// ─── getRecordsForExercise ───────────────────────────────────────────────────

describe("getRecordsForExercise", () => {
  it("filters by case-insensitive exercise name", () => {
    const records = [
      mkRecord({
        exercise: "Back Squat",
        createdAt: "2026-09-01T10:00:00.000Z",
      }),
      mkRecord({
        exercise: "Press militar",
        createdAt: "2026-08-30T10:00:00.000Z",
      }),
      mkRecord({
        exercise: "back squat",
        createdAt: "2026-08-20T10:00:00.000Z",
      }),
    ];
    const result = getRecordsForExercise(records, "BACK SQUAT");
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.exercise !== null)).toBe(true);
  });

  it("sorts the matched records by createdAt desc", () => {
    const records = [
      mkRecord({
        exercise: "Back Squat",
        createdAt: "2026-08-15T10:00:00.000Z",
      }),
      mkRecord({
        exercise: "Back Squat",
        createdAt: "2026-09-01T10:00:00.000Z",
      }),
      mkRecord({
        exercise: "Back Squat",
        createdAt: "2026-08-20T10:00:00.000Z",
      }),
    ];
    const result = getRecordsForExercise(records, "Back Squat");
    expect(result[0].createdAt).toBe("2026-09-01T10:00:00.000Z");
    expect(result[1].createdAt).toBe("2026-08-20T10:00:00.000Z");
    expect(result[2].createdAt).toBe("2026-08-15T10:00:00.000Z");
  });

  it("returns an empty array for an exercise with no records", () => {
    const records = [
      mkRecord({
        exercise: "Back Squat",
        createdAt: "2026-09-01T10:00:00.000Z",
      }),
    ];
    expect(getRecordsForExercise(records, "Press militar")).toEqual([]);
  });
});
