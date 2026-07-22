---
label: feature
status: open
---

## What to build

The core generation experience at `/classes/[id]/generate`. This is the page an Entrenador lands on after picking a Clase:

- Server-rendered shell that reads the Clase by `id` (404 if missing) and passes it to a `GenerateClient` client component.
- Client renders an `IdeaForm` (one field: optional `focus`) and a `PlanOutput` placeholder.
- On submit: send `POST /api/generate` with `{ clase, focus }`. While busy: disable the whole form (`<fieldset disabled>`), show a centered overlay with a spinner and "Esperando respuesta de la IA…".
- On success: render the markdown response in a `ScrollArea` inside a `Card`. Fire a Sonner toast "Plan generado y guardado en el historial".
- **Auto-save**: the moment a successful response lands, write an `Idea` to `pd:ideas` via `addIdea({ classId, content, model, focus })`. The Idea is what shows up later in any future history view.

Verify the full loop end-to-end with a real API key: enter a Clase, type a focus, click Generar, see the overlay, see the rendered markdown, see the toast, refresh the page (still empty in this slice — there's no history page yet, but the entry is in localStorage).

## Acceptance criteria

- [ ] `/classes/[id]/generate` returns `200`; `404` if the Clase doesn't exist.
- [ ] The full submit → loading → result loop completes against the real MiniMax API.
- [ ] The form is fully disabled (fieldset) while the request is in flight, including focus input and submit button. The submit button text becomes "Generando plan… (no se puede interrumpir)".
- [ ] A `backdrop-blur` overlay with a spinner covers the form card while busy.
- [ ] On success, an `Idea` is appended to `pd:ideas` with the real `classId`, the LLM's `content`, the `model`, and the focus.
- [ ] Sonner toast says "Plan generado y guardado en el historial" on success, and a generic error toast on failure.
- [ ] `npm run lint` clean (no `react-hooks/set-state-in-effect`, no unescaped entities, etc.).

## Blocked by

- #0001 (storage hook + types)
- #0002 (the AI endpoint)
- #0003 (the Clase must exist before generating)
