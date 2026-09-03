/**
 * Pure helpers for the analysis view's Recharts charts (issue 0039).
 *
 * All functions are side-effect-free. They operate on `SavedWeightRecord`
 * snapshots and the values the chart components need to render. Tested
 * in `chart-helpers.test.ts`.
 */
import type { SavedWeightRecord } from "../types";
import { estimateOneRepMax } from "./one-rm";

// ─── formatProgressionTick ───────────────────────────────────────────────────

const SPANISH_MONTHS_ABBR = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

/**
 * Formats an ISO timestamp as a short, locale-free Spanish date used as
 * the X-axis tick on the analysis charts. Format: `"DD mmm"` (e.g. `"03 sep"`).
 *
 * Uses local time (consistent with `history-page-client.tsx`'s
 * `formatAbsolute` so the chart ticks match the dates shown in the
 * exercise list). Returns the empty string for invalid input — Recharts
 * can render an empty label without crashing, and the chart will simply
 * skip that data point's tick.
 */
export function formatProgressionTick(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  return `${day} ${SPANISH_MONTHS_ABBR[d.getMonth()]}`;
}

// ─── rollingEstimatedOneRm ───────────────────────────────────────────────────

/**
 * Returns a rolling-window series of estimated 1RMs, one entry per input
 * record (in the same order). Each entry is the max of `estimateOneRepMax`
 * over a trailing window of size `windowSize` that ends at the record's
 * index. Records with `reps === null` are skipped from the max calculation
 * (treated as missing); if every record in the window is missing, the
 * entry is `null` so the chart can choose how to render the gap.
 *
 * Window truncation at the start of the series: for index `i`, the actual
 * window is `[max(0, i - windowSize + 1), i]`. So with 5 records and
 * `windowSize = 3`:
 *   - i=0,1 use a 1- and 2-wide window respectively
 *   - i=2,3,4 use a full 3-wide window
 *
 * The chart's purpose is to surface "recent best" — taking the max over
 * the window dampens single-record noise (a bad day, a warm-up miscue)
 * while still reacting to genuine new PRs. The default window of 3 is
 * the size that fits the project's typical training frequency (1-3
 * sessions per week per exercise).
 */
export function rollingEstimatedOneRm(
  records: SavedWeightRecord[],
  windowSize = 3,
): Array<number | null> {
  if (records.length === 0) return [];

  // Pre-compute the per-record e1RM so we don't call estimateOneRepMax
  // inside the inner loop. `null` is preserved for records with
  // `reps === null` so the max step can skip them.
  const perRecord: Array<number | null> = records.map(estimateOneRepMax);

  const result: Array<number | null> = new Array(perRecord.length);
  for (let i = 0; i < perRecord.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    let best: number | null = null;
    for (let j = start; j <= i; j++) {
      const v = perRecord[j];
      if (v === null) continue;
      if (best === null || v > best) best = v;
    }
    result[i] = best;
  }
  return result;
}
