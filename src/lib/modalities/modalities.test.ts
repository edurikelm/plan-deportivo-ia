/**
 * Unit tests for `src/lib/modalities/modalities.ts`.
 *
 * The file is a tiny registry: a readonly array of `Modality` records and
 * a `getModality(id)` lookup. The tests pin the registry's shape (so a
 * future addition can't accidentally break the contract) and the lookup
 * semantics (case-sensitive match, undefined on miss).
 */
import { describe, it, expect } from "vitest";
import { MODALITIES, getModality } from "./modalities";

describe("MODALITIES registry", () => {
  it("contains at least one modality (crossfit is required today)", () => {
    expect(MODALITIES.length).toBeGreaterThanOrEqual(1);
    expect(MODALITIES.find((m) => m.id === "crossfit")).toBeDefined();
  });

  it("every modality has the required fields populated", () => {
    for (const m of MODALITIES) {
      expect(m.id).toBeTypeOf("string");
      expect(m.id.length).toBeGreaterThan(0);
      expect(m.label).toBeTypeOf("string");
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.description).toBeTypeOf("string");
      expect(m.description.length).toBeGreaterThan(0);
      expect(m.accent).toBeTypeOf("string");
      expect(m.accent.length).toBeGreaterThan(0);
      expect(m.iconKey).toBeTypeOf("string");
      expect(m.iconKey.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate ids across modalities", () => {
    const ids = MODALITIES.map((m) => m.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe("getModality", () => {
  it("returns the matching modality by id", () => {
    const result = getModality("crossfit");
    expect(result).toBeDefined();
    expect(result?.id).toBe("crossfit");
    expect(result?.label).toBe("CrossFit");
  });

  it("returns undefined for an unknown id", () => {
    expect(getModality("powerlifting")).toBeUndefined();
    expect(getModality("")).toBeUndefined();
    expect(getModality("CrossFit")).toBeUndefined(); // case-sensitive
  });

  it("returns the same reference as MODALITIES.find for known ids", () => {
    expect(getModality("crossfit")).toBe(MODALITIES.find((m) => m.id === "crossfit"));
  });
});
