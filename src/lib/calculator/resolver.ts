/**
 * Resolver — pure helper for the "Por objetivo" tab in
 * `/tools/weight-calculator`. Given a target total weight and a bar
 * weight, find the disc breakdown (per side) that achieves the target.
 *
 * If no exact match exists in the inventory, return the closest neighbors
 * above and below so the coach can choose.
 *
 * Stateless, side-effect-free, no DOM, no storage. Safe to import from
 * both server and client. The companion UI lives in
 * `src/app/tools/weight-calculator/_components/calculator-client.tsx`.
 *
 * See `CONTEXT.md` (section "Resolver") for the domain vocabulary.
 */
import type { DiscRow } from "./schemas";
import { computeTotals } from "./history";

// ─── Inventory defaults ────────────────────────────────────────────────────

/**
 * Default kg plate set used when the target is in kg. Hardcoded per
 * `CONTEXT.md` (configurable per box is a V2 follow-up).
 */
export const DEFAULT_INVENTORY_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

/**
 * Default lb plate set. Boxes that work in lb typically carry
 * 45 / 35 / 25 / 10 / 5 / 2.5 lb plates.
 */
export const DEFAULT_INVENTORY_LB = [45, 35, 25, 10, 5, 2.5] as const;

// ─── Public types ──────────────────────────────────────────────────────────

export type InventoryUnit = "kg" | "lb";

/**
 * Input to `resolveWeight`. The `target.unit` and `inventory` (when
 * provided) are interpreted in the same unit. The `barKg` is always
 * stored in kg — that's the existing convention in the calculator
 * (see `CalculatorState.barKg` in `schemas.ts`).
 */
export interface ResolveInput {
  /** Target total weight. The unit is also the unit the inventory is in
   *  (when an inventory is provided). */
  target: { value: number; unit: InventoryUnit };
  /** Bar weight in kg. The Olympic 20 kg bar and the women's 15 kg bar
   *  are the two common values; the calculator also supports "Otro" for
   *  custom bars (e.g. technique bars). */
  barKg: number;
  /** Plate sizes available, in the same unit as `target.unit`. When
   *  omitted, falls back to `DEFAULT_INVENTORY_KG` or `DEFAULT_INVENTORY_LB`
   *  depending on `target.unit`. */
  inventory?: readonly number[];
  /** Tolerance in kg for floating-point rounding. Default 0.05 (= 50 g),
   *  matching the tolerance used by `crossCheckBreakdown` in
   *  `schemas.ts`. */
  tolerance?: number;
}

export interface ResolvedLoad {
  /** Bar weight in kg (echoes the input, kept here for UI convenience). */
  barKg: number;
  /** Discs per side, sorted heaviest-innermost (descending by weight in
   *  the display unit). Adjacent discs of the same size are grouped via
   *  the `count` field. */
  discs: DiscRow[];
  /** Total weight in kg. */
  totalKg: number;
  /** Total weight in lb. */
  totalLb: number;
  /** Pre-formatted breakdown line via `formatBreakdownLine`, e.g.
   *  `"20kg + (25kg + 10kg)×2"`. */
  breakdownLine: string;
}

export type ResolveStatus = "exact" | "approximated";

export interface ResolveResult {
  /** `"exact"` when the target was hit precisely; `"approximated"` when
   *  the resolver had to fall back to neighbors. */
  status: ResolveStatus;
  /** The target as parsed, in both kg and lb. */
  target: { kg: number; lb: number };
  /** The exact breakdown, when `status === "exact"`. `null` otherwise. */
  exact: ResolvedLoad | null;
  /** Closest breakdown at or above the target. When `status === "exact"`,
   *  this equals `exact`. */
  above: ResolvedLoad;
  /** Closest breakdown at or below the target. When `status === "exact"`,
   *  this equals `exact`. */
  below: ResolvedLoad;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Resolves a target total weight into a bar + discs-per-side breakdown.
 *
 * Returns `null` only when the target is unreachable from the chosen bar:
 *  - target < bar (the bar alone is already heavier than the goal)
 *  - target > bar but no disc combination at all is achievable from the
 *    inventory (e.g. empty inventory)
 *
 * For all reachable targets, the function returns a `ResolveResult` with
 * up to three breakdowns (`above`, `below`, and optionally `exact`). The
 * UI presents `exact` when present, or `above` + `below` side by side
 * when there is no exact match.
 */
export function resolveWeight(input: ResolveInput): ResolveResult | null {
  const tolerance = input.tolerance ?? 0.05;

  // ── 1. Normalize the target to kg ──────────────────────────────────────
  const targetKg = toKg(input.target.value, input.target.unit);
  const targetLb = kgToLb(targetKg);

  // ── 2. Compute per-side residual ───────────────────────────────────────
  // (target - bar) / 2. Must be >= 0 for any solution to exist.
  const perSideKg = (targetKg - input.barKg) / 2;

  if (perSideKg < -tolerance) {
    return null;
  }

  // ── 3. Resolve inventory in kg ─────────────────────────────────────────
  const inventoryInUnit = input.inventory ?? defaultInventoryFor(input.target.unit);
  const inventoryKg = inventoryInUnit.map((d) => toKg(d, input.target.unit));

  // ── 4. Trivial case: target = bar ──────────────────────────────────────
  if (perSideKg <= tolerance) {
    const load = buildLoad(input.barKg, []);
    return {
      status: "exact",
      target: { kg: targetKg, lb: roundToLb(targetLb) },
      exact: load,
      above: load,
      below: load,
    };
  }

  // ── 5. Find exact, below, above in kg ──────────────────────────────────
  const exactDiscsKg = greedyExact(perSideKg, inventoryKg, tolerance);
  const belowDiscsKg =
    exactDiscsKg ??
    (inventoryKg.length > 0
      ? findClosest(perSideKg, inventoryKg, "below", tolerance)
      : null);
  const aboveDiscsKg =
    exactDiscsKg ??
    (inventoryKg.length > 0
      ? findClosest(perSideKg, inventoryKg, "above", tolerance)
      : null);

  if (!exactDiscsKg && !aboveDiscsKg && !belowDiscsKg) {
    return null;
  }

  // ── 6. Convert kg discs to the target unit, grouped into DiscRow rows
  const displayUnit = input.target.unit;
  const exactLoad = exactDiscsKg
    ? buildLoad(input.barKg, groupDiscsToRows(exactDiscsKg, displayUnit, tolerance))
    : null;
  const aboveLoad = aboveDiscsKg
    ? buildLoad(input.barKg, groupDiscsToRows(aboveDiscsKg, displayUnit, tolerance))
    : null;
  const belowLoad = belowDiscsKg
    ? buildLoad(input.barKg, groupDiscsToRows(belowDiscsKg, displayUnit, tolerance))
    : null;

  // ── 7. Compose the result ──────────────────────────────────────────────
  // Defensive: if a side is missing but the other exists, mirror the
  // available one so the UI never has to null-check individual fields.
  if (exactLoad) {
    return {
      status: "exact",
      target: { kg: targetKg, lb: roundToLb(targetLb) },
      exact: exactLoad,
      above: exactLoad,
      below: exactLoad,
    };
  }

  return {
    status: "approximated",
    target: { kg: targetKg, lb: roundToLb(targetLb) },
    exact: null,
    above: aboveLoad ?? belowLoad!,
    below: belowLoad ?? aboveLoad!,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const KG_PER_LB = 2.20462;
const LB_PER_KG = 1 / KG_PER_LB;

function lbToKg(lb: number): number {
  return lb * LB_PER_KG;
}

function kgToLb(kg: number): number {
  return kg * KG_PER_LB;
}

function toKg(value: number, unit: InventoryUnit): number {
  return unit === "kg" ? value : lbToKg(value);
}

function defaultInventoryFor(unit: InventoryUnit): readonly number[] {
  return unit === "kg" ? DEFAULT_INVENTORY_KG : DEFAULT_INVENTORY_LB;
}

function roundToLb(n: number): number {
  // Matches `formatWeightForDisplay` in the calculator client: kg values
  // pass through unchanged (the user typed them in legible precision like
  // 1.25), only lb values get 1-decimal rounding. 1.25 kg must stay
  // 1.25 kg — `Math.round(1.25 * 10) / 10` would yield 1.3 because
  // `Math.round(12.5) === 13` in JS (half-up).
  return Math.round(n * 10) / 10;
}

/**
 * Greedy descent: pick the largest disc that still fits, repeat until
 * the residual is below tolerance. Returns `null` if the residual can't
 * be cleared (i.e. the residual after greedy is still > tolerance).
 */
function greedyExact(
  perSideKg: number,
  inventory: readonly number[],
  tolerance: number,
): number[] | null {
  if (perSideKg < -tolerance) return null;
  if (perSideKg <= tolerance) return [];

  const sorted = [...inventory].sort((a, b) => b - a);
  const result: number[] = [];
  let r = perSideKg;

  for (const d of sorted) {
    while (r + tolerance >= d) {
      result.push(d);
      r -= d;
    }
  }

  return r <= tolerance ? result : null;
}

/**
 * Bounded DFS over the (sorted descending) inventory. For each disc we
 * try taking it 0..maxForThis times, where `maxForThis` is the count
 * that brings `current` to the boundary of `perSideKg` (above for
 * "above", below for "below"). The recursion prunes branches that have
 * already crossed the boundary for "below" and tracks the best sum.
 *
 * Bounded by `maxCount = ceil(perSideKg / smallest_disc) + 1`, which is
 * the worst-case count of the smallest plate. For typical CrossFit
 * weights and the default 7-size inventory this runs in < 1 ms.
 */
function findClosest(
  perSideKg: number,
  inventory: readonly number[],
  side: "below" | "above",
  tolerance: number,
): number[] | null {
  if (perSideKg < -tolerance) return null;
  if (perSideKg <= tolerance) return [];
  if (inventory.length === 0) return null;

  const sorted = [...inventory].sort((a, b) => b - a);
  const smallest = sorted[sorted.length - 1];
  const maxCount = Math.ceil(perSideKg / smallest) + 1;

  // For "below", 0 is always achievable (no discs) so it's the default.
  // For "above", we need to actually find something >= perSideKg.
  let bestSum = side === "below" ? 0 : Infinity;
  let bestDiscs: number[] = [];
  let found = side === "below";

  function dfs(idx: number, current: number, taken: number[]): void {
    if (side === "below" && current > perSideKg + tolerance) {
      return; // over the ceiling — prune
    }

    if (side === "below") {
      if (current <= perSideKg + tolerance && current > bestSum + tolerance) {
        bestSum = current;
        bestDiscs = [...taken];
        found = true;
      }
    } else {
      if (current >= perSideKg - tolerance && (!found || current < bestSum - tolerance)) {
        bestSum = current;
        bestDiscs = [...taken];
        found = true;
      }
    }

    if (idx >= sorted.length) return;

    const disc = sorted[idx];
    const maxForThis = side === "below"
      ? Math.max(0, Math.floor((perSideKg - current) / disc) + 1)
      : Math.max(0, Math.ceil((perSideKg - current) / disc));
    const capped = Math.min(maxForThis, maxCount);

    for (let c = capped; c >= 0; c--) {
      const newTaken = taken.slice();
      for (let i = 0; i < c; i++) newTaken.push(disc);
      dfs(idx + 1, current + c * disc, newTaken);
    }
  }

  dfs(0, 0, []);
  return found ? bestDiscs : null;
}

/**
 * Group a flat list of individual disc weights (in kg) into `DiscRow`
 * rows, expressed in the display unit. Adjacent equal weights collapse
 * into a single `count > 1` row, matching how the Manual tab stores
 * discs (`DiscRowSchema` in `schemas.ts`).
 *
 * The conversion kg → lb uses the same 1-decimal rounding as the rest
 * of the calculator (see `formatWeightForDisplay` in the client). kg
 * values pass through unchanged — 1.25 kg stays 1.25 kg, NOT 1.3
 * (which is what `Math.round(1.25 * 10) / 10` would yield because
 * `Math.round(12.5) === 13` in JS). The grouping tolerance (0.05)
 * absorbs the floating-point drift introduced by the conversion
 * (1.25 kg = 2.7557… lb rounds to 2.8 lb; two of them still group).
 */
function groupDiscsToRows(
  discsKg: readonly number[],
  unit: InventoryUnit,
  tolerance: number,
): DiscRow[] {
  const inUnit = discsKg.map((d) =>
    unit === "kg" ? d : roundToLb(kgToLb(d)),
  );
  const groups: DiscRow[] = [];
  for (const w of inUnit) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.weight - w) <= tolerance) {
      last.count += 1;
    } else {
      groups.push({ weight: w, unit, count: 1 });
    }
  }
  return groups;
}

/**
 * Wraps `computeTotals` and stamps the breakdown line.
 *
 * Totals are not rounded: kg values are already in user-readable
 * precision, and the 1-decimal rounding for lb is handled by the
 * downstream display formatter (`formatWeightForDisplay`).
 */
function buildLoad(barKg: number, discs: DiscRow[]): ResolvedLoad {
  const totals = computeTotals({ barKg, discs });
  return {
    barKg,
    discs,
    totalKg: totals.totalKg,
    totalLb: totals.totalLb,
    breakdownLine: totals.breakdownLine,
  };
}
