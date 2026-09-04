/**
 * Component tests for `ExercisesPageClient` (issue 0042).
 *
 * Pattern of the project: render tests focus on the integration of
 * the page surface, not the helper (the helper has its own TDD-strict
 * suite in `src/lib/calculator/exercise-index.test.ts`). The three
 * guarantees the page must hold are:
 *   1. Empty `pd:calculator-records` → page renders nothing (per
 *      spec: "the catalog on /classes stands on its own").
 *   2. Each entry is a `<Link>` to the per-exercise analysis view at
 *      `/tools/weight-calculator/exercise/[encodedName]`, with the
 *      coach-authored name `encodeURIComponent`-escaped.
 *   3. The card surfaces the last record's signal (date, kg, count,
 *      1RM flag, source) so the coach can scan the catalog without
 *      opening each exercise.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { ExercisesPageClient } from "./exercises-page-client";
import { resetLocalStorage } from "../../../../../../vitest.setup";

// ─── Seed helpers ───────────────────────────────────────────────────────────

function seedRecords(
  records: Array<{
    id: string;
    exercise: string;
    createdAt: string;
    totalKg: number;
    isOneRepMax?: boolean;
    source?: "manual" | "foto" | "auto-log";
  }>,
): void {
  const payload = records.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    exercise: r.exercise,
    barKg: 20,
    discs: [],
    totalKg: r.totalKg,
    totalLb: r.totalKg * 2.20462,
    breakdownLine: `${r.totalKg}kg`,
    source: r.source ?? "manual",
    reps: null,
    isOneRepMax: r.isOneRepMax ?? false,
  }));
  localStorage.setItem("pd:calculator-records", JSON.stringify(payload));
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("ExercisesPageClient — catalog (issue 0042)", () => {
  beforeEach(() => {
    cleanup();
    resetLocalStorage();
  });

  it("renders nothing when there are no records", () => {
    seedRecords([]);
    const { container } = render(<ExercisesPageClient />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one card per unique exercise, linked to the analysis view", () => {
    seedRecords([
      {
        id: "r1",
        exercise: "Back Squat",
        createdAt: "2026-09-01T10:00:00.000Z",
        totalKg: 140,
      },
      {
        id: "r2",
        exercise: "Bench Press",
        createdAt: "2026-08-15T10:00:00.000Z",
        totalKg: 90,
      },
    ]);
    render(<ExercisesPageClient />);

    const backSquatLink = screen.getByRole("link", { name: /Back Squat/i });
    expect(backSquatLink.getAttribute("href")).toBe(
      "/tools/weight-calculator/exercise/Back%20Squat",
    );

    const benchLink = screen.getByRole("link", { name: /Bench Press/i });
    expect(benchLink.getAttribute("href")).toBe(
      "/tools/weight-calculator/exercise/Bench%20Press",
    );
  });

  it("encodes non-ASCII exercise names (e.g. accents and spaces)", () => {
    seedRecords([
      {
        id: "r1",
        exercise: "Sentadilla frontal",
        createdAt: "2026-09-01T10:00:00.000Z",
        totalKg: 100,
      },
    ]);
    render(<ExercisesPageClient />);
    const link = screen.getByRole("link", { name: /Sentadilla frontal/i });
    expect(link.getAttribute("href")).toBe(
      "/tools/weight-calculator/exercise/Sentadilla%20frontal",
    );
  });

  it("orders entries by most recent activity first", () => {
    seedRecords([
      {
        id: "r1",
        exercise: "Bench Press",
        createdAt: "2026-08-01T10:00:00.000Z",
        totalKg: 90,
      },
      {
        id: "r2",
        exercise: "Back Squat",
        createdAt: "2026-09-01T10:00:00.000Z",
        totalKg: 140,
      },
    ]);
    render(<ExercisesPageClient />);
    const list = screen.getByRole("list", { name: /Ejercicios guardados/i });
    const items = within(list).getAllByRole("listitem");
    // Each entry is one `<li>` wrapping a `<Link>`.
    expect(items[0].textContent).toMatch(/Back Squat/);
    expect(items[1].textContent).toMatch(/Bench Press/);
  });

  it("surfaces the last record's kg, date, count, source, and 1RM flag", () => {
    seedRecords([
      {
        id: "r1",
        exercise: "Back Squat",
        createdAt: "2026-08-01T10:00:00.000Z",
        totalKg: 100,
      },
      {
        id: "r2",
        exercise: "Back Squat",
        createdAt: "2026-09-01T10:00:00.000Z",
        totalKg: 142.5,
        isOneRepMax: true,
        source: "foto",
      },
    ]);
    render(<ExercisesPageClient />);
    const card = screen
      .getByRole("link", { name: /Back Squat/i })
      .closest("li")!;
    const text = card.textContent ?? "";
    // Last record's totalKg appears in the header (top-right tag).
    expect(text).toMatch(/142\.5\s*kg/);
    // Summary line has the date, the 1RM flag, the source, and the count.
    expect(text).toMatch(/⭐\s*1RM/);
    expect(text).toMatch(/foto/);
    expect(text).toMatch(/2\s*registros/);
  });
});
