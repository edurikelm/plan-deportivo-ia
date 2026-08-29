---
label: chore
status: open
parent: 0012-saved-weight-records
ready-for-agent: true
depends_on:
  - "0013"
  - "0014"
  - "0015"
  - "0016"
blocks: []
---

# 0017 — Polish, edge cases, and end-to-end verification

## What to build

The whole feature — calculator mini-panel, full history page, save form, auto-log behavior — is keyboard-navigable, screen-reader friendly, mobile-responsive, and free of edge-case failures. A scripted manual end-to-end test passes, covering the full coach journey from creating records to reloading them. The umbrella (0012) and all child tickets are closed with their post-mortem records.

This ticket is the final integration and quality gate. It does not introduce new user-facing behavior; it makes the behavior from 0013-0016 robust, accessible, and verified.

## Blocked by

- **0013** — manual save flow must exist.
- **0014** — auto-log must exist.
- **0015** — mini-panel must exist.
- **0016** — full history page must exist.

## Acceptance criteria

- [ ] All interactive elements (Save, Load, Copy, Delete, filter chips, search input, sort selector) are reachable by Tab and operable by Enter or Space.
- [ ] Every actionable control has a screen-reader-accessible label that includes the relevant context (e.g., "Load Back Squat 80kg" rather than just "Load").
- [ ] Focus moves sensibly when a record is deleted, the save form opens, the save form closes, or the search input is filled.
- [ ] On a mobile viewport, no content overflows horizontally, and every tap target is at least 44x44 pixels.
- [ ] When localStorage is full, the Entrenador sees a clear, actionable message rather than a silent failure.
- [ ] When stored data is corrupt, the calculator and history page still load; the corrupted entries are filtered out (with a developer-visible warning in the console).
- [ ] The save form's footer expansion does not cause the sticky total at the bottom of the calculator to disappear from view.
- [ ] A scripted manual end-to-end test passes: create a labeled record, trigger an auto-log, apply a photo record, refresh the page, open the history page, search, filter, sort, load a record, copy a record, delete a record, and confirm the calculator ends up in the expected state. The script is recorded in this ticket's post-mortem.
- [ ] No console errors or warnings appear during the end-to-end test (other than the documented corruption warnings).
- [ ] The umbrella (0012) and tickets 0013, 0014, 0015, 0016 are closed with their post-mortem records following the project's issue-closing convention.
- [ ] The project documentation (`CONTEXT.md`, `PRODUCT.md`) is in sync with the final implementation; any drift discovered during polish is corrected in this ticket.
