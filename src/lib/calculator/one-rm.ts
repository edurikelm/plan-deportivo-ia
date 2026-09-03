/**
 * Pure helpers for 1RM estimation and Prilepin table derivation.
 *
 * Drives the analysis view (issue 0039) and the e1RM rolling chart.
 * All functions are side-effect-free and operate on `SavedWeightRecord`
 * snapshots. Tested in `one-rm.test.ts`.
 */
import type { SavedWeightRecord } from "../types";
import { KG_PER_LB } from "./history";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Prilepin's table for high-intensity training, reps 1-12. The percentage
 * of 1RM the coach should aim for at a given rep target. Source: the
 * canonical Prilepin table reproduced in most strength-training references.
 */
export const PRILEPIN_TABLE: ReadonlyArray<{ reps: number; percentage: number }> =
  [
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
  ] as const;

// ─── estimateOneRepMax ───────────────────────────────────────────────────────

/**
 * Estimates the 1RM for a single record using a piecewise formula:
 *  - If `reps === 1`, returns `totalKg` directly (the set IS the 1RM).
 *  - If `reps >= 2`, returns the Epley estimate `totalKg × (1 + reps / 30)`.
 *  - If `reps === null` (legacy or foto record), returns `null` because
 *    we have no information to estimate from.
 *
 * Epley is preferred over Brzycki because it's the more widely cited
 * formula in consumer fitness apps and the difference is < 1% for reps
 * in the 2-10 range. The piecewise identity for reps=1 fixes Epley's
 * ~3% overestimate at the most common 1RM-test rep count.
 */
export function estimateOneRepMax(record: SavedWeightRecord): number | null {
  if (record.reps === null) return null;
  if (record.reps === 1) return record.totalKg;
  return record.totalKg * (1 + record.reps / 30);
}

// ─── aggregateExerciseOneRepMax ──────────────────────────────────────────────

/**
 * Aggregates the 1RM for an exercise across all its records. Returns
 * `max(estimateOneRepMax(r) for r with reps)` vs `max(totalKg for r
 * with isOneRepMax)` — the higher of the formula-based estimate and
 * the manual override. Returns `null` if no record can contribute.
 */
export function aggregateExerciseOneRepMax(
  records: SavedWeightRecord[],
): number | null {
  const formulaMax = records.reduce((max, record) => {
    const estimate = estimateOneRepMax(record);
    if (estimate === null) return max;
    return Math.max(max, estimate);
  }, 0);

  const flagMax = records.reduce((max, record) => {
    if (record.isOneRepMax !== true) return max;
    return Math.max(max, record.totalKg);
  }, 0);

  if (formulaMax === 0 && flagMax === 0) return null;
  return Math.max(formulaMax, flagMax);
}

// ─── buildPrilepinRows ───────────────────────────────────────────────────────

export interface PrilepinRow {
  reps: number;
  percentage: number;
  weightKg: number;
  weightLb: number;
}

/**
 * Materializes the Prilepin table against a concrete 1RM value. Returns
 * 12 rows, each with the absolute kg and lb equivalents the coach should
 * aim for at that rep target. If `oneRmKg` is 0 (or null/NaN coerced),
 * all rows collapse to 0kg/0lb.
 */
export function buildPrilepinRows(oneRmKg: number): PrilepinRow[] {
  return PRILEPIN_TABLE.map(({ reps, percentage }) => {
    const weightKg = oneRmKg * (percentage / 100);
    return {
      reps,
      percentage,
      weightKg,
      weightLb: weightKg * KG_PER_LB,
    };
  });
}
