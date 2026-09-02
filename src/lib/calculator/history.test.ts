/**
 * Unit tests for the pure helpers in `src/lib/calculator/history.ts`.
 *
 * These are the first real unit tests in the project (after the smoke test
 * from ticket 0027 was removed). They cover the four pure functions
 * exported by the history module: `computeTotals`, `hashState`,
 * `normalizeExerciseName`, and `dedupeExercises`.
 */
import { describe, it, expect } from "vitest";
import {
  computeTotals,
  hashState,
  normalizeExerciseName,
  dedupeExercises,
} from "@/lib/calculator/history";
import type { DiscRow } from "@/lib/calculator/schemas";
import type { SavedWeightRecord } from "@/lib/types";

// ─── computeTotals ─────────────────────────────────────────────────────────

describe("computeTotals", () => {
  it("returns bar weight only for empty discs", () => {
    const result = computeTotals({ barKg: 20, discs: [] });
    expect(result.totalKg).toBe(20);
    expect(result.totalLb).toBeCloseTo(44.0924, 4);
    expect(result.breakdownLine).toBe("20kg");
  });

  it("doubles disc weight (one per side) for count=1", () => {
    const result = computeTotals({
      barKg: 20,
      discs: [{ weight: 10, unit: "kg", count: 1 }],
    });
    // 20 + 2 × 10 = 40
    expect(result.totalKg).toBe(40);
  });

  it("multiplies by count for stacked discs (count > 1)", () => {
    const result = computeTotals({
      barKg: 20,
      discs: [{ weight: 5, unit: "kg", count: 3 }],
    });
    // 20 + 2 × 5 × 3 = 50
    expect(result.totalKg).toBe(50);
  });

  it("converts lb discs to kg before summing", () => {
    const result = computeTotals({
      barKg: 20,
      discs: [{ weight: 55, unit: "lb", count: 1 }],
    });
    // 55 lb / 2.20462 = 24.9476... per side
    // 20 + 2 × 24.9476 = 69.8953
    expect(result.totalKg).toBeCloseTo(69.8953, 3);
  });

  it("sums mixed kg and lb discs correctly", () => {
    const result = computeTotals({
      barKg: 20,
      discs: [
        { weight: 10, unit: "kg", count: 1 },
        { weight: 55, unit: "lb", count: 1 },
      ],
    });
    // 20 + 2×10 + 2×24.9476 = 89.8953
    expect(result.totalKg).toBeCloseTo(89.8953, 3);
  });

  it("groups count=1 discs into a single parenthesised segment", () => {
    const result = computeTotals({
      barKg: 20,
      discs: [
        { weight: 25, unit: "kg", count: 1 },
        { weight: 10, unit: "kg", count: 1 },
      ],
    });
    expect(result.breakdownLine).toBe("20kg + (25kg + 10kg)×2");
  });

  it("renders count>1 discs inline as '(xunit)×n'", () => {
    const result = computeTotals({
      barKg: 20,
      discs: [{ weight: 5, unit: "kg", count: 3 }],
    });
    expect(result.breakdownLine).toBe("20kg + (5kg)×3");
  });

  it("mixes grouped and inline breakdown segments", () => {
    const result = computeTotals({
      barKg: 20,
      discs: [
        { weight: 25, unit: "kg", count: 1 },
        { weight: 5, unit: "kg", count: 2 },
      ],
    });
    expect(result.breakdownLine).toBe("20kg + (25kg)×2 + (5kg)×2");
  });

  it("preserves disc order in the grouped breakdown (input order)", () => {
    const result = computeTotals({
      barKg: 20,
      discs: [
        { weight: 10, unit: "kg", count: 1 },
        { weight: 25, unit: "kg", count: 1 },
      ],
    });
    expect(result.breakdownLine).toBe("20kg + (10kg + 25kg)×2");
  });
});

// ─── hashState ─────────────────────────────────────────────────────────────

describe("hashState", () => {
  const single = { weight: 10, unit: "kg" as const, count: 1 };

  it("is deterministic for the same input", () => {
    const state = { barKg: 20, discs: [single] };
    expect(hashState(state)).toBe(hashState(state));
  });

  it("is order-independent for discs", () => {
    const a = {
      barKg: 20,
      discs: [single, { weight: 25, unit: "kg" as const, count: 1 }],
    };
    const b = {
      barKg: 20,
      discs: [{ weight: 25, unit: "kg" as const, count: 1 }, single],
    };
    expect(hashState(a)).toBe(hashState(b));
  });

  it("differs when barKg differs", () => {
    expect(
      hashState({ barKg: 20, discs: [] }),
    ).not.toBe(hashState({ barKg: 15, discs: [] }));
  });

  it("does not collide between 25kg and 25lb (unit-sensitive)", () => {
    const a = {
      barKg: 20,
      discs: [{ weight: 25, unit: "kg" as const, count: 1 }],
    };
    const b = {
      barKg: 20,
      discs: [{ weight: 25, unit: "lb" as const, count: 1 }],
    };
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it("differs when disc count differs", () => {
    const a = {
      barKg: 20,
      discs: [{ weight: 25, unit: "kg" as const, count: 1 }],
    };
    const b = {
      barKg: 20,
      discs: [{ weight: 25, unit: "kg" as const, count: 2 }],
    };
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it("differs when disc weight differs", () => {
    const a = {
      barKg: 20,
      discs: [{ weight: 25, unit: "kg" as const, count: 1 }],
    };
    const b = {
      barKg: 20,
      discs: [{ weight: 10, unit: "kg" as const, count: 1 }],
    };
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it("encodes the barKg in the prefix of the output", () => {
    expect(hashState({ barKg: 20, discs: [] })).toMatch(/^20\|/);
    expect(hashState({ barKg: 15, discs: [] })).toMatch(/^15\|/);
  });
});

// ─── normalizeExerciseName ─────────────────────────────────────────────────

describe("normalizeExerciseName", () => {
  it("trims leading and trailing whitespace", () => {
    expect(normalizeExerciseName("  Back Squat  ")).toBe("Back Squat");
  });

  it("collapses multiple internal spaces into one", () => {
    expect(normalizeExerciseName("Back    Squat")).toBe("Back Squat");
  });

  it("normalizes tabs to a single space", () => {
    expect(normalizeExerciseName("Press\tmilitar")).toBe("Press militar");
  });

  it("normalizes newlines to a single space", () => {
    expect(normalizeExerciseName("Press\nmilitar")).toBe("Press militar");
  });

  it("preserves the original capitalization", () => {
    expect(normalizeExerciseName("BACK SQUAT")).toBe("BACK SQUAT");
    expect(normalizeExerciseName("back squat")).toBe("back squat");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeExerciseName("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeExerciseName("   \t  ")).toBe("");
  });
});

// ─── dedupeExercises ───────────────────────────────────────────────────────

describe("dedupeExercises", () => {
  // Minimal record factory: only the `exercise` and `createdAt` fields
  // matter for dedupe. Everything else is constant and irrelevant.
  const mk = (
    exercise: string | null,
    createdAt: string,
  ): SavedWeightRecord => ({
    id: `r-${createdAt}-${exercise ?? "null"}`,
    createdAt,
    exercise,
    barKg: 20,
    discs: [] as DiscRow[],
    totalKg: 20,
    totalLb: 44.0924,
    breakdownLine: "20kg",
    source: "manual",
  });

  it("returns empty array for empty input", () => {
    expect(dedupeExercises([])).toEqual([]);
  });

  it("skips records with null exercise (auto-log / foto)", () => {
    const items = [mk(null, "2026-01-01"), mk("Back Squat", "2026-01-02")];
    expect(dedupeExercises(items)).toEqual(["Back Squat"]);
  });

  it("orders results most-recent first", () => {
    const items = [
      mk("Back Squat", "2026-01-01"),
      mk("Press Militar", "2026-01-02"),
      mk("Deadlift", "2026-01-03"),
    ];
    expect(dedupeExercises(items)).toEqual([
      "Deadlift",
      "Press Militar",
      "Back Squat",
    ]);
  });

  it("deduplicates case-insensitively", () => {
    // "back squat" oldest, "BACK SQUAT" most recent.
    // The most recent wins (it's the first one seen while walking in reverse).
    const items = [
      mk("back squat", "2026-01-01"),
      mk("BACK SQUAT", "2026-01-02"),
    ];
    expect(dedupeExercises(items)).toEqual(["BACK SQUAT"]);
  });

  it("preserves the capitalization of the most-recent occurrence", () => {
    // "BACK SQUAT" oldest, "Back Squat" most recent → "Back Squat" wins.
    const items = [
      mk("BACK SQUAT", "2026-01-01"),
      mk("Back Squat", "2026-01-02"),
    ];
    expect(dedupeExercises(items)).toEqual(["Back Squat"]);
  });

  it("orders unique exercises by most-recent use (not by first occurrence)", () => {
    // Back Squat's most recent use (01-03) is newer than Deadlift's only use
    // (01-02), so Back Squat must appear before Deadlift in the output.
    const items = [
      mk("Back Squat", "2026-01-01"),
      mk("Deadlift", "2026-01-02"),
      mk("Back Squat", "2026-01-03"), // duplicate, ignored
      mk("Press", "2026-01-04"),
    ];
    expect(dedupeExercises(items)).toEqual([
      "Press",
      "Back Squat",
      "Deadlift",
    ]);
  });

  it("handles all-null exercises by returning an empty array", () => {
    const items = [mk(null, "2026-01-01"), mk(null, "2026-01-02")];
    expect(dedupeExercises(items)).toEqual([]);
  });
});
