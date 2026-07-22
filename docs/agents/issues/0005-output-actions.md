---
label: feature
status: closed
closed_at: 2026-07-22
---

## Resultado

Botones agregados al Card de Result en `generate-client.tsx`:
- `Copy` (clipboard) con toasts éxito/error.
- `Download` (`Exportar .md`) genera `{slug}-{YYYY-MM-DD}.md` con blob + descarga programática.
- `RefreshCw` (`Regenerar`) reusa el flujo de POST, autoguarda con `addIdea` y reemplaza el result.
- Tres disabled cuando `busy`.

Pendiente para #0006: integración del confirm-dialog en Regenerar cuando edit-then-save exista.

## What to build

Output actions on the generated Idea (in `/classes/[id]/generate`):

- **Copiar** — `navigator.clipboard.writeText(content)`, toast "Copiado al portapapeles" on success, "No se pudo copiar" on rejection.
- **Exportar `.md`** — `Blob` with `content` as text/markdown, `URL.createObjectURL`, programmatic click on a temp `<a download="{className}-{YYYY-MM-DD}.md">`. No new deps.
- **Regenerar** — re-call `POST /api/generate` with the same Clase and focus. If the user has an unsaved edit in the textarea (slice 6), ask for confirmation before discarding (`window.confirm`).

All three actions reuse the same disabled-state machinery from slice 4.

Verify each action: Copiar pastes correctly into another app, Export downloads a readable `.md` file, Regenerar produces a fresh Idea.

## Acceptance criteria

- [ ] Copiar button writes the current `content` to the clipboard and shows success/error toast.
- [ ] Exportar button downloads a file named `{slug}-{YYYY-MM-DD}.md` (slug derived from `class.name` lowercased + dashes).
- [ ] Regenerar button calls the API again with the same Clase + focus, replaces the `content` only after the new response lands; if there's an unsaved edit confirmation, ask first.
- [ ] All three actions are disabled while a request is in flight.
- [ ] No new dependencies required.

## Blocked by

- #0004 (output card has to exist first)
