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

/**
 * Returns `true` when the thrown error indicates the browser's localStorage
 * quota was exceeded. Centralized here so that every persistence call site
 * (save form, foto accept, history delete) can distinguish a quota error
 * (actionable: "borrar registros antiguos") from a generic IO error
 * ("intenta de nuevo"). Both `QuotaExceededError` (Chromium / Firefox) and
 * `NS_ERROR_DOM_QUOTA_REACHED` (older Firefox) are accepted.
 */
export function isQuotaError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return (
      err.name === "QuotaExceededError" ||
      err.name === "NS_ERROR_DOM_QUOTA_REACHED"
    );
  }
  return false;
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

/**
 * Returns the raw JSON string stored under `pd:sessions`, or `""` if the
 * key is missing or the read fails. Exposed for `useSyncExternalStore`
 * consumers that want the raw string as their snapshot (see AGENTS.md
 * storage-reactivo pattern).
 */
export function getSessionsRaw(): string {
  try {
    migrateIfNeeded();
    return localStorage.getItem(SESSIONS_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Parses a raw JSON string into a list of saved sessions. Defensive on the
 * read path: corrupt or non-array data returns `[]`. Mirrors
 * `parseRecordsFromRaw` for the calculator-records side.
 *
 * No Zod validation here (SavedSession does not have a Zod schema defined
 * yet — the `structured` field is loose `CrossFitPlan | null` and the
 * consumer pages already tolerate a missing or partial `structured`).
 * If the JSON shape ever needs to harden, add a `SavedSessionSchema`
 * and validate per entry.
 */
export function parseSessionsFromRaw(raw: string): SavedSession[] {
  try {
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn(
        "[pd:sessions] expected array, discarding:",
        typeof parsed,
      );
      return [];
    }
    return parsed as SavedSession[];
  } catch (err) {
    console.warn("[pd:sessions] failed to parse:", err);
    return [];
  }
}

/**
 * Returns the most recent sessions parsed from a raw JSON string, newest
 * first. Auto-logged entries are not relevant for sessions (sessions are
 * always explicitly created) so no source filter applies.
 *
 * Accepts the raw string (instead of reading localStorage) so callers
 * using `useSyncExternalStore` can memoize on the raw value cleanly
 * without round-tripping through `localStorage.getItem`.
 */
export function getRecentSessionsFromRaw(
  raw: string,
  limit = 5,
): SavedSession[] {
  return parseSessionsFromRaw(raw)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, limit);
}

/**
 * Subscribe to changes in `pd:sessions`. Triggers on both same-tab writes
 * (via the synthetic `storage` event dispatched by `dispatchStorage`) and
 * cross-tab writes (via the native `storage` event).
 *
 * Use with `useSyncExternalStore` so the consumer re-reads the raw
 * snapshot on every change, including after `addSession` / `updateSession`
 * / `removeSession` from the same tab.
 */
export function subscribeToSessions(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === SESSIONS_KEY) callback();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
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
 * Appends a record to the history. Records are kept in insertion order
 * (oldest first); the read path sorts by `createdAt` as needed.
 *
 * Note: the `auto-log` source variant is no longer produced by the
 * calculator (it was a passive watcher that created more noise than
 * value — see 0017 post-mortem). The variant remains in the
 * `RecordSource` type for backward compat with `localStorage` entries
 * written by older builds; stale records are silently dropped on the
 * next read by the Zod schema's `enum` check.
 */
export function addRecord(record: SavedWeightRecord): void {
  const current = getRecords();
  setRecords([...current, record]);
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

// ─── Per-modality last input (form draft autosave) ──────────────────────────

const LAST_INPUT_PREFIX = "pd:last-input-";

/**
 * Shape of the persisted form draft. Mirrors `CrossFitSessionInput` but
 * accepts `"Aleatorio"` as a valid `wodFormat` because that's an option the
 * form exposes to the coach (the system resolves it to a concrete format
 * before calling the LLM, so it never reaches `crossfit-schemas.ts`).
 *
 * Optional fields are persisted as `undefined` (omitted from the JSON)
 * rather than empty strings — this matches the Zod schema's `.optional()`
 * and keeps the read path defensive.
 */
export type PersistedLastInput = {
  durationMinutes: "45" | "60" | "75" | "90";
  strengthSkill: string;
  wodFormat:
    | "AMRAP"
    | "EMOM"
    | "For Time"
    | "Tabata"
    | "Intervalos"
    | "Aleatorio";
  focusMovement?: string;
  considerations?: string;
};

function lastInputKey(modalityId: string): string {
  return `${LAST_INPUT_PREFIX}${modalityId}`;
}

/**
 * Returns the persisted form draft for the given modality, or `null` if no
 * draft has been saved yet (or the persisted JSON is corrupt). The optional
 * fields (`focusMovement`, `considerations`) are read back as `undefined`
 * when omitted, matching how they were written.
 */
export function getLastInput(modalityId: string): PersistedLastInput | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(lastInputKey(modalityId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedLastInput;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.strengthSkill !== "string"
    ) {
      console.warn(
        `[pd:last-input-${modalityId}] corrupt data, discarding:`,
        parsed,
      );
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn(`[pd:last-input-${modalityId}] failed to parse:`, err);
    return null;
  }
}

/**
 * Persists the form draft for the given modality. Empties are normalised
 * to `undefined` before write (the schema treats them as optional). Uses
 * `dispatchStorage` so same-tab consumers re-read the snapshot.
 *
 * Quota errors are logged and swallowed (consistent with the calculator
 * autosave path) — the coach keeps working in-memory and we surface the
 * failure through the same "Almacenamiento lleno" toast when triggered
 * from a user action. The autosave path itself stays silent.
 */
export function setLastInput(
  modalityId: string,
  input: PersistedLastInput,
): void {
  if (typeof window === "undefined") return;
  try {
    const normalised: PersistedLastInput = {
      durationMinutes: input.durationMinutes,
      strengthSkill: input.strengthSkill,
      wodFormat: input.wodFormat,
      ...(input.focusMovement && input.focusMovement.trim() !== ""
        ? { focusMovement: input.focusMovement }
        : {}),
      ...(input.considerations && input.considerations.trim() !== ""
        ? { considerations: input.considerations }
        : {}),
    };
    const json = JSON.stringify(normalised);
    localStorage.setItem(lastInputKey(modalityId), json);
    dispatchStorage(lastInputKey(modalityId), json);
  } catch (err) {
    if (isQuotaError(err)) {
      console.warn(
        `[pd:last-input-${modalityId}] quota exceeded, draft not persisted`,
      );
    } else {
      console.warn(
        `[pd:last-input-${modalityId}] failed to persist:`,
        err,
      );
    }
  }
}

/**
 * Returns the raw JSON string stored under `pd:last-input-{modalityId}`,
 * or `""` if the key is missing. Exposed for `useSyncExternalStore`
 * consumers that want the raw string as their snapshot (see AGENTS.md
 * storage-reactivo pattern).
 */
export function getLastInputRaw(modalityId: string): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(lastInputKey(modalityId)) ?? "";
  } catch {
    return "";
  }
}

/**
 * Subscribe to changes in `pd:last-input-{modalityId}`. The synthetic
 * `storage` event from same-tab writes is filtered by key, so consumers
 * only re-render when *their* modality's draft changes.
 */
export function subscribeToLastInput(
  modalityId: string,
  callback: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const key = lastInputKey(modalityId);
  const handler = (e: StorageEvent) => {
    if (e.key === key) callback();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/**
 * Reads every `pd:last-input-*` key from localStorage and returns them as
 * a `{ [modalityId]: PersistedLastInput }` map. Corrupt entries are
 * dropped silently (consistent with the rest of the read path).
 *
 * Powers the backup export on `/settings`. Cross-tab safe: reads whatever
 * is in the localStorage snapshot at call time.
 */
export function getAllLastInputs(): Record<string, PersistedLastInput> {
  if (typeof window === "undefined") return {};
  const result: Record<string, PersistedLastInput> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(LAST_INPUT_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as PersistedLastInput;
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          typeof parsed.strengthSkill === "string"
        ) {
          const modalityId = key.slice(LAST_INPUT_PREFIX.length);
          result[modalityId] = parsed;
        }
      } catch {
        // Skip corrupt entry
      }
    }
  } catch (err) {
    console.warn("[pd:last-input-*] failed to enumerate:", err);
  }
  return result;
}

// ─── Backup / restore / clear-all (settings page) ────────────────────────────

/**
 * Current backup format version. Bump this when the shape changes in a
 * way that older imports can't be safely upgraded automatically. Forward
 * compatibility (importing a backup with a higher `version`) is allowed
 * with a warning toast — backward compatibility is the responsibility of
 * the importer to handle missing fields.
 */
export const BACKUP_VERSION = 1;

export type BackupShape = {
  exportedAt: string;
  version: number;
  data: {
    sessions: SavedSession[];
    calculatorState: CalculatorState;
    calculatorRecords: SavedWeightRecord[];
    lastInputs: Record<string, PersistedLastInput>;
  };
};

/**
 * Aggregates every persisted `pd:*` key into a single backup object ready
 * to be JSON-serialised. Read-only — does not mutate storage.
 */
export function exportAllData(): BackupShape {
  return {
    exportedAt: new Date().toISOString(),
    version: BACKUP_VERSION,
    data: {
      sessions: getSessions(),
      calculatorState: getCalculatorState(),
      calculatorRecords: getRecords(),
      lastInputs: getAllLastInputs(),
    },
  };
}

export type ImportResult = {
  ok: boolean;
  imported: string[];
  errors: string[];
};

/**
 * Writes every key from a backup into localStorage. Returns a structured
 * result so the UI can surface partial failures (some keys imported, some
 * not) instead of just "ok / not ok".
 *
 * Quota errors are caught and reported per-key. Other IO errors are also
 * captured. The function never throws — the caller decides how to react.
 */
export function importAllData(shape: BackupShape): ImportResult {
  const imported: string[] = [];
  const errors: string[] = [];

  // Sessions
  try {
    setSessions(shape.data.sessions);
    imported.push("sessions");
  } catch (err) {
    errors.push(
      isQuotaError(err)
        ? "sessions: almacenamiento lleno"
        : `sessions: ${err instanceof Error ? err.message : "error"}`,
    );
  }

  // Calculator state
  try {
    setCalculatorState(shape.data.calculatorState);
    imported.push("calculatorState");
  } catch (err) {
    errors.push(
      isQuotaError(err)
        ? "calculatorState: almacenamiento lleno"
        : `calculatorState: ${err instanceof Error ? err.message : "error"}`,
    );
  }

  // Calculator records
  try {
    setRecordsRaw(shape.data.calculatorRecords);
    imported.push("calculatorRecords");
  } catch (err) {
    errors.push(
      isQuotaError(err)
        ? "calculatorRecords: almacenamiento lleno"
        : `calculatorRecords: ${err instanceof Error ? err.message : "error"}`,
    );
  }

  // Last inputs (per modality)
  for (const [modalityId, input] of Object.entries(shape.data.lastInputs)) {
    try {
      setLastInput(modalityId, input);
      imported.push(`lastInput:${modalityId}`);
    } catch (err) {
      errors.push(
        isQuotaError(err)
          ? `lastInput:${modalityId}: almacenamiento lleno`
          : `lastInput:${modalityId}: ${err instanceof Error ? err.message : "error"}`,
      );
    }
  }

  return { ok: errors.length === 0, imported, errors };
}

/**
 * Internal write helper for `importAllData`. Sets the records key directly
 * with a synthetic `storage` event so same-tab consumers refresh.
 */
function setRecordsRaw(records: SavedWeightRecord[]): void {
  const json = JSON.stringify(records);
  localStorage.setItem(RECORDS_KEY, json);
  dispatchStorage(RECORDS_KEY, json);
}

/**
 * Removes every `pd:*` key from localStorage. Fires a synthetic `storage`
 * event for each removed key so same-tab consumers re-read their snapshot
 * (e.g. `/classes` banner disappears, `/sessions` shows empty state).
 *
 * Use only after the user has confirmed intent. The `/settings` page wraps
 * this with a double `window.confirm`.
 */
export function clearAllData(): void {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith("pd:")) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
      // Dispatch with empty value — the StorageEvent convention for "deleted"
      dispatchStorage(key, "");
    }
  } catch (err) {
    console.warn("[pd:*] failed to clear:", err);
  }
}

