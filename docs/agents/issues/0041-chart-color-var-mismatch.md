---
label: bug
status: closed
closed_at: 2026-09-04
parent: 0035-exercise-analysis-feature
depends_on: []
blocks: []
---

# 0041 — Charts rendered black + invisible axis text (CSS variable name mismatch)

## Parent

[0035 — Vista de análisis de ejercicio (umbrella)](./0035-exercise-analysis-feature.md)

## What broke

After deploying 0039, the analysis view charts rendered with:

- Bar fill = pure black (no `var(--color-signal)` green)
- Axis tick labels (Y values, X dates) almost invisible against the dark canvas
- Grid lines absent

The screenshot the user shared in the next session confirmed all three symptoms at once.

## Root cause

The design system in `src/app/globals.css` defines its design tokens with the **`--color-*` prefix**:

- `--color-signal` (resolves to turf-marking pitch green)
- `--color-mute` (resolves to dimmed type)
- `--color-hairline` (resolves to the 1px border tone)

I used the **un-prefixed** names in `analysis-page-client.tsx`:

- `var(--signal)` → undefined → CSS falls back to the default fill (black)
- `var(--mute)` → undefined → ticks get an invalid color and the browser
  silently drops them, leaving the axis labels invisible
- `var(--hairline)` → undefined → grid lines vanish

I never validated the variable names against `globals.css` before shipping. The umbrella issue 0039 is closed, the test suite passed (262/262), and the lint suite is clean — none of those checks catch a wrong CSS variable name because `var(--anything)` is a valid CSS expression that just doesn't resolve.

## Fix

Renamed all 12 references in `analysis-page-client.tsx`:

- `var(--signal)` → `var(--color-signal)`
- `var(--mute)` → `var(--color-mute)`
- `var(--hairline)` → `var(--color-hairline)`

3 charts × 4 var references per chart = 12 replacements.

`grep "var\(--(signal|mute|hairline)\)"` over `src/` now returns 0 matches.

## Smoke

- `npm test` → 262/262 verde (no test changes — visual-only fix)
- `npm run lint` → 0 errors, 2 pre-existing warnings unchanged
- Manual verification (user screenshot) → bars green, axis text readable,
  grid lines visible

## Lessons

1. **Visual regressions hide from the test suite.** A wrong CSS variable
   name is semantically valid CSS and produces no test failure. The next
   time a new chart or design-token consumer lands, the right move is a
   browser-side smoke before declaring the issue done. (The existing CI
   only exercises Node + jsdom, not the browser.)
2. **Validate design token names against `globals.css` first.** When
   picking a color from the system, the lookup should be a `grep` against
   the design-system file, not a memory of the token name.
3. **Add a `pre-commit` lint rule?** Tempting but probably noise —
   `var(--foo)` is too generic to lint without false positives. The
   cheaper fix is a "open the browser for 5 seconds" step on issues
   that introduce new visual surface area. The project already does
   this informally; making it explicit (a checkbox in the issue template)
   would be enough.
