---
label: feature
status: open
parent: 0012-saved-weight-records
ready-for-agent: true
depends_on:
  - "0013"
blocks:
  - "0017"
---

# 0015 — Mini-panel in the calculator shows last 5 labeled records

## What to build

Inside the calculator, below the visual bar representation, the Entrenador sees a compact list of their most recent named records (their labeled saves, not the silent auto-log). Each entry shows the exercise name, the total weight, and when it was saved. Clicking a Load action on any entry brings that record back into the calculator — replacing the current configuration if it differs (with a confirmation), or doing nothing if the calculator already shows that configuration. An entry at the bottom takes the Entrenador to the full history page.

This ticket is the first read-surface of the feature. It builds on the persisted record model from 0013 and can run in parallel with 0014 (auto-log) and 0016 (full history page).

## Blocked by

- **0013** — needs the persisted record model. Can run in parallel with 0014 and 0016.

## Acceptance criteria

- [ ] Below the bar visualization in the Manual tab, the Entrenador sees a list of their last 5 named records.
- [ ] Each entry shows the exercise name, the total in kg and lb, the breakdown line, and a relative timestamp (e.g., "2h ago").
- [ ] Each entry has a Load action.
- [ ] Clicking Load on a record that matches the current calculator state does nothing — no error, no dialog, no toast.
- [ ] Clicking Load on a record that differs from the current state shows a confirmation before replacing the current state.
- [ ] If there are no named records, the panel shows an empty state that invites the Entrenador to save their first one.
- [ ] At the bottom of the panel, there is a link to the full history page.
- [ ] The panel does not appear in the Photo tab — the photo flow's attention stays on the preview.
- [ ] If the Entrenador saves a record while the panel is visible, the panel updates without needing a refresh.
- [ ] If the Entrenador changes records in a different browser tab, the panel updates when that tab regains focus.
