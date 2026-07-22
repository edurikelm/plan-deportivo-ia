---
label: feature
status: closed
closed_at: 2026-07-22
---

## Resultado

Implementado y commiteado. Las 4 rutas (`/classes`, `/classes/new`, `/classes/[id]`, redirect `/`) funcionan, con validación inline, Tabs editor/preview con `react-markdown` + `remark-gfm`, delete con `confirm()` y cascade a Ideas via `removeClass`. 

Pendiente menor (no bloqueante): `/classes/[id]/generate` devuelve 404 — esperado porque vive en #0004.

## What to build

The CRUD layer for Clases. Three routes, all driven by the same form shape, all using shadcn primitives:

- `/classes` — list of all Clases with empty state. Each card shows name, exercises count, durationMinutes, and links to editar / generar. "+ Nueva Clase" CTA.
- `/classes/new` — form to create a Clase: `name` (Input), `structure` (Textarea monospace with tabs editor/preview using `react-markdown`), `exercises` (Textarea, one per line), `durationMinutes` (Input number). Save → append to `pd:classes`, redirect to `/classes`.
- `/classes/[id]` — same form precargado. Save → `updateClass(id, …)`. A destructive "Eliminar clase" button at the bottom with a `confirm()` dialog that calls `removeClass(id)` **and `removeIdeasByClass(id)`** (cascade).

Verify the full cycle end-to-end: create → list shows it → edit → list reflects it → delete → list empty.

## Acceptance criteria

- [ ] `/classes` empty state says "Todavía no creaste ninguna Clase. Empezá creando Crossfit o la que prefieras." with a primary CTA.
- [ ] `/classes/new` form rejects empty `name`, empty `structure`, or `durationMinutes <= 0` with inline errors.
- [ ] `/classes/[id]` form persists changes and redirects to `/classes`.
- [ ] Delete on `/classes/[id]` asks for confirmation, removes the Clase and all its Ideas, redirects to `/classes`.
- [ ] All three routes return `200` (`npm run build` must succeed) and use shadcn `Card` / `Input` / `Textarea` / `Button` / `Badge` for layout.
- [ ] Manual smoke test: full CRUD cycle in the browser logs no console errors.

## Blocked by

- #0001 (storage + types)
