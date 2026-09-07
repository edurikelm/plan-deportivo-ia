/**
 * Tests for the curated typical-exercises catalog (issue 0043, revised 0044).
 *
 * 100% line + branch coverage on the helpers. The catalog itself is a
 * static data table; we sanity-check its size, ordering, and the absence
 * of duplicates because those are the invariants the datalist and the
 * chip-row wiring depend on.
 *
 * As of 0044 names are English-only (no `alias` field) and the canonical
 * spellings are the English names.
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
    // The datalist depends on a meaningful selection. Below 20 it would
    // feel thin for a coach who trains with a barbell; we ship more.
    expect(TYPICAL_EXERCISES.length).toBeGreaterThanOrEqual(20);
  });

  it("has no duplicate canonical names (case-insensitive)", () => {
    const keys = TYPICAL_EXERCISES.map((e) => e.name.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every entry has a non-empty, trimmed English name", () => {
    for (const e of TYPICAL_EXERCISES) {
      expect(e.name).toBeTruthy();
      expect(e.name).toBe(e.name.trim());
      // English catalog: names should not contain accents (would mix
      // the language convention). This is a soft check — we look for
      // common Spanish/Portuguese accent characters and fail if found.
      expect(e.name).not.toMatch(/[áéíóúñÁÉÍÓÚÑ]/);
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
    // The AC names six exercises that the catalog must surface for the
    // datalist. As of 0044 these are the English spellings.
    const names = TYPICAL_EXERCISES.map((e) => e.name);
    for (const required of [
      "Back Squat",
      "Conventional Deadlift",
      "Bench Press",
      "Overhead Press",
      "Barbell Row",
      "Pull-up",
    ]) {
      expect(names).toContain(required);
    }
  });

  it("entries no longer carry an `alias` field (0044 simplification)", () => {
    // 0043 had a `alias` field for the Spanish→English chip label; 0044
    // moved to English-only and the alias went away.
    for (const e of TYPICAL_EXERCISES) {
      expect((e as { alias?: unknown }).alias).toBeUndefined();
    }
  });
});

describe("getTypicalExerciseNames", () => {
  it("returns the canonical names in catalog order", () => {
    const names = getTypicalExerciseNames();
    expect(names[0]).toBe("Back Squat");
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
    const found = findTypicalByName("Back Squat");
    expect(found?.name).toBe("Back Squat");
    expect(found?.category).toBe("squat");
  });

  it("resolves case-insensitively", () => {
    const found = findTypicalByName("BENCH press");
    expect(found?.name).toBe("Bench Press");
  });

  it("resolves with surrounding whitespace", () => {
    const found = findTypicalByName("  overhead PRESS  ");
    expect(found?.name).toBe("Overhead Press");
  });

  it("returns undefined for an unknown name", () => {
    expect(findTypicalByName("Snatch with band")).toBeUndefined();
  });

  it("returns undefined for empty / whitespace-only input", () => {
    expect(findTypicalByName("")).toBeUndefined();
    expect(findTypicalByName("   ")).toBeUndefined();
  });
});

describe("mergeTypicalAndHistory", () => {
  it("puts typical names first, then history-only names", () => {
    const merged = mergeTypicalAndHistory(
      ["Back Squat", "Bench Press"],
      ["Bench Press", "Pull-through"],
    );
    expect(merged).toEqual(["Back Squat", "Bench Press", "Pull-through"]);
  });

  it("dedupes case-insensitively, keeping the first occurrence", () => {
    const merged = mergeTypicalAndHistory(
      ["Bench Press"],
      ["bench PRESS", "Pull-up"],
    );
    expect(merged).toEqual(["Bench Press", "Pull-up"]);
  });

  it("drops empty and whitespace-only entries", () => {
    const merged = mergeTypicalAndHistory(
      ["Back Squat", "", "   "],
      ["", "Bench Press"],
    );
    expect(merged).toEqual(["Back Squat", "Bench Press"]);
  });

  it("returns an empty array when both inputs are empty", () => {
    expect(mergeTypicalAndHistory([], [])).toEqual([]);
  });

  it("trims surrounding whitespace from each entry", () => {
    const merged = mergeTypicalAndHistory(["  Bench Press  "], []);
    expect(merged).toEqual(["Bench Press"]);
  });
});
