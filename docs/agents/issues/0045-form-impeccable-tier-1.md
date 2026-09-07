---
label: refinement
status: open
parent: 0044
depends_on: []
blocks: []
---

# 0045 — Form + chips impeccable pass (Tier 1)

## Context

The `SaveRecordForm` and the `FavoriteExerciseChips` it embeds shipped in 0044 after a fast iteration that did not include a design pass. The components compile, are covered, and pass accessibility checks, but they break several rules of the visual world documented in `DESIGN.md`:

- The form container uses `bg-panel/60` (a 60% opacity overlay) as a layering trick. DESIGN.md forbids opacity-based elevation: depth lives in luminosity, not transparency. The form is mounted inside the calculator's sticky footer and behaves as a popover; the correct token is `bg-popover` (one step above panel) or solid `bg-panel` with the existing hairline doing the separation.
- The form container is `rounded-sm` (2px). DESIGN.md says containers are `rounded-none` (paper, not button); `rounded-sm` is reserved for inputs and textareas.
- The favorite chip, when active, is filled with `bg-signal/15` — the *accent* token, which DESIGN.md reserves for "never decoration". The chip spec says selected = `bg-signal text-signal-foreground` (solid signal, signal-foreground text).
- The favorite chip is `rounded-full` (pill). The chip spec in DESIGN.md says `rounded-sm` (2px) for chips, consistent with the type-tags on `/classes`.
- The favorite chip's inactive state uses `text-bone/70`. The chip spec says inactive = `text-mute` with hover transition to `text-bone`.

In addition, two state / interaction gaps are worth closing in the same pass:

- The form's submit button does not surface a loading state. `submitting` is tracked but the button keeps its idle label. A localStorage write is fast, but the toast fires AFTER `onSaved` closes the form, leaving a perceptible delay with no visual feedback.
- The label "Agregar a favoritos" is misleading: un-checking the box on a previously-favorited name and submitting *removes* the favorite. The label should read neutrally as a toggle.

## Goal

Bring the form and the favorite chip into the visual world without touching functionality or breaking any existing test. Seven changes total, all on the same vertical slice, no new dependencies, no new files.

## User stories

1. As a coach, when I open the save form, the surface that opens up is clearly distinct from the calculator footer behind it (no transparency, no glass).
2. As a coach, when I look at a chip in the form, its shape and color rules match the rest of the system's chips (squarish, hairline border, mute in pasivo, signal in activo).
3. As a coach, when I click "Guardar" and the save is in flight, I see a "Guardando…" state on the button so the system acknowledges the action.
4. As a coach, the label next to the favorites checkbox tells me the truth about what it does, including the remove case.

## Solution

One ticket, four files, seven changes. All on the same branch, two atomic commits (chip + form).

### Chip component — `favorite-exercise-chips.tsx`

- **H3** — Active state: `bg-signal/15` → `bg-signal text-signal-foreground`. Drop the `border-signal` (the fill is signal already; the border would be redundant). Use `border-transparent` to keep the box the same size and avoid a 1px shift on activation.
- **H4** — `rounded-full` → `rounded-sm` on both the chip wrapper and the X button.
- **H5** — Inactive state: `text-bone/70` → `text-mute`. Hover transition stays `hover:text-bone`.
- **Bonus** — The X button's `text-bone/40 hover:text-signal hover:bg-signal/15` does not work on a solid-signal active chip (the green-on-green hover is invisible). Replace with `hover:bg-foreground/10` — a 10% bone overlay that reads as a hover state on both transparent (inactive) and signal (active) backgrounds. The X icon color is now `currentColor`, inheriting the wrapper.
- **Bonus** — Replace the inline `font-mono text-[0.7rem] tracking-[0.04em]` with the `.numeric-label` utility from `globals.css:217`. The utility exists exactly for this; using it removes a string of inline utilities and makes future type changes a one-line diff.

### Form — `save-record-form.tsx`

- **H1** — `bg-panel/60` → `bg-popover`. The form is a popover over the calculator footer; the elevation rule is `canvas < panel < popover`. `bg-popover` is one step above the footer's `bg-panel` and is the right semantic match.
- **H2** — `rounded-sm` → `rounded-none` on the form container. Containers are paper, not buttons. The existing `border border-hairline` carries the visual edge.
- **M1** — Loading state on the submit button. While `submitting === true`, the button:
  - is `disabled`,
  - swaps the `BookmarkPlus` icon for `Loader2` with `animate-spin`,
  - swaps the label "Guardar" for "Guardando…".
  The toast on success still fires (the parent component decides when to close the form, and the toast is set in the success branch). The `useState` reset (`setSubmitting(false)`) only runs on the error branch — the happy path leaves the form via `onSaved`, which the parent unmounts.
- **M3** — `aria-label="Agregar a favoritos"` → `aria-label="Marcar como favorito"`. The visible label text also changes (the `<label>` children). The label is now neutral: the same checkbox can add or remove a favorite depending on the current state and the coach's intent.

### Tests — `save-record-form.test.tsx`

- Update every `getByLabelText("Agregar a favoritos")` to `getByLabelText("Marcar como favorito")`. There are six call sites; the test names and assertions stay the same.
- Add a new test for the M1 loading state:
  - Click "Guardar".
  - The button immediately becomes disabled and shows the "Guardando…" label.
  - On success the form is unmounted via `onSaved` (we don't observe the button after the unmount, but the test asserts the loading state was visible at the moment of the click — using a synchronous assertion right after the click is enough; jsdom does not yield control to a re-render between the click and the next read in userEvent v14).

No tests need updating for H1 / H2 / H3 / H4 / H5 — the tests assert on `data-active`, `aria-pressed`, and `aria-label`, all of which stay the same. Visual classes are not asserted.

## Out of scope

- **Tier 2 (M2, M4)** — touch target on the X button (24×24), chip tabIndex. A11y improvements that can ship in a follow-up.
- **Tier 3 (L1–L7)** — `.numeric` utility on the form inputs, label font-weight 500/0.08em (vs current 600/0.10em), `space-y-3` and `p-4` rhythm, `w-16` on the reps input, two-row mobile layout for Reps/1RM/Favorito, focus-visible ring on the chip body. Housekeeping that can be a single sweep once the main form is settled.
- **Editing the design tokens or `DESIGN.md`** — these are application-level rules. The form was wrong; the rules were not.
- **Changing the form's behavior** (autocomplete, submit-on-enter, Escape-to-cancel, autofocus). All unchanged.

## Acceptance

- [ ] `SaveRecordForm` container uses `bg-popover` (no opacity) and `rounded-none` (no `rounded-sm`)
- [ ] `FavoriteExerciseChips` active state is `bg-signal text-signal-foreground` (not `bg-signal/15`)
- [ ] Both chip shapes use `rounded-sm` (not `rounded-full`)
- [ ] Inactive chip uses `text-mute` (not `text-bone/70`)
- [ ] Submit button shows "Guardando…" + `Loader2 animate-spin` while `submitting === true`, and is disabled during that window
- [ ] The favorites checkbox label reads "Marcar como favorito" everywhere (the label and the `aria-label`)
- [ ] All existing tests in `save-record-form.test.tsx` pass after the label rename (no semantic regressions)
- [ ] New test for the loading state passes
- [ ] `npm run lint` verde, `npm run build` verde, `npm test -- --coverage` verde
- [ ] Coverage del chip component y del form sin cambios (siguen al 100% / sin caída)

## Implementation decisions

- **`bg-popover` vs `bg-panel` for the form**: I went with `bg-popover`. The form *is* a popover — it mounts on top of the calculator footer to collect data and unmounts on save / cancel. The elevation rule says popovers live above panels, and the form behaves as one. If the user wants the form to be solid panel instead (no elevation), the diff is a one-line revert.
- **`border-transparent` on the active chip**: keeps the box dimensions identical to the inactive chip (which has a 1px hairline border). Without it, the chip would shift by 1px when activated — a small but visible jitter.
- **X button hover color**: replaced `hover:text-signal hover:bg-signal/15` with `hover:bg-foreground/10`. Reason: on a solid-signal active chip, hovering with signal text + signal background is invisible. `foreground/10` (a 10% bone overlay) is visible on both transparent and signal backgrounds and stays inside the system's "no second saturated color" rule.
- **`numeric-label` utility on the chip**: the utility is defined in `globals.css:217` and matches exactly the recipe we were spelling inline (mono + tabular-nums + 0.04em tracking). Using it is the right move and the only way the utility centralization pays off.
- **Loading state without a debounce**: `submitting` flips synchronously in the click handler; the next render shows the loading state. The `setTimeout` race in the autofocus useEffect is unrelated and stays.

## Further notes

- **Relationship to 0044**: 0044 shipped the form and chips. 0045 is a refinement on top — the PR will land on the same branch pattern (branch from master, atomic commits, admin merge).
- **Relationship to the craft floor**: this pass is Tier 1 of an `impeccable` critique on the form. The remaining 9 findings (Tier 2 a11y + Tier 3 polish) are documented and can be picked up as housekeeping later.
- **Relationship to the visual world**: every change is grounded in `DESIGN.md`. No new tokens, no new colors, no new shapes. The form already had the right tokens available; the fix is to use them.
