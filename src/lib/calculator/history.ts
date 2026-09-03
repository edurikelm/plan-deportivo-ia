/**
 * Pure helpers for the calculator's saved-weight-record history.
 *
 * Everything in this module is side-effect-free. No DOM, no localStorage, no
 * React. The storage layer (`lib/storage.ts`) is responsible for the
 * read/write side; this file is responsible for the *shape* of the data and
 * the *transformations* on it.
 */
import type { DiscRow } from "./schemas";
import { formatBreakdownLine } from "./schemas";
import type { SavedWeightRecord } from "../types";

export const KG_PER_LB = 2.20462;
const LB_PER_KG = 1 / KG_PER_LB;

function lbToKg(lb: number): number {
  return lb * LB_PER_KG;
}

// ─── Totals ─────────────────────────────────────────────────────────────────

export interface ComputedTotals {
  totalKg: number;
  totalLb: number;
  breakdownLine: string;
}

/**
 * Returns the kg/lb totals and a pre-formatted breakdown line for a bar +
 * discs configuration. Mirrors the math the calculator footer uses so that
 * a `SavedWeightRecord` round-trips losslessly through the UI.
 */
export function computeTotals(state: {
  barKg: number;
  discs: DiscRow[];
}): ComputedTotals {
  const discKg = state.discs.reduce(
    (acc, d) =>
      acc +
      2 * (d.unit === "kg" ? d.weight * d.count : lbToKg(d.weight) * d.count),
    0,
  );
  const totalKg = state.barKg + discKg;
  return {
    totalKg,
    totalLb: totalKg * KG_PER_LB,
    breakdownLine: formatBreakdownLine({ barKg: state.barKg, discs: state.discs }),
  };
}

// ─── Hash for auto-log dedupe ───────────────────────────────────────────────

/**
 * Stable, content-based hash for a bar + discs configuration. Two
 * configurations with the same bar weight and the same set of discs (in
 * any order, with any order within rows) hash to the same value.
 *
 * Used by the auto-log watcher to skip persisting a record when the coach
 * ends up at a configuration already logged in the previous tick.
 *
 * The hash is a string, not a number, because the input space is large
 * (any combination of weight/unit/count) and collisions in a 32-bit int
 * would produce false dedupes. 64-bit FNV-1a is overkill for this but
 * cheap, so we use it.
 */
export function hashState(state: { barKg: number; discs: DiscRow[] }): string {
  // Sort rows by (unit, weight, count) so the hash is order-independent.
  // `unit` participates so that `{25,kg,1}` and `{25,lb,1}` don't collide.
  const sorted = [...state.discs].sort((a, b) => {
    if (a.unit !== b.unit) return a.unit < b.unit ? -1 : 1;
    if (a.weight !== b.weight) return a.weight - b.weight;
    return a.count - b.count;
  });
  const discsPart = JSON.stringify(sorted);
  return `${state.barKg}|${discsPart}`;
}

// ─── Exercise name normalization ─────────────────────────────────────────────

/**
 * Returns a trimmed, single-spaced version of an exercise name. The original
 * capitalization is preserved (the autocomplete uses `dedupeExercises` for
 * case-insensitive grouping, not this function).
 *
 * Examples:
 *   "  Back  Squat  " → "Back Squat"
 *   "Press\tmilitar"  → "Press militar"
 */
export function normalizeExerciseName(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/**
 * Returns the unique exercise names from a list of records, in the order
 * they were first used (most recent first). The dedupe is case-insensitive
 * but preserves the capitalization of the first occurrence.
 */
export function dedupeExercises(
  items: SavedWeightRecord[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  // Walk from most recent to oldest so the most recent capitalization wins.
  for (let i = items.length - 1; i >= 0; i--) {
    const name = items[i].exercise;
    if (name === null) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}
