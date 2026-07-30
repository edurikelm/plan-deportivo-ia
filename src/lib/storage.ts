import type { SavedSession } from "./types";

const SESSIONS_KEY = "pd:sessions";

function dispatchStorage(key: string, newValue: string): void {
  window.dispatchEvent(
    new StorageEvent("storage", {
      key,
      newValue,
      storageArea: window.localStorage,
    }),
  );
}

// ─── Migration ───────────────────────────────────────────────────────────────

/**
 * Silent migration on first read.
 * Discards the legacy pd:classes and pd:ideas keys if present,
 * without throwing or notifying the user.
 */
function migrateIfNeeded(): void {
  try {
    const hasLegacy =
      localStorage.getItem("pd:classes") !== null ||
      localStorage.getItem("pd:ideas") !== null;
    if (hasLegacy) {
      localStorage.removeItem("pd:classes");
      localStorage.removeItem("pd:ideas");
    }
  } catch {
    // Ignore migration errors
  }
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export function getSessions(): SavedSession[] {
  migrateIfNeeded();
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setSessions(sessions: SavedSession[]): void {
  const json = JSON.stringify(sessions);
  localStorage.setItem(SESSIONS_KEY, json);
  dispatchStorage(SESSIONS_KEY, json);
}

export function addSession(session: SavedSession): void {
  setSessions([...getSessions(), session]);
}

export function updateSession(updated: SavedSession): void {
  setSessions(
    getSessions().map((s) => (s.id === updated.id ? updated : s)),
  );
}

export function removeSession(id: string): void {
  setSessions(getSessions().filter((s) => s.id !== id));
}

/** Returns the most recent sessions, newest first. */
export function getRecentSessions(limit = 5): SavedSession[] {
  return [...getSessions()]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
