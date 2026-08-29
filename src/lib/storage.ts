import type { SavedSession, SavedWeightRecord } from "./types";
import {
  DiscRowSchema,
  SavedWeightRecordSchema,
  type CalculatorState,
} from "./calculator/schemas";
import { dedupeExercises } from "./calculator/history";

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

// ─── Saved weight records (calculator history) ──────────────────────────────

const RECORDS_KEY = "pd:calculator-records";

/**
 * Hard cap on the number of auto-logged records kept in storage. When the
 * cap is exceeded by a new `auto-log` insert, the oldest auto-log is
 * discarded. Records with `source: "manual"` or `"foto"` are never
 * discarded — only auto-logs, which are pure telemetry.
 *
 * The cap is conservative (200 entries × ~200 bytes ≈ 40 KB) to leave
 * plenty of headroom under the 5 MB localStorage quota.
 */
const AUTO_LOG_CAP = 200;

function setRecords(records: SavedWeightRecord[]): void {
  const json = JSON.stringify(records);
  localStorage.setItem(RECORDS_KEY, json);
  dispatchStorage(RECORDS_KEY, json);
}

/**
 * Parses a raw JSON string into a list of saved weight records, filtering
 * out any entries that fail Zod validation. Corrupt entries are dropped
 * silently (the `localStorage` write path is trusted; only the read path
 * is defensive).
 *
 * Exposed separately from `getRecords` so that callers holding their own
 * raw string (e.g. via `useSyncExternalStore` over localStorage) can
 * parse without round-tripping back through `getItem`. This makes the
 * dependency on the raw string explicit and lets memoized callers
 * invalidate correctly.
 */
export function parseRecordsFromRaw(raw: string): SavedWeightRecord[] {
  try {
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn(
        "[pd:calculator-records] expected array, discarding:",
        typeof parsed,
      );
      return [];
    }
    return parsed.filter((entry, index) => {
      const result = SavedWeightRecordSchema.safeParse(entry);
      if (!result.success) {
        console.warn(
          `[pd:calculator-records] discarding corrupt entry at index ${index}:`,
          result.error.issues,
        );
        return false;
      }
      return true;
    }) as SavedWeightRecord[];
  } catch (err) {
    console.warn("[pd:calculator-records] failed to parse:", err);
    return [];
  }
}

/**
 * Returns the full list of saved weight records, filtering out any entries
 * that fail Zod validation. Corrupt entries are dropped silently (the
 * `localStorage` write path is trusted; only the read path is defensive).
 */
export function getRecords(): SavedWeightRecord[] {
  let raw: string;
  try {
    raw = localStorage.getItem(RECORDS_KEY) ?? "";
  } catch (err) {
    console.warn("[pd:calculator-records] failed to read:", err);
    return [];
  }
  return parseRecordsFromRaw(raw);
}

/**
 * Appends a record to the history. If the record is an `auto-log` and the
 * total auto-log count would exceed the cap, the oldest auto-logged
 * record is discarded to make room. Manual and foto records are always
 * appended without affecting the auto-log cap.
 */
export function addRecord(record: SavedWeightRecord): void {
  const current = getRecords();

  if (record.source === "auto-log") {
    // Cap on auto-logs only — drop the oldest auto-log if we'd exceed the cap.
    const autoLogs = current.filter((r) => r.source === "auto-log");
    const manualOrFoto = current.filter((r) => r.source !== "auto-log");
    if (autoLogs.length >= AUTO_LOG_CAP) {
      // Sort by createdAt asc; drop the oldest.
      autoLogs.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      autoLogs.shift();
    }
    setRecords([...manualOrFoto, ...autoLogs, record]);
  } else {
    setRecords([...current, record]);
  }
}

/**
 * Replaces an existing record by `id`. If no record with that `id` exists,
 * the call is a no-op (the caller is expected to either pre-validate the
 * id or treat the miss as an error).
 *
 * Currently exported for future use; the MVP UI does not expose inline
 * editing. Kept symmetric with `addRecord` / `removeRecord` for the day
 * when editing a record becomes a user-facing need.
 */
export function updateRecord(record: SavedWeightRecord): void {
  const current = getRecords();
  const idx = current.findIndex((r) => r.id === record.id);
  if (idx === -1) {
    console.warn(
      `[pd:calculator-records] updateRecord: no entry with id ${record.id}`,
    );
    return;
  }
  const next = [...current];
  next[idx] = record;
  setRecords(next);
}

/**
 * Removes the record with the given `id`. If no such record exists, this is
 * a no-op.
 */
export function removeRecord(id: string): void {
  const current = getRecords();
  setRecords(current.filter((r) => r.id !== id));
}

/**
 * Returns the deduplicated exercise names used across the history, most
 * recent first. Powers the autocomplete in the Save form and any future
 * "frequently used" surface. Delegates the actual dedupe to the pure
 * helper so the storage layer stays a thin IO wrapper.
 */
export function getUniqueExercises(): string[] {
  return dedupeExercises(getRecords());
}

/**
 * Returns the most recent **labeled** records (i.e. records with a non-null
 * `exercise`) from a raw JSON string, sorted by `createdAt` descending.
 * Auto-logged records are excluded because the mini-panel is meant to
 * surface records the coach named intentionally, not the passive
 * telemetry log.
 *
 * Parses from a raw string (instead of reading localStorage) so callers
 * holding the raw value (e.g. via `useSyncExternalStore`) can memoize on
 * it cleanly.
 */
export function getRecentRecordsFromRaw(
  raw: string,
  limit = 5,
): SavedWeightRecord[] {
  return parseRecordsFromRaw(raw)
    .filter((r) => r.exercise !== null)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, limit);
}

/**
 * Returns the most recent **labeled** records (i.e. records with a non-null
 * `exercise`) sorted by `createdAt` descending. Auto-logged records are
 * excluded because the mini-panel is meant to surface records the coach
 * named intentionally, not the passive telemetry log.
 */
export function getRecentRecords(limit = 5): SavedWeightRecord[] {
  return getRecentRecordsFromRaw(
    localStorage.getItem(RECORDS_KEY) ?? "",
    limit,
  );
}

