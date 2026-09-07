---
label: refinement
status: closed
parent: 0045
depends_on: []
blocks: []
---

# 0046 — Form a11y + polish (Tier 2 + Tier 3)

## Context

`SaveRecordForm` and `FavoriteExerciseChips` shipped in 0044 and were brought into the visual world in 0045 (Tier 1 of an `impeccable` critique). The Tier 1 pass closed the seven highest-impact findings: violations of the `DESIGN.md` chip/container/elevation rules, the missing loading state, and the misleading "Agregar a favoritos" label.

Two Tiers of findings remain. They were explicitly deferred from 0045 so the high-impact pass would stay small. This ticket picks them up.

- **Tier 2 (a11y)** — two gaps that affect real users (touch targets on mobile, keyboard tab order). Small changes, important impact.
- **Tier 3 (polish)** — five housekeeping items: typography utilities that already exist, spacing rhythm, a tighter reps input width, and a layout that survives narrow mobile widths.

The work is small and tightly bounded. The form and chip files are the only ones touched. No new dependencies, no new tokens, no behavior changes. L7 from the original critique list (focus-visible:underline on the chip body) was already shipped in 0045 and is not in this ticket.

## Goal

Close the remaining 8 findings from the `impeccable` critique of the form so the surface is consistent with `DESIGN.md`, passes WCAG 2.5.5 (target size), and behaves correctly for keyboard users.

## User stories

1. As a coach on mobile, I can accurately tap the × on a favorite chip (target ≥ 24×24).
2. As a coach using a keyboard, tabbing from the calculator footer into the form lands on the exercise input first, not on the favorite chips.
3. As a coach on a narrow phone, the form fields don't crowd into a single cramped line; the reps row and the 1RM/favorite toggles stack on two lines.
4. As a coach, the labels look like the rest of the system's labels (medium weight, 0.08em tracking) instead of a slightly bolder variant.

## Solution

One ticket, two files, eight changes. Tier 2 first (a11y, higher value), Tier 3 after (polish, lower urgency). Grouped commits per file so the diff is reviewable.

### Tier 2 — a11y (the two important ones)

**`FavoriteExerciseChips` — M2** (`favorite-exercise-chips.tsx`):
- The X button was `size-4` (16×16). WCAG 2.5.5 target size minimum is 24×24. Bump to `size-5` (20×20) inside a `min-h-6 min-w-6` (24×24) hit-area wrapper so the visual icon stays proportional but the touch target hits the spec. The icon (`X`) stays at `size-3` to read as small inside a 20px button.

**`FavoriteExerciseChips` — M4** (`favorite-exercise-chips.tsx`):
- All chip buttons currently participate in the natural tab order. When the form opens with 5 favorites, tab from the parent component makes 10 stops before the exercise input. Add `tabIndex={-1}` to both the chip body button and the X button. Mouse and touch users keep the click affordance; keyboard users can tab past the chips straight to the input. The `data-active` chip's "active" state is preserved visually; the keyboard can still reach individual chips via screen reader navigation if needed (a follow-up can add roving tabindex for arrow-key navigation if the user wants it).

### Tier 3 — polish

**`SaveRecordForm` — L1** (`save-record-form.tsx`):
- The exercise input and the reps input use `font-mono text-sm` inline. The `globals.css:213` defines the `.numeric` utility for exactly this purpose (mono + tabular-nums). Replace inline `font-mono text-sm` with `numeric` on the two inputs. Matches the chip refactor in 0045.

**`SaveRecordForm` — L2** (`save-record-form.tsx`):
- Labels are `font-semibold uppercase tracking-[0.10em] text-mute`. `DESIGN.md` says: *"Label (Inter, 500 uppercase, 0.6875rem, letter-spacing +0.08em)"* — font-weight **500** (medium), tracking **+0.08em**. Change `font-semibold` → `font-medium` and `tracking-[0.10em]` → `tracking-[0.08em]`. Applies to all four label instances in the form (Ejercicio, Reps, Marcar como 1RM, Marcar como favorito).

**`SaveRecordForm` — L3** (`save-record-form.tsx`):
- The form uses `space-y-2` (0.5rem) between sections. `DESIGN.md` says "generous separation". 0.5rem between 4 distinct fields is tight. Change `space-y-2` → `space-y-3` (0.75rem). Doesn't touch the inner flex rows (those stay `gap-2` / `gap-3`).

**`SaveRecordForm` — L4** (`save-record-form.tsx`):
- The form's internal padding is `p-3` (0.75rem). `DESIGN.md` says the chalk-card `inset-card` is `1.25rem`; the form is a sub-container, but with 4 fields + chip row + buttons the visual edge feels tight at 0.75rem. Bump to `p-4` (1rem). The form remains a sub-form, not a full chalk card, so `inset-card` (1.25rem) is not warranted.

**`SaveRecordForm` — L5** (`save-record-form.tsx`):
- The reps input is `w-20` (80px). Reps are 1–20 = 1–2 digits. `w-16` (64px) is enough and gives more air to the row.

**`SaveRecordForm` — L6** (`save-record-form.tsx`):
- The row with Reps / Marcar como 1RM / Marcar como favorito uses `flex items-center gap-3 flex-wrap`. On very narrow phones, this becomes a single cramped line of three controls + labels. Restructure into two flex rows:
  - **Row A** (the data): `Reps` label + reps input.
  - **Row B** (the toggles): `Marcar como 1RM` checkbox + `Marcar como favorito` checkbox.
  - The Reps row is a single tight field; the toggle row is a pair of equal-weight options. Two rows read cleaner on mobile and the same on desktop (where they had room to fit on one line anyway).
  - The Reps input also stops needing `shrink-0` because the row is no longer competing with the toggles for space.

### Tests

- No new behavior, so the existing 18 form tests + 0 chip tests need no test additions.
- One new test for **M4** to pin the chip tabIndex contract:
  - Render the form with two favorites.
  - Tab from outside the form. The first interactive element inside the form should be the exercise input, not a chip.
  - Assert the favorite chip buttons have `tabIndex={-1}`.
- The M2 change (button size) is a visual / a11y change without behavior; existing visual snapshot of the chip is enough (no test added; the 100% coverage on the chip is structural, not visual).

## Out of scope

- **Editing the design tokens, `DESIGN.md`, or `globals.css`**. The rules are already there; the form is being aligned to them.
- **A `.label` utility in `globals.css`**. L2 inlines the corrected className into 4 places; a utility would centralize it but is a separate housekeeping ticket (this one is bounded to the form).
- **Roving tabindex on the chip row** (arrow-key navigation between chips). A nice-to-have; not in scope of M4.
- **Visual snapshot / regression tests** for the chip. The repo doesn't use snapshot testing; the contract is `data-active` + `aria-pressed` + `aria-label`, all already covered.
- **Tier 1 findings (already shipped in 0045)**: bg-popover, rounded-none, active-signal-solid, rounded-sm chips, text-mute, loading state, label rename.
- **Tier 3 L7 (focus-visible:underline on chip body)** — shipped in 0045.

## Acceptance

- [ ] X button has `min-h-6 min-w-6` hit area; visual button is `size-5`; icon stays `size-3`
- [ ] Chip body button and X button both have `tabIndex={-1}`
- [ ] The exercise input is the first focusable element when tabbing into the form (verified by a new test)
- [ ] Both inputs in the form use the `numeric` utility (not inline `font-mono text-sm`)
- [ ] All four labels use `font-medium tracking-[0.08em]`
- [ ] Form spacing between sections is `space-y-3` (not `space-y-2`)
- [ ] Form internal padding is `p-4` (not `p-3`)
- [ ] Reps input width is `w-16` (not `w-20`)
- [ ] The form row containing Reps / 1RM / Favorito is split into two rows (Reps alone; 1RM + Favorito together)
- [ ] All existing tests pass; 1 new test for the M4 tabIndex contract
- [ ] `npm run lint` verde, `npm run build` verde, `npm test -- --coverage` verde
- [ ] Coverage del chip y del form sin caída

## Implementation decisions

- **Grouping the commits**: 2 commits, one per file. Tier 2 + Tier 3 in `favorite-exercise-chips.tsx` is one commit (M2 + M4). All six Tier 3 polish items in `save-record-form.tsx` are one commit (L1 + L2 + L3 + L4 + L5 + L6). The diff per commit stays reviewable (a11y is one focused concern; polish is "form tightened to spec").
- **M2 visual size vs. hit area**: the icon is a 12px `X` inside a 20px button; the clickable area is a 24px wrapper. The visual stays small (consistent with the chip's squarish language) but the touch target hits the WCAG 2.5.5 minimum without the icon feeling oversized.
- **M4 tabIndex={-1} vs. roving tabindex**: roving tabindex is the more accessible pattern for chip rows (arrow keys to navigate, Tab to skip). It's also more code and out of scope. `tabIndex={-1}` is the minimal fix that solves the concrete complaint (too many tab stops) without introducing a new keyboard contract the form would need to teach.
- **L6 row split (Reps alone, toggles together)**: 1RM and "Marcar como favorito" are both booleans about the record being saved; grouping them makes semantic sense. Reps is the one numeric input and is the only required field, so it earns its own row.
- **L4 (`p-4`, not `p-5`)**: the form is a sub-form inside the calculator footer, not a chalk card. 1rem is enough breathing room; jumping to 1.25rem would inflate the form's visual weight past the footer's intended density.

## Further notes

- **Relationship to 0045**: 0045 shipped Tier 1. 0046 ships Tier 2 + Tier 3 from the same critique. After this ticket the `impeccable` critique on the form is fully closed.
- **Relationship to the form's overall density**: the form is a sub-form. The polish in Tier 3 is about getting it to the right density for a sub-form, not promoting it to a chalk card.
- **Relationship to the rest of the codebase**: a future housekeeping pass could extract the label recipe (Inter 500, 0.6875rem, 0.08em tracking, mute) into a `.label` utility in `globals.css` and migrate the form + `/classes` + `/settings` to it. Not in this ticket.
