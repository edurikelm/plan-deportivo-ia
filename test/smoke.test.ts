import { describe, it, expect } from "vitest";

/**
 * Smoke test for the Vitest infrastructure.
 *
 * This file exists ONLY to validate that the test runner is wired up
 * (config, setup file, jsdom environment, path alias). It will be
 * removed in ticket 0028 when the first real unit tests of
 * `src/lib/calculator/history.ts` are introduced.
 */
describe("test infra smoke", () => {
  it("runner is alive", () => {
    expect(1 + 1).toBe(2);
  });
});
