/**
 * Pure helpers for `SavedSession` transitions.
 *
 * The session lifecycle is intentionally simple: the user generates a session
 * (result is ephemeral in memory), optionally saves it (persists to
 * `pd:sessions`), and can later load it back into the active result for
 * editing or regeneration. The transition is trivial — but giving it a name
 * makes the callsite read clearly and gives us a single point to evolve
 * (e.g. add a `lastLoadedAt` field, or strip stale `structured` data) without
 * grepping the codebase.
 *
 * No React, no storage — pure transformations of `SavedSession` objects.
 */
import type { SavedSession } from "./types";

/**
 * Return `source` unchanged, typed as a transition that the caller is
 * intentionally making. The point is to give a name to the "I am loading a
 * previously-saved session into the active result" action so the call site
 * reads as a domain operation, not just `setState(savedSession)`.
 *
 * Preserves `id`, `createdAt`, `model`, `structured`, `markdown`, `input`,
 * `title` so a subsequent `Guardar` does an `updateSession` (idempotency)
 * rather than a fresh `addSession`.
 */
export function loadSessionInto(source: SavedSession): SavedSession {
  return {
    id: source.id,
    modalityId: source.modalityId,
    createdAt: source.createdAt,
    model: source.model,
    markdown: source.markdown,
    structured: source.structured,
    input: source.input,
    title: source.title,
  };
}
