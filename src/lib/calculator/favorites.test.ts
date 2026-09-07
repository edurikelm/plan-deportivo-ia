/**
 * Tests for the pure favorites helpers (issue 0044).
 *
 * 100% line + branch coverage. The helpers are the *transformation* layer
 * for the favorite list; the storage layer is tested separately in
 * `src/lib/storage.test.ts`.
 */
import { describe, it, expect } from "vitest";
import {
  addFavorite,
  removeFavorite,
  isFavorite,
  toggleFavorite,
} from "./favorites";

describe("addFavorite", () => {
  it("prepends a new name to an empty list", () => {
    expect(addFavorite([], "Back Squat")).toEqual(["Back Squat"]);
  });

  it("prepends a new name to a non-empty list", () => {
    expect(addFavorite(["Bench Press"], "Back Squat")).toEqual([
      "Back Squat",
      "Bench Press",
    ]);
  });

  it("moves an existing favorite to the head (re-star as most recent)", () => {
    expect(addFavorite(["Bench Press", "Back Squat"], "Bench Press")).toEqual([
      "Bench Press",
      "Back Squat",
    ]);
  });

  it("dedupes case-insensitively", () => {
    expect(addFavorite(["Back Squat"], "BACK squat")).toEqual(["BACK squat"]);
  });

  it("trims surrounding whitespace from the new name", () => {
    expect(addFavorite([], "  Overhead Press  ")).toEqual(["Overhead Press"]);
  });

  it("drops empty / whitespace-only input", () => {
    expect(addFavorite(["Back Squat"], "")).toEqual(["Back Squat"]);
    expect(addFavorite(["Back Squat"], "   ")).toEqual(["Back Squat"]);
  });

  it("does not mutate the input list", () => {
    const original = ["Back Squat"];
    addFavorite(original, "Bench Press");
    expect(original).toEqual(["Back Squat"]);
  });
});

describe("removeFavorite", () => {
  it("removes a case-insensitive match", () => {
    expect(removeFavorite(["Back Squat", "Bench Press"], "BACK squat")).toEqual([
      "Bench Press",
    ]);
  });

  it("returns the list unchanged when the name is not present", () => {
    const list = ["Back Squat", "Bench Press"];
    expect(removeFavorite(list, "Pull-up")).toEqual(list);
  });

  it("returns a fresh array (mutating the result does not affect the input)", () => {
    const original = ["Back Squat"];
    const result = removeFavorite(original, "Bench Press");
    result.push("HACK");
    expect(original).toEqual(["Back Squat"]);
  });

  it("treats empty / whitespace-only input as a no-op", () => {
    expect(removeFavorite(["Back Squat"], "")).toEqual(["Back Squat"]);
    expect(removeFavorite(["Back Squat"], "  ")).toEqual(["Back Squat"]);
  });
});

describe("isFavorite", () => {
  it("returns true for an exact case-sensitive match", () => {
    expect(isFavorite(["Back Squat", "Bench Press"], "Back Squat")).toBe(true);
  });

  it("returns true for a case-insensitive match", () => {
    expect(isFavorite(["Back Squat"], "BACK squat")).toBe(true);
  });

  it("returns true when the input has surrounding whitespace", () => {
    expect(isFavorite(["Back Squat"], "  Back Squat  ")).toBe(true);
  });

  it("returns false for an unknown name", () => {
    expect(isFavorite(["Back Squat"], "Pull-up")).toBe(false);
  });

  it("returns false for an empty list", () => {
    expect(isFavorite([], "Back Squat")).toBe(false);
  });

  it("returns false for empty / whitespace-only input", () => {
    expect(isFavorite(["Back Squat"], "")).toBe(false);
    expect(isFavorite(["Back Squat"], "   ")).toBe(false);
  });
});

describe("toggleFavorite", () => {
  it("adds the name when it is not present", () => {
    const result = toggleFavorite(["Bench Press"], "Back Squat");
    expect(result.list).toEqual(["Back Squat", "Bench Press"]);
    expect(result.isFavorite).toBe(true);
  });

  it("removes the name when it is present", () => {
    const result = toggleFavorite(["Back Squat", "Bench Press"], "Back Squat");
    expect(result.list).toEqual(["Bench Press"]);
    expect(result.isFavorite).toBe(false);
  });

  it("does not mutate the input list", () => {
    const original = ["Back Squat"];
    toggleFavorite(original, "Bench Press");
    expect(original).toEqual(["Back Squat"]);
  });
});
