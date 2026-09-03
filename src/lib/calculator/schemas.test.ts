/**
 * Unit tests for the pure helpers in `src/lib/calculator/schemas.ts`.
 *
 * The file exports a mix of pure helpers and LLM-bound code. The tests
 * cover only the pure helpers:
 *  - `formatBreakdownLine(state)` — deterministic formatter.
 *  - `crossCheckBreakdown(breakdown)` — pure comparison (50g tolerance).
 *
 * `calculateBreakdownFromImage` is out of scope — it requires mocking
 * the `openai` SDK. `VISION_MODEL` / `VISION_SYSTEM_PROMPT` are
 * constants and not tested.
 */
import { describe, it, expect } from "vitest";
import {
  formatBreakdownLine,
  crossCheckBreakdown,
  DiscRowSchema,
  BreakdownSchema,
  SavedWeightRecordSchema,
  type Breakdown,
} from "./schemas";

// ─── formatBreakdownLine ─────────────────────────────────────────────────────

describe("formatBreakdownLine", () => {
  it("renders just the bar when there are no discs", () => {
    expect(formatBreakdownLine({ barKg: 20, discs: [] })).toBe("20kg");
  });

  it("groups count=1 discs into a single parenthesised segment with ×2", () => {
    expect(
      formatBreakdownLine({
        barKg: 20,
        discs: [
          { weight: 25, unit: "kg", count: 1 },
          { weight: 10, unit: "kg", count: 1 },
        ],
      }),
    ).toBe("20kg + (25kg + 10kg)×2");
  });

  it("renders count>1 discs inline as '(xunit)×n'", () => {
    expect(
      formatBreakdownLine({
        barKg: 20,
        discs: [{ weight: 5, unit: "kg", count: 3 }],
      }),
    ).toBe("20kg + (5kg)×3");
  });

  it("mixes grouped count=1 discs and inline count>1 discs", () => {
    expect(
      formatBreakdownLine({
        barKg: 20,
        discs: [
          { weight: 25, unit: "kg", count: 1 },
          { weight: 5, unit: "kg", count: 2 },
        ],
      }),
    ).toBe("20kg + (25kg)×2 + (5kg)×2");
  });

  it("preserves the input order of discs in the breakdown", () => {
    expect(
      formatBreakdownLine({
        barKg: 20,
        discs: [
          { weight: 10, unit: "kg", count: 1 },
          { weight: 25, unit: "kg", count: 1 },
        ],
      }),
    ).toBe("20kg + (10kg + 25kg)×2");
  });

  it("renders lb discs with their unit suffix (no conversion)", () => {
    expect(
      formatBreakdownLine({
        barKg: 20,
        discs: [{ weight: 55, unit: "lb", count: 1 }],
      }),
    ).toBe("20kg + (55lb)×2");
  });
});

// ─── crossCheckBreakdown ─────────────────────────────────────────────────────

describe("crossCheckBreakdown", () => {
  it("returns ok=true when computed totals match the reported totals", () => {
    const breakdown: Breakdown = {
      barKg: 20,
      discs: [{ weight: 25, unit: "kg", count: 1 }],
      totalKg: 20 + 2 * 25,
      totalLb: (20 + 2 * 25) * 2.20462,
    };
    const result = crossCheckBreakdown(breakdown);
    expect(result.ok).toBe(true);
    expect(result.computedKg).toBeCloseTo(70, 4);
    expect(result.computedLb).toBeCloseTo(154.3234, 3);
  });

  it("returns ok=true when the kg diff is within 50g tolerance", () => {
    const breakdown: Breakdown = {
      barKg: 20,
      discs: [{ weight: 25, unit: "kg", count: 1 }],
      totalKg: 20 + 2 * 25 + 0.04, // 4g off — within 50g tolerance
      totalLb: (20 + 2 * 25) * 2.20462,
    };
    expect(crossCheckBreakdown(breakdown).ok).toBe(true);
  });

  it("returns ok=false when the kg diff exceeds 50g tolerance", () => {
    const breakdown: Breakdown = {
      barKg: 20,
      discs: [{ weight: 25, unit: "kg", count: 1 }],
      totalKg: 20 + 2 * 25 + 0.1, // 100g off — outside tolerance
      totalLb: (20 + 2 * 25) * 2.20462,
    };
    const result = crossCheckBreakdown(breakdown);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("MISMATCH");
  });

  it("converts lb discs to kg before computing the total", () => {
    const breakdown: Breakdown = {
      barKg: 20,
      discs: [{ weight: 55, unit: "lb", count: 1 }], // 55 lb ≈ 24.9476 kg
      totalKg: 20 + 2 * (55 / 2.20462), // 69.8953
      totalLb: (20 + 2 * (55 / 2.20462)) * 2.20462,
    };
    const result = crossCheckBreakdown(breakdown);
    expect(result.ok).toBe(true);
    expect(result.computedKg).toBeCloseTo(69.8953, 3);
  });

  it("includes the computed totals in the response", () => {
    const breakdown: Breakdown = {
      barKg: 20,
      discs: [],
      totalKg: 20,
      totalLb: 44.0924,
    };
    const result = crossCheckBreakdown(breakdown);
    expect(result.computedKg).toBe(20);
    expect(result.computedLb).toBeCloseTo(44.0924, 3);
  });
});

// ─── DiscRowSchema / BreakdownSchema (Zod) ───────────────────────────────────

describe("DiscRowSchema", () => {
  it("accepts a valid kg row", () => {
    expect(
      DiscRowSchema.safeParse({ weight: 25, unit: "kg", count: 1 }).success,
    ).toBe(true);
  });

  it("accepts a valid lb row", () => {
    expect(
      DiscRowSchema.safeParse({ weight: 55, unit: "lb", count: 2 }).success,
    ).toBe(true);
  });

  it("rejects negative weight", () => {
    expect(
      DiscRowSchema.safeParse({ weight: -5, unit: "kg", count: 1 }).success,
    ).toBe(false);
  });

  it("rejects zero weight", () => {
    expect(
      DiscRowSchema.safeParse({ weight: 0, unit: "kg", count: 1 }).success,
    ).toBe(false);
  });

  it("rejects non-integer count", () => {
    expect(
      DiscRowSchema.safeParse({ weight: 25, unit: "kg", count: 1.5 }).success,
    ).toBe(false);
  });

  it("rejects count < 1", () => {
    expect(
      DiscRowSchema.safeParse({ weight: 25, unit: "kg", count: 0 }).success,
    ).toBe(false);
  });

  it("rejects unknown unit", () => {
    expect(
      DiscRowSchema.safeParse({ weight: 25, unit: "g", count: 1 }).success,
    ).toBe(false);
  });
});

describe("BreakdownSchema", () => {
  it("accepts a valid breakdown", () => {
    const result = BreakdownSchema.safeParse({
      barKg: 20,
      discs: [{ weight: 25, unit: "kg", count: 1 }],
      totalKg: 70,
      totalLb: 154.3234,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative totalKg", () => {
    const result = BreakdownSchema.safeParse({
      barKg: 20,
      discs: [],
      totalKg: -1,
      totalLb: 1,
    });
    expect(result.success).toBe(false);
  });
});

// ─── SavedWeightRecordSchema (issue 0036 migration) ─────────────────────────

/**
 * Verifies the silent migration of legacy `SavedWeightRecord` entries
 * (pre-0036: no `reps`, no `isOneRepMax`) and the rejection of malformed
 * `reps` values. The storage parser in `lib/storage.ts` drops entries
 * that fail this schema, so a passing test here means the entry survives
 * `parseRecordsFromRaw` and rehydrates with sensible defaults.
 */
describe("SavedWeightRecordSchema — legacy migration (issue 0036)", () => {
  // Minimal valid record. We only need the fields the schema reads; the
  // other fields are populated with placeholders that pass their own
  // sub-validators.
  const validBase = {
    id: "test-id",
    createdAt: "2026-08-15T00:00:00.000Z",
    exercise: "Back Squat",
    barKg: 20,
    discs: [],
    totalKg: 100,
    totalLb: 220.462,
    breakdownLine: "20kg + (40kg)×2",
    source: "manual" as const,
  };

  it("rehydrates a legacy record (no reps, no isOneRepMax) with null + false", () => {
    const result = SavedWeightRecordSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reps).toBeNull();
      expect(result.data.isOneRepMax).toBe(false);
    }
  });

  it("accepts reps: null explicitly (foto / explicitly nulled records)", () => {
    const result = SavedWeightRecordSchema.safeParse({
      ...validBase,
      reps: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reps).toBeNull();
    }
  });

  it("rejects a negative reps value (storage parser will drop the record)", () => {
    const result = SavedWeightRecordSchema.safeParse({
      ...validBase,
      reps: -3,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer reps value (storage parser will drop the record)", () => {
    const result = SavedWeightRecordSchema.safeParse({
      ...validBase,
      reps: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid reps and preserves isOneRepMax override", () => {
    const result = SavedWeightRecordSchema.safeParse({
      ...validBase,
      reps: 1,
      isOneRepMax: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reps).toBe(1);
      expect(result.data.isOneRepMax).toBe(true);
    }
  });
});
