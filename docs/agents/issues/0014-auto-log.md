---
label: feature
status: closed
closed_at: 2026-08-29
parent: 0012-saved-weight-records
depends_on:
  - "0013"
blocks:
  - "0017"
---

# 0014 — Auto-log captures stable states

## What to build

As the Entrenador uses the calculator, each time they settle on a bar and disc configuration, the system quietly records it in the background. The Entrenador does not need to take any action for these records to exist. If they type the same configuration repeatedly in quick succession, the system dedupes it so the log is not noisy. If they apply a load from a photo, the system records the load with a photo attribution immediately so the origin is preserved. If the auto-logged records grow large, the system drops the oldest to keep storage bounded; records the Entrenador named are never dropped.

This ticket is the passive-capture counterpart of the manual save flow in 0013. It builds on the persisted record model and storage helpers from 0013.

## Blocked by

- **0013** — needs the persisted record model and storage helpers from the save ticket.

## Acceptance criteria

- [ ] After the Entrenador changes the bar or discs and pauses for a moment, a new auto-logged record appears in storage.
- [ ] Rapidly changing the bar or discs back to a previously-logged state does not produce a duplicate auto-log entry.
- [ ] The Entrenador can see no visible UI change when an auto-log happens (no toast, no animation, no badge) — the capture is silent.
- [ ] When the Entrenador accepts a load from the photo flow, a record with photo attribution is created immediately (without waiting for the debounce).
- [ ] When the photo attribution record is created, it is created even if the Entrenador then edits the configuration before the auto-log debounce fires.
- [ ] Records with photo attribution or a manual exercise name are never discarded, even if many auto-log entries accumulate.
- [ ] When more than 200 auto-logged records accumulate, the oldest auto-logged record is discarded; named records are unaffected.
- [ ] On a fresh page load with the calculator at its default state, no auto-log entry is created by simply opening the page and waiting.
