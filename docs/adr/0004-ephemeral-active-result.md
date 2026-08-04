# Ephemeral Active Result with beforeunload Guard

The `active result` (the in-memory `SavedSession` shown in the chalk card right after generation) is **deliberately ephemeral**: it lives only in the component's local state. There is no rehydration on mount, no draft persistence across tab close, no auto-save of unconfirmed generations. The user must press `Guardar` to make it durable. A `beforeunload` listener warns before the browser discards unsaved work; a "SIN GUARDAR" indicator in the status strip keeps the state visible while the user works.

**Status**: accepted

## Decision

- `result` in `generate-client.tsx` is local state. On mount it is `null`. The only persisted source of sessions is `pd:sessions` (mini-historial).
- `Guardar` is **always available** in view mode (not only in edit mode). When `persisted && !hasPendingEdit`, it is disabled with tooltip "Sin cambios" to avoid redundant writes.
- `beforeunload` fires the browser-native confirm when `(result !== null && !persisted) || hasPendingEdit`. Same threshold as the existing `window.confirm` in `Regenerar`.
- A `SIN GUARDAR` label in the status strip (right of the title, `text-signal`, uppercase tracking-plus) appears under the same condition. Hidden otherwise — there is no passive "GUARDADO" badge.
- `Guardar` lives in the chalk card footer as the primary signal action, before the ghost actions (Copiar, Exportar, Regenerar, Editar). The status-strip pill keeps its "LLM action" semantics (`Generar` / `Regenerar`).

## Considered alternatives

- **Auto-rehydrate the most recent SavedSession on mount** — rejected. Adds a draft-like state that has no clear conflict resolution when the user generates something new and then refreshes; the user has no way to "discard" the rehydrated draft without editing it.
- **Mini-history click-to-reopen as active result** — rejected (already deferred per `.impeccable/surface-briefs/generate-modality.md` §80). A separate feature; out of scope here.
- **Auto-save (debounced/idle) instead of explicit `Guardar`** — rejected. Breaks the metaphor of `SavedSession` as a "hoja firmada" (DESIGN.md) and removes the user's opt-in.

## Consequences

- The user can lose work if they navigate away without `Guardar` and dismiss the `beforeunload` prompt. This is by design — the prompt is the safety net, not silent persistence.
- The active result is never shared across tabs. Two tabs generate independently; each has its own ephemeral `result`.
- `Regenerar` resets `persisted` to `false` and `editedMarkdown` to `null`, so the indicator reappears.
- The `SIN GUARDAR` indicator is the only place where the persistence state is visible to the user outside of the `Guardar` button itself.