/**
 * Component tests for `HistoryPageClient` (issue 0038).
 *
 * The page now lists **unique exercises** (not the flat record list) and
 * navigates to the per-exercise analysis route on click. The aggregation
 * logic itself is unit-tested in `aggregate.test.ts`; these tests cover
 * the rendering contract and the navigation wiring.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoryPageClient } from "./history-page-client";
import { resetLocalStorage } from "../../../../../vitest.setup";

// ─── Router mock ─────────────────────────────────────────────────────────────

const mockRouterPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// ─── Seed helpers ───────────────────────────────────────────────────────────

function seedRecords(
  records: Array<{
    id: string;
    exercise: string | null;
    createdAt: string;
    totalKg: number;
    reps: number | null;
    source?: "auto-log" | "manual" | "foto";
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
    reps: r.reps,
    isOneRepMax: false,
  }));
  localStorage.setItem("pd:calculator-records", JSON.stringify(payload));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("HistoryPageClient — exercise list (issue 0038)", () => {
  beforeEach(() => {
    resetLocalStorage();
    mockRouterPush.mockReset();
  });

  afterEach(cleanup);

  it("renders the empty state when there are no records", () => {
    render(<HistoryPageClient />);

    expect(
      screen.getByText(/Todavía no guardaste ningún ejercicio/i),
    ).toBeInTheDocument();
  });

  it("renders one card per unique exercise, sorted by most recent first", async () => {
    seedRecords([
      {
        id: "r1",
        exercise: "Press militar",
        createdAt: "2026-08-20T10:00:00.000Z",
        totalKg: 60,
        reps: 5,
      },
      {
        id: "r2",
        exercise: "Back Squat",
        createdAt: "2026-09-01T10:00:00.000Z", // newer
        totalKg: 100,
        reps: 1,
      },
      {
        id: "r3",
        exercise: "Back Squat",
        createdAt: "2026-08-10T10:00:00.000Z",
        totalKg: 95,
        reps: 3,
      },
    ]);

    render(<HistoryPageClient />);

    // Wait for post-hydration re-render: the list appears only after
    // `useSyncExternalStore` switches from the server snapshot (empty) to
    // the client snapshot (seeded records).
    const list = await screen.findByRole("list", {
      name: /lista de ejercicios/i,
    });
    expect(list.children).toHaveLength(2);

    // Query inside the list so we don't pick up header buttons (the back
    // link uses `render={<Link>}` and renders as an `<a>`, but other
    // future header controls could show up — scoping to the list is the
    // robust contract).
    const buttons = within(list).getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("Back Squat");
    expect(buttons[1]).toHaveTextContent("Press militar");
  });

  it("collapses case variations of the same exercise into one card", () => {
    seedRecords([
      {
        id: "r1",
        exercise: "Back Squat",
        createdAt: "2026-08-15T10:00:00.000Z",
        totalKg: 100,
        reps: 5,
      },
      {
        id: "r2",
        exercise: "back squat",
        createdAt: "2026-09-01T10:00:00.000Z",
        totalKg: 110,
        reps: 3,
      },
      {
        id: "r3",
        exercise: "BACK SQUAT",
        createdAt: "2026-08-20T10:00:00.000Z",
        totalKg: 95,
        reps: 5,
      },
    ]);

    render(<HistoryPageClient />);

    const list = screen.getByRole("list", { name: /lista de ejercicios/i });
    expect(list.children).toHaveLength(1);
    // The most recent capitalization wins.
    expect(list.children[0]).toHaveTextContent("back squat");
  });

  it("navigates to the per-exercise analysis route when a card is clicked", async () => {
    const user = userEvent.setup();
    seedRecords([
      {
        id: "r1",
        exercise: "Back Squat",
        createdAt: "2026-09-01T10:00:00.000Z",
        totalKg: 140,
        reps: 1,
      },
    ]);

    render(<HistoryPageClient />);

    const card = screen.getByRole("button", { name: /Back Squat/i });
    await user.click(card);

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/tools/weight-calculator/exercise/Back%20Squat",
    );
  });
});
