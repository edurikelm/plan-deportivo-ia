/**
 * Component tests for `SessionListItem`.
 *
 * `SessionListItem` is a pure presentational component used in the
 * `/sessions` page. It receives a `SavedSession` and four callbacks
 * (`onLoad`, `onCopy`, `onExport`, `onDelete`); the tests cover the
 * rendering contract (title, date format, model, duration) and the
 * click wiring for each action button.
 *
 * Exported from `sessions-client.tsx` (was previously file-private —
 * see 0031 post-mortem for the rationale).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionListItem } from "./sessions-client";
import type { SavedSession } from "@/lib/types";

// ─── Test factories ──────────────────────────────────────────────────────────

const mkSession = (
  overrides: Partial<SavedSession> = {},
): SavedSession => ({
  id: "ss-001",
  modalityId: "crossfit",
  createdAt: "2026-09-02T10:00:00.000Z",
  model: "MiniMax-Text-01",
  markdown: "# Test session",
  structured: null,
  input: {
    durationMinutes: "60",
    strengthSkill: "Snatch",
    wodFormat: "AMRAP",
  },
  title: "Test session",
  ...overrides,
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SessionListItem", () => {
  it("renders the session title", () => {
    render(
      <SessionListItem
        session={mkSession({ title: "Snatch & Burpees" })}
        onLoad={vi.fn()}
        onCopy={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Snatch & Burpees")).toBeDefined();
  });

  it("renders '(sin título)' when title is empty", () => {
    render(
      <SessionListItem
        session={mkSession({ title: "" })}
        onLoad={vi.fn()}
        onCopy={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("(sin título)")).toBeDefined();
  });

  it("renders the model, duration, and date in the meta line", () => {
    const { container } = render(
      <SessionListItem
        session={mkSession({
          createdAt: "2026-08-15T08:30:00.000Z",
          model: "MiniMax-Text-01",
        })}
        onLoad={vi.fn()}
        onCopy={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    // The component renders a single `<article>` as its root. Query
    // it from the rendered container to avoid the multi-article error
    // that comes from the DOM being shared between tests if cleanup
    // hasn't run yet.
    const article = container.querySelector("article") as HTMLElement;
    expect(article).toBeDefined();
    // The meta line concatenates: date · duration · model. Asserting
    // each piece is more robust than asserting the full concat string,
    // which would be brittle against the Spanish locale and separator.
    expect(article.textContent).toContain("MiniMax-Text-01");
    expect(article.textContent).toContain("60 min");
    // The date is rendered via `toLocaleDateString("es-AR", { ... })`.
    // We assert the components without locking to a specific locale
    // string, since jsdom's default locale may not be "es-AR".
    expect(article.textContent).toMatch(/15/);
    expect(article.textContent).toMatch(/08/);
  });

  it("invokes onLoad with the session when 'Cargar' is clicked", async () => {
    const user = userEvent.setup();
    const onLoad = vi.fn();
    const session = mkSession({ id: "ss-load", title: "Loadable" });
    render(
      <SessionListItem
        session={session}
        onLoad={onLoad}
        onCopy={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /cargar sesión: loadable/i }));
    expect(onLoad).toHaveBeenCalledExactlyOnceWith(session);
  });

  it("invokes onCopy when 'Copiar' is clicked", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    const session = mkSession({ id: "ss-copy", title: "Copyable" });
    render(
      <SessionListItem
        session={session}
        onLoad={vi.fn()}
        onCopy={onCopy}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /copiar sesión: copyable/i }));
    expect(onCopy).toHaveBeenCalledExactlyOnceWith(session);
  });

  it("invokes onExport when 'Exportar' is clicked", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    const session = mkSession({ id: "ss-export", title: "Exportable" });
    render(
      <SessionListItem
        session={session}
        onLoad={vi.fn()}
        onCopy={vi.fn()}
        onExport={onExport}
        onDelete={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /exportar sesión: exportable/i }));
    expect(onExport).toHaveBeenCalledExactlyOnceWith(session);
  });

  it("invokes onDelete when 'Eliminar' is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const session = mkSession({ id: "ss-delete", title: "Deletable" });
    render(
      <SessionListItem
        session={session}
        onLoad={vi.fn()}
        onCopy={vi.fn()}
        onExport={vi.fn()}
        onDelete={onDelete}
      />,
    );
    await user.click(screen.getByRole("button", { name: /eliminar sesión: deletable/i }));
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(session);
  });

  it("uses the supplied title in each action's aria-label for screen readers", () => {
    const session = mkSession({ title: "Custom title" });
    render(
      <SessionListItem
        session={session}
        onLoad={vi.fn()}
        onCopy={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    // Each action's aria-label embeds the title; assert that the title
    // appears in every label so a11y tools can identify the action.
    for (const verb of ["Cargar", "Copiar", "Exportar", "Eliminar"]) {
      expect(
        screen.getByRole("button", { name: new RegExp(`${verb} sesión: Custom title`, "i") }),
      ).toBeDefined();
    }
  });
});
