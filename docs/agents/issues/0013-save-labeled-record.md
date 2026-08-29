---
label: feature
status: closed
closed_at: 2026-08-29
parent: 0012-saved-weight-records
depends_on: []
blocks:
  - "0014"
  - "0015"
  - "0016"
  - "0017"
---

# 0013 — Save a labeled record

## What to build

An Entrenador types a bar and a set of discs in the calculator. They click a Save action, enter an exercise name, and confirm. The record — the bar, the discs, the total weight, and the exercise name — is persisted so that refreshing the page keeps it. The next time the Entrenador starts typing the same exercise, the field offers it as a suggestion.

This ticket is the first vertical slice of the umbrella. It introduces the persisted record model, the storage layer, and the user-facing save flow end-to-end.

## Blocked by

None — can start immediately.

## Acceptance criteria

- [ ] An Entrenador can complete a bar and disc configuration in the calculator.
- [ ] An Entrenador sees a Save action available in the calculator footer.
- [ ] Clicking Save reveals a name field that requires a non-empty exercise name to submit.
- [ ] After submitting, the record (exercise name, bar, discs, totals) is persisted across page refresh.
- [ ] The exercise name field suggests names the Entrenador has used before as they type.
- [ ] Submitting with an empty or whitespace-only name is not possible.
- [ ] Pressing Escape while the name field is open closes it without saving.
- [ ] The Save action is not available when the calculator is in its initial empty state (no discs, default bar).
- [ ] While the save form is open, the calculator's total weight remains visible to the Entrenador.
- [ ] The persisted record schema matches the one declared in the umbrella (0012) — same field names, same source tag for records created through this flow.
