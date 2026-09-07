/**
 * Tests for the curated typical-exercises catalog (issue 0043).
 *
 * 100% line + branch coverage on the helpers. The catalog itself is a
 * static data table; we sanity-check its size, ordering, and the absence
 * of duplicates because those are the invariants the chip row and the
 * datalist depend on.
 */
import { describe, it, expect } from "vitest";
import {
  TYPICAL_EXERCISES,
  getTypicalExerciseNames,
  findTypicalByName,
  mergeTypicalAndHistory,
} from "./typical-exercises";

describe("TYPICAL_EXERCISES — catalog invariants", () => {
  it("has at least 20 entries", () => {
    // The chip row depends on a meaningful selection. Below 20 it would
    // feel thin for a coach who trains with a barbell; we ship more.
    expect(TYPICAL_EXERCISES.length).toBeGreaterThanOrEqual(20);
  });

  it("has no duplicate canonical names (case-insensitive)", () => {
    const keys = TYPICAL_EXERCISES.map((e) => e.name.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every entry has a non-empty, trimmed name", () => {
    for (const e of TYPICAL_EXERCISES) {
      expect(e.name).toBeTruthy();
      expect(e.name).toBe(e.name.trim());
    }
  });

  it("every entry has a valid category", () => {
    const valid: ReadonlyArray<string> = [
      "squat",
      "hinge",
      "push",
      "pull",
      "overhead",
      "olympic",
      "accessory",
    ];
    for (const e of TYPICAL_EXERCISES) {
      expect(valid).toContain(e.category);
    }
  });

  it("includes the six most common movements expected by the AC", () => {
    // The acceptance criteria names six exercises the chip row must surface.
    const names = TYPICAL_EXERCISES.map((e) => e.name);
    for (const required of [
      "Sentadilla trasera",
      "Peso muerto convencional",
      "Press banca",
      "Press militar",
      "Remo con barra",
      "Dominada",
    ]) {
      expect(names).toContain(required);
    }
  });
});

describe("getTypicalExerciseNames", () => {
  it("returns the canonical names in catalog order", () => {
    const names = getTypicalExerciseNames();
    expect(names[0]).toBe("Sentadilla trasera");
    expect(names).toEqual(TYPICAL_EXERCISES.map((e) => e.name));
  });

  it("returns a fresh array (mutating the result does not corrupt the catalog)", () => {
    const names = getTypicalExerciseNames();
    names.push("HACK");
    expect(getTypicalExerciseNames()).not.toContain("HACK");
  });
});

describe("findTypicalByName", () => {
  it("resolves a canonical name verbatim", () => {
    const found = findTypicalByName("Sentadilla trasera");
    expect(found?.name).toBe("Sentadilla trasera");
    expect(found?.alias).toBe("Back Squat");
    expect(found?.category).toBe("squat");
  });

  it("resolves case-insensitively", () => {
    const found = findTypicalByName("PRESS banca");
    expect(found?.name).toBe("Press banca");
  });

  it("resolves with surrounding whitespace", () => {
    const found = findTypicalByName("  press militar  ");
    expect(found?.name).toBe("Press militar");
  });

  it("does NOT match by English alias — only the canonical Spanish name wins", () => {
    // The coach might type "Back Squat" but the chip-row "active" state
    // only highlights when the input matches the canonical Spanish name.
    // This is intentional: the alias is a display hint, not a synonym.
    const found = findTypicalByName("Back Squat");
    expect(found).toBeUndefined();
  });

  it("returns undefined for an unknown name", () => {
    expect(findTypicalByName("Snatch con banda")).toBeUndefined();
  });

  it("returns undefined for empty / whitespace-only input", () => {
    expect(findTypicalByName("")).toBeUndefined();
    expect(findTypicalByName("   ")).toBeUndefined();
  });
});

describe("mergeTypicalAndHistory", () => {
  it("puts typical names first, then history-only names", () => {
    const merged = mergeTypicalAndHistory(
      ["Sentadilla trasera", "Press banca"],
      ["Press banca", "Back Squat"],
    );
    expect(merged).toEqual(["Sentadilla trasera", "Press banca", "Back Squat"]);
  });

  it("dedupes case-insensitively, keeping the first occurrence", () => {
    const merged = mergeTypicalAndHistory(
      ["Press banca"],
      ["press BANCA", "Back Squat"],
    );
    expect(merged).toEqual(["Press banca", "Back Squat"]);
  });

  it("drops empty and whitespace-only entries", () => {
    const merged = mergeTypicalAndHistory(
      ["Sentadilla trasera", "", "   "],
      ["", "Press banca"],
    );
    expect(merged).toEqual(["Sentadilla trasera", "Press banca"]);
  });

  it("returns an empty array when both inputs are empty", () => {
    expect(mergeTypicalAndHistory([], [])).toEqual([]);
  });

  it("trims surrounding whitespace from each entry", () => {
    const merged = mergeTypicalAndHistory(["  Press banca  "], []);
    expect(merged).toEqual(["Press banca"]);
  });
});
