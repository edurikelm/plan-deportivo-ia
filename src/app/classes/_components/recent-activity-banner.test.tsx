/**
 * Component tests for `RecentActivityBanner`.
 *
 * The banner is a reactive "last activity" summary on `/classes` that
 * reads `pd:sessions` via `useSyncExternalStore` and renders the most
 * recent session with a "Reabrir" link. These tests pin the rendering
 * contract (presence/absence, plural handling, link hrefs) and the
 * reactive update path (the banner re-renders when the storage event
 * fires).
 *
 * The localStorage state is pre-seeded in `beforeEach` via the
 * `resetLocalStorage` helper from `vitest.setup.ts`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, within, act, cleanup } from "@testing-library/react";
import { RecentActivityBanner } from "./recent-activity-banner";
import { resetLocalStorage } from "../../../../vitest.setup";
import type { SavedSession } from "@/lib/types";

// ─── Test factories ──────────────────────────────────────────────────────────

const mkSession = (
  overrides: Partial<SavedSession> = {},
): SavedSession => ({
  id: "ss-1",
  modalityId: "crossfit",
  createdAt: new Date(Date.now() - 60_000).toISOString(), // 1 min ago
  model: "MiniMax-Text-01",
  markdown: "# Snatch & Skill",
  structured: null,
  input: {
    durationMinutes: "60",
    strengthSkill: "Snatch",
    wodFormat: "AMRAP",
  },
  title: "Snatch & Skill",
  ...overrides,
});

const seedSessions = (sessions: SavedSession[]): void => {
  localStorage.setItem("pd:sessions", JSON.stringify(sessions));
};

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetLocalStorage();
  // Stable "now" so the relative-time string in the meta line is
  // deterministic. We only fake `Date` (not timers) so `useSyncExternalStore`
  // and any internal React work continues to use the real clock.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-02T15:00:00.000Z"));
});

afterEach(() => {
  // Explicit cleanup is a safety net. RTL auto-cleans when imported,
  // but the order of imports / afterEach hooks can break the auto-clean
  // in some Vitest configs. Calling it explicitly is cheap and makes
  // the tests resilient to setup changes.
  cleanup();
  vi.useRealTimers();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("RecentActivityBanner", () => {
  it("renders nothing when there are no saved sessions", () => {
    const { container } = render(<RecentActivityBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the banner with the most recent session's title", () => {
    const older = mkSession({
      id: "ss-old",
      title: "Old session",
      createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    });
    const newer = mkSession({
      id: "ss-new",
      title: "New session",
      createdAt: new Date(Date.now() - 60_000).toISOString(),
    });
    seedSessions([older, newer]);

    const { getByText, queryByText } = render(<RecentActivityBanner />);

    // The newest (by createdAt) is the headline.
    expect(getByText("New session")).toBeDefined();
    expect(queryByText("Old session")).toBeNull();
  });

  it("uses singular 'sesión guardada' when there is exactly 1 session", () => {
    seedSessions([mkSession()]);
    const { getByText } = render(<RecentActivityBanner />);
    expect(getByText("1 sesión guardada")).toBeDefined();
  });

  it("uses plural 'sesiones guardadas' when there are 2+ sessions", () => {
    seedSessions([mkSession(), mkSession({ id: "ss-2" })]);
    const { getByText } = render(<RecentActivityBanner />);
    expect(getByText("2 sesiones guardadas")).toBeDefined();
  });

  it("points the 'Reabrir' link at /generate/{modalityId}?fromSession={id}", () => {
    const session = mkSession({ id: "ss-abc", modalityId: "crossfit" });
    seedSessions([session]);
    const { getByLabelText } = render(<RecentActivityBanner />);
    // The banner has `aria-label="Última actividad"`; scope the link
    // query to the banner to avoid collisions with other elements on
    // the page.
    const banner = getByLabelText("Última actividad");
    // The "Reabrir" CTA renders an `<a>` with `role="button"` (the
    // shadcn Button with `render={<Link />}`), so `getByRole("link")`
    // does not match — query the text and walk up to the anchor.
    const reabrirText = within(banner).getByText("Reabrir");
    const link = reabrirText.closest("a");
    expect(link?.getAttribute("href")).toBe(
      "/generate/crossfit?fromSession=ss-abc",
    );
  });

  it("points the 'N sesiones guardadas' link at /sessions", () => {
    seedSessions([mkSession(), mkSession({ id: "ss-2" })]);
    const { getByLabelText } = render(<RecentActivityBanner />);
    const banner = getByLabelText("Última actividad");
    const link = within(banner).getByRole("link", { name: /sesiones guardadas/i });
    expect(link.getAttribute("href")).toBe("/sessions");
  });

  it("re-renders when pd:sessions changes (storage event)", () => {
    // First render: empty. The banner is null.
    const { queryByText, rerender, getByLabelText } = render(<RecentActivityBanner />);
    expect(queryByText("Initial session")).toBeNull();

    // Seed a session and dispatch the synthetic storage event. The
    // banner should pick up the new state via `useSyncExternalStore`.
    const newSession = mkSession({ id: "ss-new", title: "Initial session" });
    act(() => {
      seedSessions([newSession]);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "pd:sessions",
          newValue: JSON.stringify([newSession]),
        }),
      );
    });

    // Scope queries to the banner; the title appears exactly once.
    const banner = getByLabelText("Última actividad");
    expect(within(banner).getByText("Initial session")).toBeDefined();

    // Now replace the sessions with a different most-recent one and
    // dispatch again. The banner should update to show the new title.
    const newer = mkSession({ id: "ss-newer", title: "Updated session" });
    act(() => {
      seedSessions([newer]);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "pd:sessions",
          newValue: JSON.stringify([newer]),
        }),
      );
    });
    expect(within(banner).getByText("Updated session")).toBeDefined();
    expect(within(banner).queryByText("Initial session")).toBeNull();

    // Sanity: rerender is a no-op contract check.
    rerender(<RecentActivityBanner />);
    expect(within(getByLabelText("Última actividad")).getByText("Updated session")).toBeDefined();
  });
});
