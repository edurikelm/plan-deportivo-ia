/**
 * Unit tests for the pure helpers in `src/lib/calculator/chart-helpers.ts`.
 *
 * These helpers power the analysis view (issue 0039). They are side-effect
 * free, deterministic, and operate on `SavedWeightRecord` snapshots.
 *
 * TZ is forced to UTC at the top of this module so `getDate()` /
 * `getMonth()` produce stable values across CI environments (the
 * `formatProgressionTick` helper uses local time to stay consistent with
 * `exercises-page-client.tsx`'s `formatDate`).
 */
process.env.TZ = "UTC";

import { describe, it, expect } from "vitest";
import type { SavedWeightRecord } from "../types";
import {
  formatProgressionTick,
  rollingEstimatedOneRm,
} from "./chart-helpers";

// ─── Test factory ────────────────────────────────────────────────────────────

/**
 * Minimal factory for SavedWeightRecord. Populates only the fields that
 * the chart helpers actually read (`reps`, `totalKg`, `createdAt`).
 * Other fields are hardcoded to valid placeholders so the type checker
 * is happy without dragging the test setup.
 */
function mkRecord(overrides: {
  id?: string;
  reps: number | null;
  totalKg: number;
  createdAt?: string;
}): SavedWeightRecord {
  return {
    id: overrides.id ?? "test-id",
    createdAt: overrides.createdAt ?? "2026-09-01T00:00:00.000Z",
    exercise: "Back Squat",
    barKg: 20,
    discs: [],
    totalKg: overrides.totalKg,
    totalLb: overrides.totalKg * 2.20462,
    breakdownLine: `${overrides.totalKg}kg`,
    source: "manual",
    reps: overrides.reps,
    isOneRepMax: false,
  };
}

// ─── formatProgressionTick ───────────────────────────────────────────────────

describe("formatProgressionTick", () => {
  it("formats an ISO timestamp as a short Spanish date (DD month-abbr)", () => {
    expect(formatProgressionTick("2026-09-03T10:00:00.000Z")).toBe("03 sep");
  });

  it("returns the empty string for an invalid date string", () => {
    expect(formatProgressionTick("not-a-date")).toBe("");
  });

  it("returns the empty string for an empty input", () => {
    expect(formatProgressionTick("")).toBe("");
  });
});

// ─── rollingEstimatedOneRm ───────────────────────────────────────────────────

describe("rollingEstimatedOneRm", () => {
  it("returns an empty series for 0 records", () => {
    expect(rollingEstimatedOneRm([])).toEqual([]);
  });

  it("returns a single entry for 1 record (window truncates to 1)", () => {
    const r0 = mkRecord({ reps: 5, totalKg: 100 });
    // 100 × (1 + 5/30) ≈ 116.667
    const result = rollingEstimatedOneRm([r0]);
    expect(result).toHaveLength(1);
    expect(result[0]).not.toBeNull();
    expect(result[0]!).toBeCloseTo(116.667, 2);
  });

  it("returns 5 entries for 5 records (window=3): early indices have a shorter window", () => {
    // r0: 100kg × 5 → 116.667
    // r1: 110kg × 5 → 128.333
    // r2: 120kg × 5 → 140.000
    // r3: 130kg × 5 → 151.667
    // r4: 140kg × 1 → 140.000 (identity for reps=1)
    const r0 = mkRecord({ id: "r0", totalKg: 100, reps: 5 });
    const r1 = mkRecord({ id: "r1", totalKg: 110, reps: 5 });
    const r2 = mkRecord({ id: "r2", totalKg: 120, reps: 5 });
    const r3 = mkRecord({ id: "r3", totalKg: 130, reps: 5 });
    const r4 = mkRecord({ id: "r4", totalKg: 140, reps: 1 });

    // Window=3, so window spans [max(0, i-2), i]:
    //   i=0: window [0,0]   → max(116.667)            = 116.667
    //   i=1: window [0,1]   → max(116.667, 128.333)   = 128.333
    //   i=2: window [0,2]   → max(116.667..140)       = 140.000
    //   i=3: window [1,3]   → max(128.333..151.667)   = 151.667
    //   i=4: window [2,4]   → max(140, 151.667, 140)  = 151.667
    const result = rollingEstimatedOneRm([r0, r1, r2, r3, r4], 3);
    expect(result).toHaveLength(5);
    expect(result[0]).toBeCloseTo(116.667, 2);
    expect(result[1]).toBeCloseTo(128.333, 2);
    expect(result[2]).toBeCloseTo(140, 2);
    expect(result[3]).toBeCloseTo(151.667, 2);
    expect(result[4]).toBeCloseTo(151.667, 2);
  });

  it("ignores records with reps === null inside the rolling window (falls back to non-null values)", () => {
    // r0: 100kg × 5  → 116.667
    // r1: 110kg × 0  → null   (excluded from max; treated as missing)
    // r2: 120kg × 5  → 140.000
    const r0 = mkRecord({ id: "r0", totalKg: 100, reps: 5 });
    const r1 = mkRecord({ id: "r1", totalKg: 110, reps: null });
    const r2 = mkRecord({ id: "r2", totalKg: 120, reps: 5 });

    // i=0: [116.667]                          → 116.667
    // i=1: [116.667, null]                    → 116.667 (null ignored)
    // i=2: [116.667, null, 140]               → 140
    const result = rollingEstimatedOneRm([r0, r1, r2], 3);
    expect(result).toHaveLength(3);
    expect(result[0]).toBeCloseTo(116.667, 2);
    expect(result[1]).toBeCloseTo(116.667, 2);
    expect(result[2]).toBeCloseTo(140, 2);
  });

  it("returns a series of nulls when every record has reps === null (so the chart can decide how to render)", () => {
    const r0 = mkRecord({ id: "r0", totalKg: 100, reps: null });
    const r1 = mkRecord({ id: "r1", totalKg: 110, reps: null });

    // Both windows [0,0] and [0,1] contain only nulls → entries are null.
    const result = rollingEstimatedOneRm([r0, r1], 3);
    expect(result).toEqual([null, null]);
  });
});
