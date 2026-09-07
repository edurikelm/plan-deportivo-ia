/**
 * Pure helpers for the coach's exercise favorites (issue 0044).
 *
 * A "favorite" is an exercise name (string) that the coach has marked for
 * quick access from the save-record form. Favorites are persisted in
 * localStorage by `src/lib/storage.ts`; this module owns the *shape* and
 * the *transformations* on the in-memory list, with no IO.
 *
 * Convention: case-insensitive equality, trim-aware. This matches the
 * `dedupeExercises` and `findTypicalByName` conventions used elsewhere
 * in the calculator, so a coach who types "back squat" and one who
 * types "Back Squat" end up with the same favorite entry.
 *
 * Sort order: most recently favorited first. New entries are prepended
 * so the freshest favorite is at index 0 — the natural "what I just
 * starred" placement in the chip row.
 */

/**
 * Returns a new list with `name` added at the head. If a case-insensitive
 * match for `name` already exists, the existing entry is moved to the head
 * (effectively re-starring it as "most recent") rather than duplicated.
 *
 * Empty / whitespace-only `name` is dropped — the caller does not need to
 * pre-validate, but doing so is also safe.
 */
export function addFavorite(list: readonly string[], name: string): string[] {
  const needle = name.trim();
  if (needle === "") return [...list];
  const key = needle.toLowerCase();
  const filtered = list.filter((n) => n.toLowerCase() !== key);
  return [needle, ...filtered];
}

/**
 * Returns a new list with the case-insensitive match for `name` removed.
 * If no match exists, the list is returned unchanged (still a fresh array
 * so the caller can detect "no-op" by reference comparison if needed).
 */
export function removeFavorite(list: readonly string[], name: string): string[] {
  const needle = name.trim();
  if (needle === "") return [...list];
  const key = needle.toLowerCase();
  return list.filter((n) => n.toLowerCase() !== key);
}

/**
 * Returns `true` if `name` (case-insensitive, trim-aware) is in the list.
 * Returns `false` for empty / whitespace-only `name`.
 */
export function isFavorite(list: readonly string[], name: string): boolean {
  const needle = name.trim().toLowerCase();
  if (needle === "") return false;
  return list.some((n) => n.toLowerCase() === needle);
}

/**
 * Convenience: returns `{ list, isFavorite }` after toggling `name` in the
 * list. If `name` was already a favorite, it is removed; otherwise it is
 * added at the head.
 *
 * Useful for the form's "Agregar a favoritos" checkbox where the new state
 * is the next render's source of truth.
 */
export function toggleFavorite(
  list: readonly string[],
  name: string,
): { list: string[]; isFavorite: boolean } {
  const already = isFavorite(list, name);
  return {
    list: already ? removeFavorite(list, name) : addFavorite(list, name),
    isFavorite: !already,
  };
}
