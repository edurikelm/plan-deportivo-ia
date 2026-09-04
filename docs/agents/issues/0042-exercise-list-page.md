---
label: feature
status: in_progress
parent: null
depends_on: []
blocks: []
---

# 0042 — Reshape /tools/weight-calculator/history to a list of exercises

## Context

The "Lista de ejercicios" card on `/classes` (added in 22e597b + 07bdf28) currently points to `/tools/weight-calculator/history`, which is a flat list of calculation records. The label was changed to "Lista de ejercicios" to reflect the future shape of this surface: a catalog of defined exercises, each with its own per-exercise sub-history.

The per-exercise analysis view already exists at `/tools/weight-calculator/exercise/[exerciseName]` (delivered in 0039, with its own test coverage). What's missing is the entry list that surfaces all the exercises and links into each one — the page the coach lands on when they tap "Lista de ejercicios" from `/classes`.

## Goal

Replace the flat `/history` view with a list of derived exercises, each linking to the existing per-exercise analysis. The URL stops describing the storage shape and starts describing the user-facing concept.

## User stories

1. As a coach, I want to see the exercises I've recorded in a list, so I can pick one to analyze its progression.
2. As a coach, I want each entry to show the last weight + 1RM flag at a glance, so I can scan the catalog without opening each one.
3. As a coach, I want the URL to match the card label, so the navigation mental model is clear.

## Solution

One ticket, four deliverables, all on the same vertical slice:

1. **New page**: `/tools/weight-calculator/exercises` — a server component that:
   - Reads `pd:calculator-records` via the existing `getAllCalculatorRecords()` helper (already covered by `storage.test.ts`).
   - Derives a unique list of `exercise` strings.
   - For each exercise, computes: last record (date, weight + unit, source), total record count, whether the latest record is a 1RM.
   - Renders a list of entries using the same chalk-card + type-tag pattern established in `/classes` (0022e597b). Each entry is a `<Link>` to `/tools/weight-calculator/exercise/[encodedName]` (the 0039 analysis view, untouched).
   - Sort: last record date desc (most recent first) — same convention as `RecentActivityBanner`.

2. **New derivation helper** in `src/lib/calculator/exercise-index.ts`:
   - `deriveExerciseIndex(records: SavedWeightRecord[]): ExerciseIndexEntry[]`
   - Pure function, no React, no `localStorage`. 100% covered by tests per project discipline.
   - Output shape: `{ name, lastRecord: { createdAt, totalKg, totalLb, breakdownLine, source, isOneRepMax }, count }[]`

3. **Redirect**: `/tools/weight-calculator/history` → `/tools/weight-calculator/exercises` via `next.config.ts` `redirects()`. The flat "all records" view goes away; its data is now accessed per-exercise via the existing analysis view, which already includes a per-exercise history section.

4. **`/classes` card update**: change the third card's destination from `/tools/weight-calculator/history` to `/tools/weight-calculator/exercises`. The label and type tag stay as they are in 07bdf28 ("Lista de ejercicios" / "EJERCICIOS").

## Out of scope

- **Defining exercises without recording**. The list is derived from records; an exercise with zero calculations does not appear. If a coach names "Front Squat" as a future movement but never records a calculation, it won't be in the list. This can be a follow-up.
- **Per-exercise management** (rename, merge, delete). The `exercise` field is a free string in `SavedWeightRecord`; the list reflects what's been recorded. Editing the list is a separate concern (probably warrants its own ADR + storage shape change).
- **A separate "all records" view**. The per-exercise analysis view at `/exercise/[name]` already includes a history section. A global "all records" page is not needed and would re-introduce the `/history` shape we're moving away from.
- **Touching the per-exercise analysis view** (0039). It already does the right thing; we just point at it from a new entry point.

## Acceptance

- [ ] `/tools/weight-calculator/exercises` renders a list of unique exercises
- [ ] Each entry shows: name (display italic), last weight + unit (Geist Mono tabular), date, 1RM flag if applicable, record count
- [ ] Clicking an entry navigates to the per-exercise analysis view at `/tools/weight-calculator/exercise/[encodedName]` (0039, untouched)
- [ ] Sort is stable: last record date desc, ties broken by name asc
- [ ] `/tools/weight-calculator/history` redirects to `/tools/weight-calculator/exercises` (301, permanent)
- [ ] `/classes` card now points to `/exercises`
- [ ] 100% coverage on `deriveExerciseIndex` (per project test discipline)
- [ ] `npm test` verde, `npm run build` verde, `npm run lint` verde (no new warnings)
- [ ] Manual smoke: record 3 calculations for "Back Squat" and 1 for "Bench Press" via the calculator → `/exercises` shows 2 entries → click "Back Squat" → analysis view shows 3 records (existing 0039 behavior)

## Implementation decisions

- **Empty state**: follow the `/classes` `RecentActivityBanner` pattern — if there are zero records, the page returns `null` and the catalog on `/classes` stands on its own. The coach learns about `/exercises` only when they have something to look at.
- **URL encoding for exercise names**: use `encodeURIComponent` on the name. The current values are coach-authored Spanish strings (e.g. "Back Squat", "Sentadilla frontal") — handle spaces, accents, and any future non-ASCII input.
- **Source field on the entry**: keep it visible (Manual / Foto) so the coach can distinguish manual logs from photo captures at a glance. Reuse the same `source` enum as `SavedWeightRecord`.
- **Test placement**: `src/lib/calculator/exercise-index.test.ts` co-located with the helper, following the 0028 convention.

## Further notes

- **Relationship to 0035 (umbrella)**: 0042 is related to the exercise analysis feature but is not a child of 0035. 0035 was scoped to the per-exercise view; 0042 is the entry point above it. If a future umbrella consolidates the "calculator surface" (calculator + history/exercises + analysis), 0042 becomes a child then. For now, standalone.
- **Relationship to 0039**: 0039 is the destination. 0042 only adds the entry list and updates the URL. No changes to 0039 expected.
- **Relationship to the new `/classes` layout (22e597b)**: 0042 makes the "Lista de ejercicios" card honest. The card label/type tag are already correct from 07bdf28; this ticket just fixes the destination.
- **The 07bdf28 commit body already names this follow-up explicitly** — closing 0042 should reference that commit to make the lineage traceable.

## Out of scope (revisited, for clarity)

The redirect from `/history` is permanent. Coaches who bookmarked the old URL will land on the new one. No data migration is needed — the records stay in `pd:calculator-records` exactly as they are; only the surface that reads them changes.
