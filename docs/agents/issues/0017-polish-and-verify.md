---
label: chore
status: closed
closed_at: 2026-08-29
parent: 0012-saved-weight-records
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

## Manual end-to-end test

The script below covers the full coach journey from creating records to reloading them. Run it in a clean browser profile (or with `localStorage` cleared) and report any deviation, console error, or unexpected behavior.

### Setup

- `npm run dev` and open `http://localhost:3000`.
- DevTools → Application → Local Storage → delete `pd:calculator-records`, `pd:calculator-state`, and `pd:sessions` (clean slate).
- DevTools → Console → clear + "Preserve log" on.

### Steps

1. **Save a labeled record (manual).**
   - Go to `/tools/weight-calculator`. Manual tab.
   - Bar = 20 kg. Add a disc: 25 kg × 1, count 1.
   - Click `Guardar`. Type "Back Squat" in the input.
   - Press Enter. Expect: form closes, toast "Carga guardada", focus returns to the `Guardar` button in the footer, total is still 45.0 kg.

2. **Verify the mini-panel.**
   - Below the bar visualization, the `REGISTROS` section shows one row: "Back Squat", 45.0 kg · 99.2 lb, "hace ahora", button `Cargar`.

3. **No auto-log fires on stable states.**
   - Add another disc: 10 kg × 1, count 1. Wait 5 s without touching anything. (Don't press `Guardar`.)
   - Refresh the page. Go to `/tools/weight-calculator/history`. There should still be **1 record** (the "Back Squat" manual save from step 1). The auto-log feature was removed in 0017 (it created more noise than value — see post-mortem below).

4. **Foto attribution.**
   - Go back to the calculator. Click the `Foto` tab. Upload an image of a bar with discs (any photo of a loaded barbell).
   - After the model returns, the preview shows. Click `Aplicar`. Expect: calculator switches to Manual tab with the foto's load applied, toast "Carga aplicada".
   - Open the history page. The new record has the `foto` source badge (with sparkles icon). Bar + discs match the foto.

5. **Persistence across refresh.**
   - Refresh the browser tab. The calculator's bar + discs match the last state.
   - The history page still shows all 3 records.

6. **Search.**
   - In the history page, type "squat" in the search box. Expect: only "Back Squat" matches; auto-log and foto records are hidden (their `exercise` is null).
   - Clear the search with the X button. Expect: all records reappear; focus returns to the search input.

7. **Filter chips.**
   - Click `Auto-log`. Expect: only the auto-log record. The chip is highlighted.
   - Click `Foto`. Expect: only the foto record. Click `Manual`. Expect: only "Back Squat". Click `Todos`. Expect: all.

8. **Sort.**
   - Change `Orden` to `Ejercicio A–Z`. Records order by `exercise` (nulls last).
   - Change to `Más pesados`. Order by `totalKg` desc.
   - Back to `Más recientes` (default).

9. **Load a record.**
   - From the history page, click `Cargar` on "Back Squat". Expect: navigates to the calculator; bar and discs already match the record (no flash of empty state).
   - The total shows 45.0 kg immediately.

10. **Copy a record.**
    - Back to the history page. Click `Copiar` on "Back Squat". Toast "Copiado al portapapeles".
    - Paste in a text editor. Expect 3 lines:
      ```
      Back Squat
      20kg + (25kg + 10kg)×2
      45.0kg · 99.2lb
      ```

11. **Delete a record.**
    - Click `Eliminar` on a record. Confirm dialog. Expect: row disappears; focus moves to the next row's `Cargar` button (or the previous if it was the last, or the search input if the list is now empty).

12. **Empty state.**
    - Delete all records. Expect: empty-state message with link back to the calculator.

13. **Sticky search bar.**
    - Re-create 5+ records. Scroll the list. Expect: search input + chips + sort selector stay fixed at the top.

14. **Mobile viewport.**
    - DevTools → toggle device toolbar → iPhone SE (375 × 667). No horizontal overflow. Tap targets feel comfortable (≥ 44 px on mobile).

15. **Keyboard nav.**
    - With keyboard only (no mouse): Tab through the history page. Every interactive element is reachable. Enter on `Cargar` triggers load. Enter on `Eliminar` triggers confirm.

16. **Cross-tab sync.**
    - Open the calculator in one tab, the history in another. In the calculator, `Guardar` a new record. The history tab's list updates (storage event propagates; even if the tab was in the background, the DOM is up to date when you switch back).

### Pass criteria

All 16 steps behave as described, no errors in the console (warnings about corrupt data are expected only if you manually break `localStorage`). Any failure → report with the step number and the observed vs. expected behavior.

## Resultado

The umbrella 0012 was the first feature to ship a "save + history" surface on the calculator. The 5 vertical slices (0013-0016) merged in order; this ticket (0017) added the polish + verification pass. Net effect of the work:

- **End-to-end manual save flow** works as specified: typed bar + discs → click Guardar → form inline in the footer → record with `source: "manual"`, `exercise: "Back Squat"`, snapshot of bar/discs, computed totals.
- **Mini-panel** in the calculator shows the last 5 labeled records with relative dates and a `Cargar` action.
- **Full history page** at `/tools/weight-calculator/history`: search (case-insensitive on `exercise`), source filter chips (Todos / Manual / Foto), sort (Más recientes / Más antiguos / Ejercicio A-Z / Más pesados), per-row Cargar / Copiar / Eliminar, sticky search/filter bar, empty state, no-matches state. Tap targets ≥ 44 px en mobile.
- **Foto attribution** persists a `source: "foto"` record when the coach accepts a photo breakdown. The attribution is immediate (not debounced) so post-accept edits don't lose the origin.
- **localStorage full** surfaces an actionable toast ("Almacenamiento lleno. Borrá registros antiguos desde el historial.") instead of a silent failure.
- **Focus management**: save form returns focus to the trigger on close; history delete moves focus to the next surviving row's `Cargar`; search X returns focus to the input.
- **aria-labels** on every actionable control include the relevant context (exercise name + total weight).

### Cambios

- `src/lib/storage.ts` — quota-error helper `isQuotaError`; simplified `addRecord` (no more auto-log cap).
- `src/lib/calculator/history.ts` — `hashState` kept (used by `handleLoadRecord`).
- `src/app/tools/weight-calculator/_components/calculator-client.tsx` — removed auto-log watcher, `lastAutoLogHashRef`, `fotoBusyRef`, and the foto-state sync effect. Added `guardarButtonRef` + `closeSaveForm` for focus return. Wrapped `addRecord(fotoRecord)` in try/catch with quota-aware toast.
- `src/app/tools/weight-calculator/_components/save-record-form.tsx` — quota-aware error message in the catch.
- `src/app/tools/weight-calculator/_components/saved-records-panel.tsx` — `Cargar` button bumped to 44 px on mobile, aria-label includes the total weight.
- `src/app/tools/weight-calculator/_components/history-page-client.tsx` — focus management on delete and search X; aria-labels with weight; removed the "Auto-log" filter chip (dead UI after the auto-log removal).
- `src/app/tools/weight-calculator/history/page.tsx` — new server shell (no changes after 0016).
- `docs/agents/issues/0016-history-page.md` — closed with post-mortem (see separate commit).
- `docs/agents/issues/0013-save-labeled-record.md`, `0014-auto-log.md`, `0015-mini-panel.md` — closed in earlier housekeeping.
- `docs/agents/issues/0012-saved-weight-records.md` — closed with umbrella summary.

### Pivots / decisions worth flagging

- **Auto-log removed during polish.** The original spec called for a passive debounced watcher that captured every stable state as `source: "auto-log"`. In practice, while dogfooding the e2e, the team observed that the auto-log filled the history with `exercise: null` rows and made the page noisier than the value of the safety net justified. Decision: stop producing new auto-logs entirely. The `auto-log` source variant is kept in the `RecordSource` enum so any stale entry written by older builds still validates through Zod; it'll be dropped on next read if it fails the new product reality. Net storage win: ~200 entries × ~200 bytes ≈ 40 KB no longer accumulated per coach. Documentation updates reflect this in `CONTEXT.md` and the umbrella close-out.
- **Foto attribution kept as the only "implicit" source.** It requires explicit user action (clicking `Aplicar` on the preview) and preserves origin through post-accept edits, which is a different trade-off than the auto-log's "everything I touched".
- **No test infra added.** The umbrella explicitly deferred test infra to a separate PR. This ticket's verification is the manual end-to-end script above. The pure helpers in `lib/calculator/history.ts` are the seam where tests would land first if/when the team adds Vitest.
