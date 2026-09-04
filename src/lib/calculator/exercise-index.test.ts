/**
 * Unit tests for `deriveExerciseIndex` in
 * `src/lib/calculator/exercise-index.ts`.
 *
 * Drives issue 0042: the helper that backs the new
 * `/tools/weight-calculator/exercises` page. Pure function, no DOM, no
 * storage — same discipline as `aggregate.test.ts` and `history.test.ts`.
 *
 * TDD scope: strict (per the hybrid policy chosen in this project). The
 * helper's contract is small enough to spec exhaustively.
 */
import { describe, it, expect } from "vitest";
import type { SavedWeightRecord } from "../types";
import { deriveExerciseIndex } from "./exercise-index";

// ─── Test factory ────────────────────────────────────────────────────────────

/**
 * Minimal factory for `SavedWeightRecord`. Only the fields the helper
 * reads are customizable. The defaults satisfy the Zod schema so the
 * tests can pass arbitrary input to the helper without a schema round-trip.
 */
function mkRecord(overrides: {
  exercise: string | null;
  createdAt: string;
  totalKg?: number;
  totalLb?: number;
  breakdownLine?: string;
  source?: "auto-log" | "manual" | "foto";
  isOneRepMax?: boolean;
}): SavedWeightRecord {
  const totalKg = overrides.totalKg ?? 100;
  return {
    id: `rec-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: overrides.createdAt,
    exercise: overrides.exercise,
    barKg: 20,
    discs: [],
    totalKg,
    totalLb: overrides.totalLb ?? totalKg * 2.20462,
    breakdownLine: overrides.breakdownLine ?? `${totalKg}kg`,
    source: overrides.source ?? "manual",
    reps: null,
    isOneRepMax: overrides.isOneRepMax ?? false,
  };
}

// ─── deriveExerciseIndex ─────────────────────────────────────────────────────

describe("deriveExerciseIndex", () => {
  it("returns an empty array for an empty input", () => {
    expect(deriveExerciseIndex([])).toEqual([]);
  });

  it("returns a single entry for a single record", () => {
    const record = mkRecord({ exercise: "Back Squat", createdAt: "2026-09-01T10:00:00.000Z" });
    const entries = deriveExerciseIndex([record]);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("Back Squat");
    expect(entries[0].count).toBe(1);
    expect(entries[0].lastRecord).toBe(record);
  });

  it("groups records by exercise, case-insensitively", () => {
    const records = [
      mkRecord({ exercise: "Back Squat", createdAt: "2026-08-01T10:00:00.000Z" }),
      mkRecord({ exercise: "back squat", createdAt: "2026-09-01T10:00:00.000Z" }),
      mkRecord({ exercise: "BACK SQUAT", createdAt: "2026-08-15T10:00:00.000Z" }),
    ];
    const entries = deriveExerciseIndex(records);
    expect(entries).toHaveLength(1);
    expect(entries[0].count).toBe(3);
  });

  it("preserves the most-recent capitalization when grouping case-insensitively", () => {
    const records = [
      mkRecord({ exercise: "back squat", createdAt: "2026-08-01T10:00:00.000Z" }),
      mkRecord({ exercise: "Back Squat", createdAt: "2026-09-01T10:00:00.000Z" }),
    ];
    const entries = deriveExerciseIndex(records);
    expect(entries[0].name).toBe("Back Squat");
  });

  it("uses the most recent record as `lastRecord` for a group", () => {
    const older = mkRecord({
      exercise: "Back Squat",
      createdAt: "2026-08-01T10:00:00.000Z",
      totalKg: 100,
    });
    const newer = mkRecord({
      exercise: "Back Squat",
      createdAt: "2026-09-01T10:00:00.000Z",
      totalKg: 120,
    });
    const entries = deriveExerciseIndex([older, newer]);
    expect(entries[0].lastRecord).toBe(newer);
    expect(entries[0].lastRecord.totalKg).toBe(120);
  });

  it("sorts entries by last record `createdAt` descending (most recent first)", () => {
    const records = [
      mkRecord({ exercise: "Bench Press", createdAt: "2026-07-01T10:00:00.000Z" }),
      mkRecord({ exercise: "Back Squat", createdAt: "2026-09-01T10:00:00.000Z" }),
      mkRecord({ exercise: "Deadlift", createdAt: "2026-08-01T10:00:00.000Z" }),
    ];
    const entries = deriveExerciseIndex(records);
    expect(entries.map((e) => e.name)).toEqual([
      "Back Squat",
      "Deadlift",
      "Bench Press",
    ]);
  });

  it("breaks ties on `createdAt` by name ascending (stable, deterministic)", () => {
    const sameDate = "2026-09-01T10:00:00.000Z";
    const records = [
      mkRecord({ exercise: "Z-Press", createdAt: sameDate }),
      mkRecord({ exercise: "Back Squat", createdAt: sameDate }),
      mkRecord({ exercise: "Deadlift", createdAt: sameDate }),
    ];
    const entries = deriveExerciseIndex(records);
    expect(entries.map((e) => e.name)).toEqual([
      "Back Squat",
      "Deadlift",
      "Z-Press",
    ]);
  });

  it("excludes records with `exercise === null` (auto-log, foto legacy)", () => {
    const records = [
      mkRecord({ exercise: null, createdAt: "2026-09-01T10:00:00.000Z" }),
      mkRecord({ exercise: "Back Squat", createdAt: "2026-08-01T10:00:00.000Z" }),
    ];
    const entries = deriveExerciseIndex(records);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("Back Squat");
  });

  it("exposes the full last record (createdAt, totalKg, totalLb, breakdownLine, source, isOneRepMax)", () => {
    const record = mkRecord({
      exercise: "Back Squat",
      createdAt: "2026-09-01T10:00:00.000Z",
      totalKg: 142.5,
      totalLb: 314.16,
      breakdownLine: "20kg + 2×(25kg + 2×(20kg))",
      source: "manual",
      isOneRepMax: true,
    });
    const entries = deriveExerciseIndex([record]);
    const { lastRecord } = entries[0];
    expect(lastRecord.createdAt).toBe("2026-09-01T10:00:00.000Z");
    expect(lastRecord.totalKg).toBe(142.5);
    expect(lastRecord.totalLb).toBe(314.16);
    expect(lastRecord.breakdownLine).toBe("20kg + 2×(25kg + 2×(20kg))");
    expect(lastRecord.source).toBe("manual");
    expect(lastRecord.isOneRepMax).toBe(true);
  });

  it("preserves the `source` of the most recent record when it differs across the group", () => {
    const manualOld = mkRecord({
      exercise: "Back Squat",
      createdAt: "2026-08-01T10:00:00.000Z",
      source: "manual",
    });
    const fotoNew = mkRecord({
      exercise: "Back Squat",
      createdAt: "2026-09-01T10:00:00.000Z",
      source: "foto",
    });
    const entries = deriveExerciseIndex([manualOld, fotoNew]);
    expect(entries[0].lastRecord.source).toBe("foto");
    expect(entries[0].count).toBe(2);
  });
});
