/**
 * Unit tests for the pure helpers in `src/lib/calculator/one-rm.ts`.
 *
 * All functions are side-effect-free, deterministic, and operate on
 * `SavedWeightRecord` snapshots. They drive the analysis view's
 * 1RM estimation, Prilepin table, and per-exercise aggregation.
 */
import { describe, it, expect } from "vitest";
import type { SavedWeightRecord } from "../types";
import {
  estimateOneRepMax,
  aggregateExerciseOneRepMax,
  PRILEPIN_TABLE,
  buildPrilepinRows,
} from "./one-rm";

// ─── Test factory ────────────────────────────────────────────────────────────

/**
 * Minimal factory for SavedWeightRecord. Populates only the fields that
 * the one-rm helpers actually read (`reps`, `isOneRepMax`, `totalKg`).
 * Other fields are hardcoded to valid placeholders so the type checker
 * is happy without dragging the test setup.
 */
function mkRecord(overrides: {
  reps: number | null;
  totalKg: number;
  isOneRepMax?: boolean;
}): SavedWeightRecord {
  return {
    id: "test-id",
    createdAt: "2026-09-01T00:00:00.000Z",
    exercise: "Back Squat",
    barKg: 20,
    discs: [],
    totalKg: overrides.totalKg,
    totalLb: overrides.totalKg * 2.20462,
    breakdownLine: `${overrides.totalKg}kg`,
    source: "manual",
    reps: overrides.reps,
    isOneRepMax: overrides.isOneRepMax ?? false,
  };
}

// ─── estimateOneRepMax ───────────────────────────────────────────────────────

describe("estimateOneRepMax", () => {
  it("returns totalKg directly when reps === 1 (no Epley factor)", () => {
    // Identity: a 1-rep set IS the 1RM, no estimation needed.
    expect(estimateOneRepMax(mkRecord({ reps: 1, totalKg: 100 }))).toBe(100);
  });

  it("applies Epley factor 1 + reps/30 for reps === 5", () => {
    // 100 × (1 + 5/30) = 100 × 1.16667 = 116.667
    expect(estimateOneRepMax(mkRecord({ reps: 5, totalKg: 100 }))).toBeCloseTo(
      116.6667,
      4,
    );
  });

  it("applies Epley factor 1 + reps/30 for reps === 10", () => {
    // 100 × (1 + 10/30) = 100 × 1.3333 = 133.333
    expect(estimateOneRepMax(mkRecord({ reps: 10, totalKg: 100 }))).toBeCloseTo(
      133.3333,
      4,
    );
  });

  it("applies Epley factor 1 + reps/30 for reps === 12", () => {
    // 100 × (1 + 12/30) = 100 × 1.4 = 140
    expect(estimateOneRepMax(mkRecord({ reps: 12, totalKg: 100 }))).toBeCloseTo(
      140,
      4,
    );
  });

  it("returns null when reps is null (legacy or foto record)", () => {
    expect(estimateOneRepMax(mkRecord({ reps: null, totalKg: 100 }))).toBeNull();
  });

  it("returns 0 when totalKg is 0 (edge case, doesn't crash)", () => {
    expect(estimateOneRepMax(mkRecord({ reps: 5, totalKg: 0 }))).toBe(0);
  });

  it("is idempotent for reps === 1: 100kg → 100kg exactly", () => {
    // No floating-point drift. The piecewise path must not apply Epley.
    const result = estimateOneRepMax(mkRecord({ reps: 1, totalKg: 100 }));
    expect(result).toBe(100);
  });

  it("scales proportionally for reps === 2", () => {
    // 50 × (1 + 2/30) = 50 × 1.0667 = 53.3333
    expect(estimateOneRepMax(mkRecord({ reps: 2, totalKg: 50 }))).toBeCloseTo(
      53.3333,
      4,
    );
  });
});

// ─── aggregateExerciseOneRepMax ──────────────────────────────────────────────

describe("aggregateExerciseOneRepMax", () => {
  it("returns null for an empty array", () => {
    expect(aggregateExerciseOneRepMax([])).toBeNull();
  });

  it("returns totalKg for a single record with reps === 1", () => {
    const records = [mkRecord({ reps: 1, totalKg: 120 })];
    expect(aggregateExerciseOneRepMax(records)).toBe(120);
  });

  it("returns Epley estimate for a single record with reps === 5", () => {
    // 100 × 1.1667 = 116.667
    const records = [mkRecord({ reps: 5, totalKg: 100 })];
    expect(aggregateExerciseOneRepMax(records)).toBeCloseTo(116.6667, 4);
  });

  it("returns the max Epley estimate across multiple records", () => {
    // 80kg×5 → 93.33; 100kg×3 → 110; 90kg×8 → 114
    // Max is 114.
    const records = [
      mkRecord({ reps: 5, totalKg: 80 }),
      mkRecord({ reps: 3, totalKg: 100 }),
      mkRecord({ reps: 8, totalKg: 90 }),
    ];
    expect(aggregateExerciseOneRepMax(records)).toBeCloseTo(114, 3);
  });

  it("lets the manual flag win when it exceeds the formula max", () => {
    // Formula max: 100×1.1667 = 116.67. Flag is 150 → flag wins.
    const records = [
      mkRecord({ reps: 5, totalKg: 100 }),
      mkRecord({ reps: 1, totalKg: 130, isOneRepMax: true }),
      mkRecord({ reps: 1, totalKg: 150, isOneRepMax: true }),
    ];
    expect(aggregateExerciseOneRepMax(records)).toBe(150);
  });

  it("lets the formula win when it exceeds the manual flag", () => {
    // Formula max: 100×1.1667 = 116.67. Flag is 80 → formula wins.
    const records = [
      mkRecord({ reps: 5, totalKg: 100 }),
      mkRecord({ reps: 1, totalKg: 80, isOneRepMax: true }),
    ];
    expect(aggregateExerciseOneRepMax(records)).toBeCloseTo(116.6667, 4);
  });

  it("returns null when all records have reps === null and no flag is set", () => {
    const records = [
      mkRecord({ reps: null, totalKg: 100 }),
      mkRecord({ reps: null, totalKg: 120 }),
    ];
    expect(aggregateExerciseOneRepMax(records)).toBeNull();
  });

  it("ignores records with reps === null when other records have reps", () => {
    // The legacy record is ignored. The valid record with reps=1 wins.
    const records = [
      mkRecord({ reps: null, totalKg: 200 }),
      mkRecord({ reps: 1, totalKg: 100 }),
    ];
    expect(aggregateExerciseOneRepMax(records)).toBe(100);
  });
});

// ─── PRILEPIN_TABLE ──────────────────────────────────────────────────────────

describe("PRILEPIN_TABLE", () => {
  it("contains 12 entries with reps 1-12 and the canonical Prilepin percentages", () => {
    expect(PRILEPIN_TABLE).toHaveLength(12);
    const expected = [
      { reps: 1, percentage: 100 },
      { reps: 2, percentage: 95 },
      { reps: 3, percentage: 93 },
      { reps: 4, percentage: 90 },
      { reps: 5, percentage: 87 },
      { reps: 6, percentage: 85 },
      { reps: 7, percentage: 83 },
      { reps: 8, percentage: 80 },
      { reps: 9, percentage: 78 },
      { reps: 10, percentage: 75 },
      { reps: 11, percentage: 73 },
      { reps: 12, percentage: 70 },
    ];
    expect(PRILEPIN_TABLE).toEqual(expected);
  });
});

// ─── buildPrilepinRows ───────────────────────────────────────────────────────

describe("buildPrilepinRows", () => {
  it("returns 12 rows for a given 1RM", () => {
    expect(buildPrilepinRows(100)).toHaveLength(12);
  });

  it("first row of 1RM=100kg is 1 rep × 100% × 100kg × 220.462lb", () => {
    const rows = buildPrilepinRows(100);
    expect(rows[0]).toEqual({
      reps: 1,
      percentage: 100,
      weightKg: 100,
      weightLb: 220.462,
    });
  });

  it("second row of 1RM=100kg is 2 reps × 95% × 95kg × 209.439lb", () => {
    const rows = buildPrilepinRows(100);
    expect(rows[1].reps).toBe(2);
    expect(rows[1].percentage).toBe(95);
    expect(rows[1].weightKg).toBeCloseTo(95, 4);
    expect(rows[1].weightLb).toBeCloseTo(95 * 2.20462, 3);
  });

  it("converts weightKg to weightLb using the 2.20462 constant", () => {
    const rows = buildPrilepinRows(150);
    for (const row of rows) {
      expect(row.weightLb).toBeCloseTo(row.weightKg * 2.20462, 3);
    }
  });

  it("returns rows with weightKg === 0 when oneRmKg is 0", () => {
    const rows = buildPrilepinRows(0);
    for (const row of rows) {
      expect(row.weightKg).toBe(0);
      expect(row.weightLb).toBe(0);
    }
  });
});
