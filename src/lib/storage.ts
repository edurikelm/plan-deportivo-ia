import type { SavedSession } from "./types";
import { DiscRowSchema, type CalculatorState } from "./calculator/schemas";

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

// ─── Calculator state ────────────────────────────────────────────────────────

const CALCULATOR_KEY = "pd:calculator-state";

export function getCalculatorState(): CalculatorState {
  try {
    const raw = localStorage.getItem(CALCULATOR_KEY);
    if (!raw) return { barKg: 20, discs: [] };
    const parsed = JSON.parse(raw);
    // Validate shape: barKg must be a positive number, discs must be a non-empty
    // array where at least one element parses with DiscRowSchema.
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.barKg !== "number" ||
      parsed.barKg <= 0 ||
      !Array.isArray(parsed.discs)
    ) {
      console.warn("[pd:calculator-state] corrupt data, returning defaults");
      return { barKg: 20, discs: [] };
    }
    // Sample-validate one disc entry to catch field-level corruption
    if (parsed.discs.length > 0) {
      const sample = DiscRowSchema.safeParse(parsed.discs[0]);
      if (!sample.success) {
        console.warn("[pd:calculator-state] corrupt disc data, returning defaults", sample.error.issues);
        return { barKg: 20, discs: [] };
      }
    }
    return parsed as CalculatorState;
  } catch {
    return { barKg: 20, discs: [] };
  }
}

export function setCalculatorState(state: CalculatorState): void {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(CALCULATOR_KEY, json);
    dispatchStorage(CALCULATOR_KEY, json);
  } catch (err) {
    console.warn("[pd:calculator-state] failed to persist:", err);
  }
}
