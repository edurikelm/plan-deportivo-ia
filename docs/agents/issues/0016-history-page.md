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

# 0016 — Full history page with search, filters, sort, and per-row actions

## What to build

At a dedicated route, the Entrenador sees a complete list of every record — named and auto-logged. They can search by exercise name, filter to only named / only auto-logged / only photo records, sort by recency / exercise / weight, and act on any row: load it back into the calculator, copy its breakdown to the clipboard, or delete it. The search bar stays visible as they scroll so they can keep filtering. The page is responsive across devices.

This ticket is the complete read-and-manipulate surface for the record history. It builds on the persisted record model from 0013 and can run in parallel with 0014 (auto-log) and 0015 (mini-panel).

## Blocked by

- **0013** — needs the persisted record model. Can run in parallel with 0014 and 0015.

## Acceptance criteria

- [ ] At the dedicated history route, the Entrenador sees a list of all records, newest first by default.
- [ ] The Entrenador can search the list by exercise name (case-insensitive, partial match).
- [ ] The Entrenador can filter the list to show only named / only auto-logged / only photo records (or all).
- [ ] The Entrenador can sort the list by date (newest/oldest), by exercise name, or by total weight.
- [ ] Each row has Load, Copy, and Delete actions.
- [ ] Each row visually identifies its source (auto-log, manual save, or photo application).
- [ ] Load brings the record into the calculator and navigates to the calculator route (the calculator opens with the loaded configuration already applied, with no flash of empty state).
- [ ] Copy writes the record's breakdown to the clipboard.
- [ ] Delete asks for confirmation and then removes the record.
- [ ] The search and filter bar stays visible as the Entrenador scrolls.
- [ ] When there are no records, the page shows an empty state.
- [ ] When filters produce no matches but records exist, the page shows a "no matches" state.
- [ ] The page is usable on a mobile viewport — no horizontal overflow, all tap targets reachable.
- [ ] Changes made in another browser tab are reflected in this page when the tab regains focus.
