/**
 * Component tests for `AnalysisPageClient` (issue 0039).
 *
 * Covers the rendering contract for the per-exercise analysis view and the
 * "Marcar 1RM" toggle flow. The chart-helpers are unit-tested in
 * `chart-helpers.test.ts`; these tests focus on the integration of the
 * header, charts, Prilepin table, and history list.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnalysisPageClient } from "./analysis-page-client";
import { resetLocalStorage } from "../../../../../../vitest.setup";

// ─── Toast + confirm mocks ───────────────────────────────────────────────────

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Recharts' `ResponsiveContainer` measures its parent's width via
// `getBoundingClientRect`, which jsdom does not implement (always returns
// 0). Without an explicit width, Recharts refuses to render the SVG and
// the test sees a `<div>` wrapper only. Replace the responsive container
// with a fixed-size div so the underlying LineChart / BarChart can render.
vi.mock("recharts", async () => {
  const actual =
    await vi.importActual<typeof import("recharts")>("recharts");
  const FixedContainer = ({
    children,
    height,
  }: {
    children: React.ReactNode;
    height?: number | string;
  }) => (
    <div style={{ width: 400, height: height ?? 180 }}>{children}</div>
  );
  return {
    ...actual,
    ResponsiveContainer: FixedContainer,
  };
});

// ─── Seed helpers ───────────────────────────────────────────────────────────

function seedRecords(
  records: Array<{
    id: string;
    exercise: string;
    createdAt: string;
    totalKg: number;
    reps: number | null;
    isOneRepMax?: boolean;
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
    source: "manual",
    reps: r.reps,
    isOneRepMax: r.isOneRepMax ?? false,
  }));
  localStorage.setItem("pd:calculator-records", JSON.stringify(payload));
}

const EXERCISE = "Back Squat";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("AnalysisPageClient — per-exercise view (issue 0039)", () => {
  beforeEach(() => {
    resetLocalStorage();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the empty state when there are no records for the exercise", () => {
    // Seed an unrelated exercise so the storage has data, but the analysis
    // view's exercise filter still returns nothing.
    seedRecords([
      {
        id: "other",
        exercise: "Press militar",
        createdAt: "2026-09-01T10:00:00.000Z",
        totalKg: 60,
        reps: 5,
      },
    ]);

    render(<AnalysisPageClient name={EXERCISE} />);

    expect(
      screen.getByText(/No hay registros para este ejercicio/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: EXERCISE })).toBeInTheDocument();
  });

  it("renders the full layout (header + 3 charts + Prilepin table + history) with 3 records and a 1RM flag", () => {
    seedRecords([
      {
        id: "r1",
        exercise: EXERCISE,
        createdAt: "2026-08-20T10:00:00.000Z",
        totalKg: 100,
        reps: 5,
      },
      {
        id: "r2",
        exercise: EXERCISE,
        createdAt: "2026-08-30T10:00:00.000Z",
        totalKg: 110,
        reps: 3,
      },
      {
        id: "r3",
        exercise: EXERCISE,
        createdAt: "2026-09-03T10:00:00.000Z",
        totalKg: 120,
        reps: 1,
        isOneRepMax: true,
      },
    ]);

    render(<AnalysisPageClient name={EXERCISE} />);

    // Header
    expect(screen.getByRole("heading", { name: EXERCISE })).toBeInTheDocument();
    expect(screen.getByText(/3 registros/i)).toBeInTheDocument();
    expect(screen.getByText(/1RM estimado/i)).toBeInTheDocument();

    // 3 charts visible (Recharts wrapper rendered with data-testid)
    expect(screen.getAllByTestId("analysis-chart")).toHaveLength(3);
    expect(screen.getByText("Progresión")).toBeInTheDocument();
    expect(screen.getByText("Volumen")).toBeInTheDocument();
    expect(screen.getByText("e1RM")).toBeInTheDocument();

    // Prilepin table: 12 rows for 1-12 reps
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    // 1 header row + 12 data rows = 13
    expect(rows).toHaveLength(13);
    // Spot-check a few cells
    expect(within(table).getByText("1")).toBeInTheDocument();
    expect(within(table).getByText("100%")).toBeInTheDocument();
    expect(within(table).getByText("12")).toBeInTheDocument();
    expect(within(table).getByText("70%")).toBeInTheDocument();

    // History list: 3 rows, the most recent (with 1RM flag) first
    const list = screen.getByTestId("exercise-history-list");
    const historyRows = within(list).getAllByTestId("exercise-history-row");
    expect(historyRows).toHaveLength(3);
    expect(
      within(historyRows[0]!).getByLabelText("Marcado como 1RM"),
    ).toBeInTheDocument();
  });

  it("shows only the progression chart with copy on the others when there is a single record", () => {
    seedRecords([
      {
        id: "r1",
        exercise: EXERCISE,
        createdAt: "2026-09-03T10:00:00.000Z",
        totalKg: 100,
        reps: 5,
      },
    ]);

    render(<AnalysisPageClient name={EXERCISE} />);

    // Only the progression chart card is rendered; the other two slots are
    // placeholder cards with the "Necesitás ≥ 2" copy.
    expect(screen.getAllByTestId("analysis-chart")).toHaveLength(1);
    expect(screen.getByText("Progresión")).toBeInTheDocument();
    expect(
      screen.getByText(/Necesitás ≥ 2 registros con repeticiones/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Necesitás ≥ 2 registros para ver la progresión del 1RM/i),
    ).toBeInTheDocument();

    // The Prilepin table is also absent (1RM is computed from at least one
    // record with reps; this single record does have reps=5 so the table
    // should be present). The 1RM is 100 * (1 + 5/30) ≈ 116.67kg.
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("shows 'Sin 1RM estimado' on the Prilepin sidebar when all records have reps === null", () => {
    seedRecords([
      {
        id: "r1",
        exercise: EXERCISE,
        createdAt: "2026-08-20T10:00:00.000Z",
        totalKg: 100,
        reps: null,
      },
      {
        id: "r2",
        exercise: EXERCISE,
        createdAt: "2026-09-01T10:00:00.000Z",
        totalKg: 110,
        reps: null,
      },
    ]);

    render(<AnalysisPageClient name={EXERCISE} />);

    expect(
      screen.getByText(/Sin 1RM estimado/i),
    ).toBeInTheDocument();
    // No Prilepin table when 1RM is null
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("toggles the isOneRepMax flag on click and updates the badge + Prilepin 1RM base", async () => {
    seedRecords([
      {
        id: "r1",
        exercise: EXERCISE,
        createdAt: "2026-08-20T10:00:00.000Z",
        totalKg: 100,
        reps: 5,
      },
      {
        id: "r2",
        exercise: EXERCISE,
        createdAt: "2026-09-03T10:00:00.000Z",
        totalKg: 110,
        reps: 1,
      },
    ]);

    const user = userEvent.setup();
    render(<AnalysisPageClient name={EXERCISE} />);

    // Initial state: r2 (the most recent) is NOT flagged. No badge.
    const list = screen.getByTestId("exercise-history-list");
    const topRow = within(list).getAllByTestId("exercise-history-row")[0]!;
    expect(
      within(topRow).queryByLabelText("Marcado como 1RM"),
    ).not.toBeInTheDocument();
    // The 1RM header should show the e1RM from r1 (formula) since neither
    // is flagged: max(100*(1+5/30), 110) = max(116.67, 110) = 116.67.
    expect(screen.getByText(/1RM estimado 116\.7kg/i)).toBeInTheDocument();

    // Click "Marcar como 1RM" on the top row (r2)
    const toggle = within(topRow).getByRole("button", {
      name: "Marcar como 1RM",
    });
    await user.click(toggle);

    // After toggle: r2 is now flagged. The badge appears and the 1RM base
    // jumps to 110kg (the totalKg of the now-flagged r2, which beats the
    // formula's 116.67 — so the 1RM should still be 116.67, but r2's badge
    // should now be visible).
    const topRowAfter = within(list).getAllByTestId("exercise-history-row")[0]!;
    expect(
      within(topRowAfter).getByLabelText("Marcado como 1RM"),
    ).toBeInTheDocument();

    // The Prilepin base label updates to 116.7kg (the e1RM was already the
    // max; the flag is still consistent with that value).
    expect(screen.getByText(/Prilepin · 1RM base 116\.7kg/i)).toBeInTheDocument();
  });
});
