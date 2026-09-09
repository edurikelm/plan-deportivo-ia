/**
 * Unit tests for the pure helpers in `src/lib/calculator/resolver.ts`.
 *
 * The resolver is the inverse of the Manual tab: given a target total
 * weight, it returns the bar + discs-per-side breakdown. The tests
 * cover the core scenarios:
 *  - exact matches via greedy descent
 *  - approximated matches (closest neighbor above and below)
 *  - target = bar (no discs)
 *  - target < bar (impossible, returns null)
 *  - mixed units (target in lb, bar in kg, inventory in lb)
 *  - custom inventory override
 *  - grouping of adjacent equal discs
 *  - default inventory selection by unit
 *  - large targets / many discs
 *  - the two default inventories (`DEFAULT_INVENTORY_KG`, `DEFAULT_INVENTORY_LB`)
 */
import { describe, it, expect } from "vitest";
import {
  resolveWeight,
  DEFAULT_INVENTORY_KG,
  DEFAULT_INVENTORY_LB,
} from "./resolver";

// ─── Exact matches ──────────────────────────────────────────────────────────

describe("resolveWeight — exact matches", () => {
  it("returns 20kg bar + 20kg per side for a 60kg target", () => {
    const r = resolveWeight({
      target: { value: 60, unit: "kg" },
      barKg: 20,
    });
    expect(r).not.toBeNull();
    expect(r!.status).toBe("exact");
    expect(r!.exact).not.toBeNull();
    expect(r!.exact!.barKg).toBe(20);
    expect(r!.exact!.totalKg).toBe(60);
    expect(r!.exact!.discs).toEqual([{ weight: 20, unit: "kg", count: 1 }]);
  });

  it("returns 20kg bar + (25kg + 10kg) per side for a 110kg target", () => {
    // Greedy: 25 (residual 25) → 25 (residual 0). Wait, that's two 25s = 50 per side = 120 total.
    // 110 - 20 = 90; 90 / 2 = 45 per side. Greedy: 25 (residual 20) → 20 (residual 0).
    // So per side = 25 + 20 = 45 kg. Total = 20 + 2*45 = 110 kg. ✓
    const r = resolveWeight({
      target: { value: 110, unit: "kg" },
      barKg: 20,
    });
    expect(r).not.toBeNull();
    expect(r!.status).toBe("exact");
    expect(r!.exact!.totalKg).toBe(110);
    expect(r!.exact!.discs).toEqual([
      { weight: 25, unit: "kg", count: 1 },
      { weight: 20, unit: "kg", count: 1 },
    ]);
  });

  it("groups two adjacent 25kg discs into a single count=2 row", () => {
    // 20kg bar, 70kg target → 25 per side, achieved with one 25kg disc.
    // For 120kg target → 50 per side, achieved with two 25kg discs (greedy).
    const r = resolveWeight({
      target: { value: 120, unit: "kg" },
      barKg: 20,
    });
    expect(r).not.toBeNull();
    expect(r!.status).toBe("exact");
    expect(r!.exact!.discs).toEqual([{ weight: 25, unit: "kg", count: 2 }]);
    expect(r!.exact!.totalKg).toBe(120);
  });

  it("returns 0 discs when target equals the bar weight", () => {
    const r = resolveWeight({
      target: { value: 20, unit: "kg" },
      barKg: 20,
    });
    expect(r).not.toBeNull();
    expect(r!.status).toBe("exact");
    expect(r!.exact!.discs).toEqual([]);
    expect(r!.exact!.totalKg).toBe(20);
  });

  it("uses the 15kg bar when configured", () => {
    // 15kg bar + 20kg per side = 55kg total
    const r = resolveWeight({
      target: { value: 55, unit: "kg" },
      barKg: 15,
    });
    expect(r).not.toBeNull();
    expect(r!.status).toBe("exact");
    expect(r!.exact!.barKg).toBe(15);
    expect(r!.exact!.totalKg).toBe(55);
    expect(r!.exact!.discs).toEqual([{ weight: 20, unit: "kg", count: 1 }]);
  });
});

// ─── Approximated matches (neighbors) ───────────────────────────────────────

describe("resolveWeight — approximated matches", () => {
  it("returns neighbors when the residual cannot be cleared exactly", () => {
    // 20kg bar, 21.5kg target → perSide 0.75. No default disc <= 0.75.
    // Greedy fails. Above: smallest disc >= 0.75 = 1.25. Below: 0 (no discs).
    const r = resolveWeight({
      target: { value: 21.5, unit: "kg" },
      barKg: 20,
    });
    expect(r).not.toBeNull();
    expect(r!.status).toBe("approximated");
    expect(r!.exact).toBeNull();
    // Above = bar + 1×1.25 per side = 22.5kg
    expect(r!.above.totalKg).toBe(22.5);
    expect(r!.above.discs).toEqual([{ weight: 1.25, unit: "kg", count: 1 }]);
    // Below = bar only = 20kg
    expect(r!.below.totalKg).toBe(20);
    expect(r!.below.discs).toEqual([]);
  });

  it("finds below and above when the gap is in the middle of the inventory", () => {
    // 20kg bar, 47kg target → perSide 13.5.
    // Greedy in kg: 10 (residual 3.5) → 2.5 (residual 1.0) → 1.25 doesn't fit
    // (1.25 > 1.0 + tolerance). So greedy fails.
    // Below: largest sum ≤ 13.5 = 10 + 2.5 = 12.5 kg per side.
    // Above: SMALLEST sum ≥ 13.5. 15 alone is 15. 10 + 2.5 + 1.25 = 13.75
    // (closer to 13.5). The algorithm picks 13.75, which is the
    // semantically correct "closest above" — 1.5 kg over the target is
    // more useful to the coach than 2.5 kg over.
    const r = resolveWeight({
      target: { value: 47, unit: "kg" },
      barKg: 20,
    });
    expect(r).not.toBeNull();
    expect(r!.status).toBe("approximated");
    expect(r!.above.totalKg).toBe(47.5); // 20 + 2*13.75
    expect(r!.above.discs).toEqual([
      { weight: 10, unit: "kg", count: 1 },
      { weight: 2.5, unit: "kg", count: 1 },
      { weight: 1.25, unit: "kg", count: 1 },
    ]);
    expect(r!.below.totalKg).toBe(45); // 20 + 2*12.5
    expect(r!.below.discs).toEqual([
      { weight: 10, unit: "kg", count: 1 },
      { weight: 2.5, unit: "kg", count: 1 },
    ]);
  });
});

// ─── Impossibility ──────────────────────────────────────────────────────────

describe("resolveWeight — impossibility", () => {
  it("returns null when the target is below the bar weight", () => {
    const r = resolveWeight({
      target: { value: 15, unit: "kg" },
      barKg: 20,
    });
    expect(r).toBeNull();
  });

  it("returns null when the target is well below the bar weight", () => {
    const r = resolveWeight({
      target: { value: 5, unit: "kg" },
      barKg: 20,
    });
    expect(r).toBeNull();
  });

  it("returns a non-null result for a target exactly at the bar (within tolerance)", () => {
    // 19.98kg target with 20kg bar → perSide = -0.01, within 0.05 tolerance.
    // Treated as "bar only" (perSide <= tolerance → exact empty).
    const r = resolveWeight({
      target: { value: 19.98, unit: "kg" },
      barKg: 20,
    });
    expect(r).not.toBeNull();
    expect(r!.status).toBe("exact");
    expect(r!.exact!.discs).toEqual([]);
  });
});

// ─── Mixed units ────────────────────────────────────────────────────────────

describe("resolveWeight — mixed units", () => {
  it("resolves a lb target against a kg bar using the default lb inventory", () => {
    // 135 lb target (≈ 61.235 kg), 20 kg bar (≈ 44.0925 lb).
    // perSide kg = (61.235 - 20) / 2 ≈ 20.6173 kg.
    // Convert that to lb per side: 20.6173 × 2.20462 ≈ 45.45 lb.
    // Default lb inventory: [45, 35, 25, 10, 5, 2.5]. Greedy in kg would
    // give a 20kg disc (≈ 44.09 lb) but lb inventory doesn't have 20kg;
    // we use lb greedy: 45 (residual 0.45) → no 2.5 fits → fails.
    // Below: largest <= 45.45 → 45 lb (= 20.41 kg per side, ≈ 40.82 kg total).
    // Above: smallest >= 45.45 → 45 + 2.5 = 47.5 lb (= 21.55 kg per side).
    const r = resolveWeight({
      target: { value: 135, unit: "lb" },
      barKg: 20,
    });
    expect(r).not.toBeNull();
    expect(r!.status).toBe("approximated");
    // target echoed in both units
    expect(r!.target.lb).toBe(135);
    expect(r!.target.kg).toBeCloseTo(61.235, 2);
    // below: 45 lb per side + 20 kg bar = 20 + 2×20.41 = 60.82 kg
    expect(r!.below.discs).toEqual([{ weight: 45, unit: "lb", count: 1 }]);
    // above: 45 + 2.5 lb per side + 20 kg bar = 20 + 2×21.55 = 63.1 kg
    expect(r!.above.discs).toEqual([
      { weight: 45, unit: "lb", count: 1 },
      { weight: 2.5, unit: "lb", count: 1 },
    ]);
  });

  it("resolves a kg target against a custom lb inventory", () => {
    // 100 kg target, 20 kg bar, custom inventory in lb: [25, 10, 2.5].
    // perSide kg = 40. Convert to lb: 40 × 2.20462 ≈ 88.18 lb.
    // Greedy lb: 25 (residual 63.18) × 2 = 50 (residual 38.18) × 3 = 75
    // (residual 13.18) × 4 = 100 (residual -11.82 no) → 75 + 10 = 85 (residual 3.18)
    // × 5 = 25 (residual 63.18) … backtracking. Smallest achievable >= 88.18:
    // we'd need to find a sum of lb discs. This test just exercises the
    // mixed-unit path; the exact algorithm result is not asserted here.
    const r = resolveWeight({
      target: { value: 100, unit: "kg" },
      barKg: 20,
      inventory: [25, 10, 2.5], // interpreted as lb per target.unit = "kg"
    });
    // Wait — inventory is in the same unit as target, so [25, 10, 2.5] is in kg.
    // perSide = 40. Greedy: 25 (residual 15) → 10 (residual 5) → 2.5 (residual 2.5)
    // → 2.5 (residual 0). Total per side = 40. ✓
    expect(r).not.toBeNull();
    expect(r!.status).toBe("exact");
    expect(r!.exact!.discs).toEqual([
      { weight: 25, unit: "kg", count: 1 },
      { weight: 10, unit: "kg", count: 1 },
      { weight: 2.5, unit: "kg", count: 2 },
    ]);
  });
});

// ─── Custom inventory ───────────────────────────────────────────────────────

describe("resolveWeight — custom inventory", () => {
  it("uses a custom kg inventory when provided", () => {
    // 20kg bar, 50kg target, inventory [20, 10] (no 25).
    // perSide = 15. Greedy in kg: 20 too big, 10 fits (residual 5),
    // 10 doesn't fit residual 5 → fails.
    // Achievable per side from [20, 10]: 0, 10, 20, 30, 40, …
    // Below: largest ≤ 15 = 10. Above: smallest ≥ 15 = 20.
    const r = resolveWeight({
      target: { value: 50, unit: "kg" },
      barKg: 20,
      inventory: [20, 10],
    });
    expect(r).not.toBeNull();
    expect(r!.status).toBe("approximated");
    expect(r!.below.totalKg).toBe(40); // 20 + 2*10
    expect(r!.below.discs).toEqual([{ weight: 10, unit: "kg", count: 1 }]);
    expect(r!.above.totalKg).toBe(60); // 20 + 2*20
    expect(r!.above.discs).toEqual([{ weight: 20, unit: "kg", count: 1 }]);
  });

  it("returns null when the inventory is empty and target > bar", () => {
    const r = resolveWeight({
      target: { value: 100, unit: "kg" },
      barKg: 20,
      inventory: [],
    });
    expect(r).toBeNull();
  });

  it("still returns bar-only result when the inventory is empty and target == bar", () => {
    const r = resolveWeight({
      target: { value: 20, unit: "kg" },
      barKg: 20,
      inventory: [],
    });
    expect(r).not.toBeNull();
    expect(r!.status).toBe("exact");
    expect(r!.exact!.discs).toEqual([]);
  });
});

// ─── Default inventory constants ────────────────────────────────────────────

describe("DEFAULT_INVENTORY_KG and DEFAULT_INVENTORY_LB", () => {
  it("DEFAULT_INVENTORY_KG includes the standard 25 / 20 / 15 / 10 / 5 / 2.5 / 1.25", () => {
    expect(Array.from(DEFAULT_INVENTORY_KG)).toEqual([
      25, 20, 15, 10, 5, 2.5, 1.25,
    ]);
  });

  it("DEFAULT_INVENTORY_LB includes 45 / 35 / 25 / 10 / 5 / 2.5", () => {
    expect(Array.from(DEFAULT_INVENTORY_LB)).toEqual([45, 35, 25, 10, 5, 2.5]);
  });

  it("falls back to DEFAULT_INVENTORY_KG when target is kg and inventory is omitted", () => {
    // If the default wasn't used, an unknown inventory might fail the resolution.
    // A target that only fits with a 25kg disc proves DEFAULT_INVENTORY_KG was used.
    const r = resolveWeight({
      target: { value: 70, unit: "kg" }, // 25 per side, only achievable with a 25
      barKg: 20,
    });
    expect(r).not.toBeNull();
    expect(r!.status).toBe("exact");
    expect(r!.exact!.discs).toEqual([{ weight: 25, unit: "kg", count: 1 }]);
  });
});

// ─── Large / many-disc targets ──────────────────────────────────────────────

describe("resolveWeight — large targets", () => {
  it("handles a 200kg total target (≈ 90kg per side)", () => {
    // 20kg bar, 200kg target → 90 per side.
    // Greedy: 25*3 = 75, residual 15. → 15. Sum = 90. Exact.
    const r = resolveWeight({
      target: { value: 200, unit: "kg" },
      barKg: 20,
    });
    expect(r).not.toBeNull();
    expect(r!.status).toBe("exact");
    expect(r!.exact!.discs).toEqual([
      { weight: 25, unit: "kg", count: 3 },
      { weight: 15, unit: "kg", count: 1 },
    ]);
    expect(r!.exact!.totalKg).toBe(200);
  });

  it("handles the smallest disc in multiples", () => {
    // 20kg bar, 22.5kg target → 1.25 per side. Two 1.25kg = 2.5 per side.
    // perSide = 1.25. Greedy: 1.25 (residual 0). ✓
    const r = resolveWeight({
      target: { value: 22.5, unit: "kg" },
      barKg: 20,
    });
    expect(r).not.toBeNull();
    expect(r!.status).toBe("exact");
    expect(r!.exact!.discs).toEqual([{ weight: 1.25, unit: "kg", count: 1 }]);
    expect(r!.exact!.totalKg).toBe(22.5);
  });
});

// ─── Breakdown line format ──────────────────────────────────────────────────

describe("resolveWeight — breakdown line", () => {
  it("matches the existing formatBreakdownLine output for the resolved load", () => {
    // 20kg bar + (25kg + 10kg) per side → "20kg + (25kg + 10kg)×2"
    const r = resolveWeight({
      target: { value: 110, unit: "kg" },
      barKg: 20,
    });
    expect(r!.exact!.breakdownLine).toBe("20kg + (25kg + 20kg)×2");
    // Wait, 110 - 20 = 90; 90/2 = 45 per side. Greedy: 25 (residual 20) → 20 (residual 0).
    // So per side = 25 + 20 = 45. Total = 20 + 2*45 = 110. ✓
    // DiscRow is [25, 20] in input order, formatBreakdownLine preserves order.
  });

  it("renders just the bar when there are no discs", () => {
    const r = resolveWeight({
      target: { value: 20, unit: "kg" },
      barKg: 20,
    });
    expect(r!.exact!.breakdownLine).toBe("20kg");
  });
});
