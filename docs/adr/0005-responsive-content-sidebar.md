# Responsive Content Sidebar for `/generate/[modalityId]`

The `/generate/[modalityId]` route uses a two-column responsive layout at the `lg` breakpoint. Left column holds the form + result card; right column holds a sticky mini-historial. On mobile and tablet, the layout collapses to a single column.

**Status**: accepted

**Amends**: the "no sidebar" rule from `DESIGN.md` (Layout + Status Strip Rule sections) for content panels only. Navigation routes remain strictly single-column.

## Decision

- Container: `max-w-5xl` (was `max-w-3xl`) on this specific route, to fit both columns comfortably at `lg`.
- Layout: `grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-8` wraps the form (left) and the mini-historial (right).
- Result card (`CrossFitPlanView` inside `chalk-card`) lives **below the grid**, full-width across the container. It does NOT share the left column with the form.
- Mini-historial is `lg:sticky lg:top-4 lg:self-start` with `lg:max-h-[calc(100vh-2rem)] lg:overflow-auto` so it stays in viewport while scrolling long results.
- On `< lg` (mobile, tablet): single column. Order: form → result → mini-historial.
- The mini-historial section is **always rendered**, including when there are zero saved sessions. The empty state is a single mute label "Aún no guardaste ninguna sesión.".

## Considered alternatives

- **H2 — Sticky mini-historial above the form, single column** — rejected. Keeps DESIGN.md intact but doesn't achieve the user's intent of having the history panel adjacent to the form.
- **I1 — Result card in the left column only** — rejected. Narrows the most important content (`CrossFitPlanView` needs horizontal room for blocks + numerals).
- **I3 — No sticky mini-historial** — rejected. Defeats the always-visible intent; on long results the history scrolls out of viewport.

## Consequences

- This is the **first exception** to DESIGN.md's "no sidebar" rule. It applies only to content panels; navigation routes (`/classes`, future `/history`) remain single-column.
- The container width on `/generate/[modalityId]` is wider than other routes. This is acceptable because the route is the most content-dense (form + result + history).
- Future modalities (Bodybuild, Gymnastics) that follow the same `/generate/[modalityId]` pattern inherit this layout automatically.
- The mini-historial empty state is a new component pattern — it's the first "list with empty state" in the app. Future lists (e.g., in a future `/history` route) can copy the same empty-state treatment.
- `DESIGN.md` needs a small amendment to formalize this exception for content panels.