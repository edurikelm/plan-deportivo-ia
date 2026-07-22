---
label: feature
status: open
---

## What to build

Two things layered on top of slices 4 and 5:

1. **Edit-then-save toggle** in the result card. "Editar" switches the card from a rendered markdown `ScrollArea` to a `Textarea` (with live preview via `react-markdown` + `remark-gfm`, side by side or tab-switched). A "Guardar" button persists the edited `content` to the matching `Idea` in `pd:ideas` via `updateIdea(id, …)`. If the user navigates away or hits Regenerar with a pending edit, confirm-discard (`window.confirm`).
2. **Polish + accessibility pass** across the app:
    - All forms: labels for every input, visible focus ring, keyboard-submittable, `aria-invalid` on errors.
    - `/classes` list: card link area is keyboard-focusable; empty state uses `role="status"`.
    - `/classes/new` + `/classes/[id]`: title hierarchy uses one `<h1>` per page; no skipped heading levels.
    - Mobile (`< sm`): the nav collapses into a header with a single primary CTA per page (acceptable to defer nav to v2); tables/cards reflow.
    - Color contrast: re-run shadcn tokens (light + dark) to confirm AA on all text in shadcn default Cards/Buttons.

Verify with `npm run build` clean, `npm run lint` clean, a manual walkthrough of each page with only the keyboard, and a chrome-devtools Lighthouse accessibility audit >= 95.

## Acceptance criteria

- [ ] Edit toggle (markdown ↔ textarea) works on `/classes/[id]/generate`. Guarded "Guardar" only enables if the textarea content differs from the last-saved value.
- [ ] Edit-then-save persists via `updateIdea`; the persisted `Idea` reflects the edited `content`.
- [ ] All `<input>`/`<textarea>` have associated `<label>` (or `aria-label`); focus visible; error states announced.
- [ ] Lighthouse accessibility score >= 95 on the three primary routes (`/classes`, `/classes/new`, `/classes/[id]/generate`).
- [ ] Mobile (375px width): no horizontal scroll on the primary routes; primary actions remain reachable.
- [ ] `npm run build` and `npm run lint` both pass with 0 warnings.

## Blocked by

- #0004 (output card)
- #0005 (regenerate button — needed because the edit-discard confirmation references it)
