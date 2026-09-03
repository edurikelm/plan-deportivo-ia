/**
 * Unit tests for `src/lib/calculator/suggest-reps.ts`.
 *
 * The helper reads past records for the same exercise to suggest a reps
 * default when the coach opens the save form. Pure, side-effect-free.
 */
import { describe, it, expect } from "vitest";
import type { SavedWeightRecord } from "../types";
import { suggestRepsForExercise } from "./suggest-reps";

// ─── Test factory ────────────────────────────────────────────────────────────

/**
 * Minimal factory for SavedWeightRecord. Populates only the fields the
 * helper reads (`exercise`, `createdAt`, `reps`). Other fields are
 * hardcoded to valid placeholders so the type checker is happy.
 */
function mkRecord(overrides: {
  exercise: string | null;
  reps: number | null;
  createdAt: string;
}): SavedWeightRecord {
  return {
    id: "test-id",
    createdAt: overrides.createdAt,
    exercise: overrides.exercise,
    barKg: 20,
    discs: [],
    totalKg: 100,
    totalLb: 220.462,
    breakdownLine: "100kg",
    source: "manual",
    reps: overrides.reps,
    isOneRepMax: false,
  };
}

// ─── suggestRepsForExercise ──────────────────────────────────────────────────

describe("suggestRepsForExercise", () => {
  it("returns 1 when there are no previous records for the exercise", () => {
    const records: SavedWeightRecord[] = [];
    expect(suggestRepsForExercise(records, "Back Squat")).toBe(1);
  });

  it("returns 1 when the most recent record for the exercise had reps === 1", () => {
    const records = [
      mkRecord({
        exercise: "Back Squat",
        reps: 1,
        createdAt: "2026-09-01T10:00:00.000Z",
      }),
      mkRecord({
        exercise: "Back Squat",
        reps: 5,
        createdAt: "2026-08-15T10:00:00.000Z",
      }),
    ];
    // Newer record (reps=1) wins, even though an older one had reps=5.
    expect(suggestRepsForExercise(records, "Back Squat")).toBe(1);
  });

  it("returns 5 when the most recent record had reps === 3 (floor at 5)", () => {
    const records = [
      mkRecord({
        exercise: "Back Squat",
        reps: 3,
        createdAt: "2026-09-01T10:00:00.000Z",
      }),
    ];
    expect(suggestRepsForExercise(records, "Back Squat")).toBe(5);
  });

  it("returns the most recent reps unchanged when it was already >= 5", () => {
    // Last set was 8 reps; we don't drop the coach back to 5.
    const records = [
      mkRecord({
        exercise: "Back Squat",
        reps: 8,
        createdAt: "2026-09-01T10:00:00.000Z",
      }),
    ];
    expect(suggestRepsForExercise(records, "Back Squat")).toBe(8);
  });

  it("matches exercises case-insensitively", () => {
    const records = [
      mkRecord({
        exercise: "Back Squat",
        reps: 5,
        createdAt: "2026-09-01T10:00:00.000Z",
      }),
    ];
    expect(suggestRepsForExercise(records, "back squat")).toBe(5);
    expect(suggestRepsForExercise(records, "BACK SQUAT")).toBe(5);
  });

  it("ignores records with null exercise (auto-log legacy)", () => {
    const records: SavedWeightRecord[] = [
      mkRecord({
        exercise: null,
        reps: 5,
        createdAt: "2026-09-01T10:00:00.000Z",
      }),
    ];
    expect(suggestRepsForExercise(records, "Back Squat")).toBe(1);
  });

  it("ignores records for other exercises (does not cross-contaminate)", () => {
    const records = [
      mkRecord({
        exercise: "Press militar",
        reps: 8,
        createdAt: "2026-09-01T10:00:00.000Z",
      }),
    ];
    expect(suggestRepsForExercise(records, "Back Squat")).toBe(1);
  });

  it("ignores records with reps === null (legacy/manual field missing)", () => {
    const records = [
      mkRecord({
        exercise: "Back Squat",
        reps: null,
        createdAt: "2026-09-01T10:00:00.000Z",
      }),
    ];
    expect(suggestRepsForExercise(records, "Back Squat")).toBe(1);
  });
});
