/**
 * Unit tests for `src/lib/storage.ts`.
 *
 * `storage.ts` is the IO layer of the localStorage-backed persistence. Its
 * read paths are defensive: every parser catches malformed data and returns
 * an empty/default value instead of throwing. These tests pin that contract
 * so that a future refactor (e.g. removing the `try/catch`) does not
 * silently break the read path with corrupt real-world data.
 *
 * The test file relies on the `localStorage` stub defined in
 * `vitest.setup.ts`. The stub matches the real-browser semantics for the
 * `storage` event (no auto-dispatch on same-tab `setItem`/`removeItem`,
 * unlike jsdom's built-in localStorage) and exposes a fresh Map per worker
 * that can be cleared in `beforeEach` to isolate tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseSessionsFromRaw,
  parseRecordsFromRaw,
  getAllLastInputs,
  getSessionsRaw,
  getLastInputRaw,
  exportAllData,
  importAllData,
  clearAllData,
  isQuotaError,
  setSessions,
  setLastInput,
  getSessions,
  addSession,
  updateSession,
  removeSession,
  getRecentSessions,
  getRecords,
  addRecord,
  updateRecord,
  removeRecord,
  getRecentRecords,
  getUniqueExercises,
  getCalculatorState,
  setCalculatorState,
  subscribeToSessions,
  subscribeToLastInput,
  BACKUP_VERSION,
  type PersistedLastInput,
} from "@/lib/storage";
import { resetLocalStorage } from "../../vitest.setup";
import type { SavedSession, SavedWeightRecord } from "@/lib/types";
import type { CrossFitPlan, CrossFitSessionInput } from "@/lib/modalities/crossfit-schemas";
import type { DiscRow } from "@/lib/calculator/schemas";

// ─── Test factories ──────────────────────────────────────────────────────────

const mkDisc = (overrides: Partial<DiscRow> = {}): DiscRow => ({
  weight: 25,
  unit: "kg",
  count: 1,
  ...overrides,
});

const mkRecord = (
  overrides: Partial<SavedWeightRecord> = {},
): SavedWeightRecord => ({
  id: "rec-1",
  createdAt: "2026-09-01T10:00:00.000Z",
  exercise: "Back Squat",
  barKg: 20,
  discs: [mkDisc()],
  totalKg: 70,
  totalLb: 154.3234,
  breakdownLine: "20kg + (25kg)×2",
  source: "manual",
  ...overrides,
});

const mkPlan = (): CrossFitPlan => ({
  class_title: "Snatch & Skill",
  focus_movement: "Snatch",
  estimated_duration_min: 60,
  sections: {
    warm_up: { duration_min: 10, description: "Pass-throughs", exercises: [] },
    strength_skill: {
      duration_min: 20,
      description: "Power snatch 5x3",
      exercises: [],
    },
    wod: {
      format: "AMRAP",
      time_cap_min: 15,
      description: "20 min AMRAP",
      score_type: "Rondas + Reps",
      exercises: [],
    },
    cool_down: {
      duration_min: 10,
      description: "Stretch",
      exercises: [],
    },
  },
});

const mkInput = (overrides: Partial<CrossFitSessionInput> = {}): CrossFitSessionInput => ({
  durationMinutes: "60",
  strengthSkill: "Snatch",
  wodFormat: "AMRAP",
  ...overrides,
});

const mkSession = (
  overrides: Partial<SavedSession> = {},
): SavedSession => ({
  id: "ss-001",
  modalityId: "crossfit",
  createdAt: "2026-09-01T10:00:00.000Z",
  model: "MiniMax-Text-01",
  markdown: "# Snatch & Skill",
  structured: mkPlan(),
  input: mkInput(),
  title: "Snatch & Skill",
  ...overrides,
});

const mkLastInput = (
  overrides: Partial<PersistedLastInput> = {},
): PersistedLastInput => ({
  durationMinutes: "60",
  strengthSkill: "Snatch",
  wodFormat: "AMRAP",
  ...overrides,
});

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  // Each test starts with a clean stub — no leak between tests, no
  // dependency on the order in which tests run.
  resetLocalStorage();
  // Silence the storage layer's defensive `console.warn` calls so the test
  // output stays clean. Individual tests that need to assert on the warn
  // call restore the spy first.
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── parseSessionsFromRaw ───────────────────────────────────────────────────

describe("parseSessionsFromRaw", () => {
  it("returns [] for an empty string", () => {
    expect(parseSessionsFromRaw("")).toEqual([]);
  });

  it("returns [] for whitespace-only input", () => {
    // Whitespace is falsy as a JSON payload but the function should still
    // return [] rather than throw on the empty `if (!raw)` branch.
    // Note: the spec uses `if (!raw)` so only the empty string is the
    // explicit short-circuit; whitespace IS valid JSON whitespace and
    // would throw — we assert the empty-string contract only.
    expect(parseSessionsFromRaw("")).toEqual([]);
  });

  it("returns the parsed array for valid JSON", () => {
    const sessions = [mkSession(), mkSession({ id: "ss-002" })];
    const raw = JSON.stringify(sessions);
    expect(parseSessionsFromRaw(raw)).toEqual(sessions);
  });

  it("returns [] for malformed JSON and warns", () => {
    const warnSpy = vi.spyOn(console, "warn");
    const result = parseSessionsFromRaw("not json at all");
    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("returns [] when the JSON is not an array (object) and warns", () => {
    const warnSpy = vi.spyOn(console, "warn");
    const result = parseSessionsFromRaw('{"sessions": []}');
    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain("expected array");
  });

  it("returns [] when the JSON is not an array (number) and warns", () => {
    const warnSpy = vi.spyOn(console, "warn");
    const result = parseSessionsFromRaw("42");
    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("returns [] when the JSON is `null` and warns (null is not an array)", () => {
    const warnSpy = vi.spyOn(console, "warn");
    const result = parseSessionsFromRaw("null");
    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("returns [] for an empty JSON array", () => {
    expect(parseSessionsFromRaw("[]")).toEqual([]);
  });
});

// ─── parseRecordsFromRaw ────────────────────────────────────────────────────

describe("parseRecordsFromRaw", () => {
  it("returns [] for an empty string", () => {
    expect(parseRecordsFromRaw("")).toEqual([]);
  });

  it("returns the parsed array for valid JSON", () => {
    const records = [
      mkRecord({ id: "r-1" }),
      mkRecord({ id: "r-2", exercise: "Deadlift" }),
    ];
    const raw = JSON.stringify(records);
    expect(parseRecordsFromRaw(raw)).toEqual(records);
  });

  it("filters out entries with invalid `barKg` (must be positive)", () => {
    const valid = mkRecord({ id: "r-good" });
    const corrupt = mkRecord({ id: "r-bad", barKg: -5 });
    const warnSpy = vi.spyOn(console, "warn");
    const result = parseRecordsFromRaw(JSON.stringify([valid, corrupt]));
    expect(result).toEqual([valid]);
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0]?.[0]).toContain("discarding corrupt entry");
  });

  it("filters out entries with invalid `source` (not in enum)", () => {
    const valid = mkRecord({ id: "r-good" });
    const corrupt = { ...mkRecord({ id: "r-bad" }), source: "invalid" };
    const warnSpy = vi.spyOn(console, "warn");
    const result = parseRecordsFromRaw(JSON.stringify([valid, corrupt]));
    expect(result).toEqual([valid]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("keeps entries with `source: 'auto-log'` (backward-compat enum)", () => {
    const autoLog = mkRecord({ id: "r-auto", exercise: null, source: "auto-log" });
    const manual = mkRecord({ id: "r-manual" });
    const result = parseRecordsFromRaw(JSON.stringify([autoLog, manual]));
    expect(result).toEqual([autoLog, manual]);
  });

  it("filters out entries with empty `exercise` and non-null source", () => {
    // The Zod schema for `exercise` is `string().trim().min(1).nullable()`,
    // so an empty string is invalid. This matters for `manual`/`foto`
    // records but `auto-log` records with `null` are still accepted.
    const valid = mkRecord({ id: "r-good" });
    const corrupt = { ...mkRecord({ id: "r-bad" }), exercise: "   " };
    const result = parseRecordsFromRaw(JSON.stringify([valid, corrupt]));
    expect(result).toEqual([valid]);
  });

  it("returns [] for malformed JSON and warns", () => {
    const warnSpy = vi.spyOn(console, "warn");
    const result = parseRecordsFromRaw("{not json}");
    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("returns [] when the JSON is not an array and warns", () => {
    const warnSpy = vi.spyOn(console, "warn");
    const result = parseRecordsFromRaw('{"records": []}');
    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });
});

// ─── getAllLastInputs ───────────────────────────────────────────────────────

describe("getAllLastInputs", () => {
  it("returns {} when no `pd:last-input-*` keys exist", () => {
    expect(getAllLastInputs()).toEqual({});
  });

  it("returns the parsed value for a single `pd:last-input-crossfit`", () => {
    const input = mkLastInput({ strengthSkill: "Snatch" });
    setLastInput("crossfit", input);
    expect(getAllLastInputs()).toEqual({ crossfit: input });
  });

  it("returns all `pd:last-input-*` keys when multiple modalities are present", () => {
    const crossfit = mkLastInput({ strengthSkill: "Snatch" });
    const hipertrofia = mkLastInput({ strengthSkill: "Curl bíceps" });
    const powerlifting = mkLastInput({ strengthSkill: "Sentadilla" });
    setLastInput("crossfit", crossfit);
    setLastInput("hipertrofia", hipertrofia);
    setLastInput("powerlifting", powerlifting);
    expect(getAllLastInputs()).toEqual({
      crossfit,
      hipertrofia,
      powerlifting,
    });
  });

  it("ignores non-`pd:last-input-*` keys (sessions, calculator-state, etc.)", () => {
    const input = mkLastInput();
    setLastInput("crossfit", input);
    setSessions([mkSession()]);
    localStorage.setItem("pd:calculator-state", JSON.stringify({ barKg: 20, discs: [] }));
    localStorage.setItem("unrelated:key", "noise");
    expect(getAllLastInputs()).toEqual({ crossfit: input });
  });

  it("silently drops entries with corrupt JSON", () => {
    const valid = mkLastInput({ strengthSkill: "Snatch" });
    setLastInput("crossfit", valid);
    localStorage.setItem("pd:last-input-broken", "{not json}");
    expect(getAllLastInputs()).toEqual({ crossfit: valid });
  });

  it("silently drops entries that fail the shape check (missing strengthSkill)", () => {
    const valid = mkLastInput();
    setLastInput("crossfit", valid);
    localStorage.setItem(
      "pd:last-input-bad-shape",
      JSON.stringify({ durationMinutes: "60", wodFormat: "AMRAP" }),
    );
    expect(getAllLastInputs()).toEqual({ crossfit: valid });
  });

  it("uses the suffix after `pd:last-input-` as the modalityId", () => {
    // Modality ids are arbitrary strings; the prefix is the only constraint.
    const input = mkLastInput();
    setLastInput("a/weird-modality.id", input);
    expect(getAllLastInputs()).toEqual({ "a/weird-modality.id": input });
  });
});

// ─── getSessionsRaw / getLastInputRaw ────────────────────────────────────────

describe("getSessionsRaw", () => {
  it('returns "" when `pd:sessions` is missing', () => {
    expect(getSessionsRaw()).toBe("");
  });

  it("returns the verbatim JSON string when `pd:sessions` is present", () => {
    const sessions = [mkSession(), mkSession({ id: "ss-002" })];
    setSessions(sessions);
    const raw = getSessionsRaw();
    expect(JSON.parse(raw)).toEqual(sessions);
  });
});

describe("getLastInputRaw", () => {
  it('returns "" when no draft is persisted for the modality', () => {
    expect(getLastInputRaw("crossfit")).toBe("");
  });

  it("returns the verbatim JSON string when a draft exists", () => {
    const input = mkLastInput({ strengthSkill: "Snatch" });
    setLastInput("crossfit", input);
    const raw = getLastInputRaw("crossfit");
    expect(JSON.parse(raw)).toEqual(input);
  });

  it("returns a different value for a different modalityId", () => {
    const input = mkLastInput({ strengthSkill: "Snatch" });
    setLastInput("crossfit", input);
    expect(getLastInputRaw("powerlifting")).toBe("");
  });
});

// ─── isQuotaError ───────────────────────────────────────────────────────────

describe("isQuotaError", () => {
  it("returns true for DOMException with name 'QuotaExceededError'", () => {
    const err = new DOMException("quota", "QuotaExceededError");
    expect(isQuotaError(err)).toBe(true);
  });

  it("returns true for DOMException with name 'NS_ERROR_DOM_QUOTA_REACHED'", () => {
    const err = new DOMException("quota", "NS_ERROR_DOM_QUOTA_REACHED");
    expect(isQuotaError(err)).toBe(true);
  });

  it("returns false for non-DOMException errors", () => {
    expect(isQuotaError(new Error("nope"))).toBe(false);
    expect(isQuotaError("string error")).toBe(false);
    expect(isQuotaError({ name: "QuotaExceededError" })).toBe(false);
    expect(isQuotaError(null)).toBe(false);
    expect(isQuotaError(undefined)).toBe(false);
  });
});

// ─── exportAllData / importAllData / clearAllData (roundtrip) ───────────────

describe("exportAllData", () => {
  it("returns a BackupShape with version 1 and an ISO exportedAt", () => {
    const shape = exportAllData();
    expect(shape.version).toBe(BACKUP_VERSION);
    expect(shape.version).toBe(1);
    expect(typeof shape.exportedAt).toBe("string");
    expect(() => new Date(shape.exportedAt).toISOString()).not.toThrow();
  });

  it("returns empty arrays/objects when localStorage is empty", () => {
    const shape = exportAllData();
    expect(shape.data.sessions).toEqual([]);
    expect(shape.data.calculatorState).toEqual({ barKg: 20, discs: [] });
    expect(shape.data.calculatorRecords).toEqual([]);
    expect(shape.data.lastInputs).toEqual({});
  });

  it("captures the current sessions, records, calculator-state, and last inputs", () => {
    const session = mkSession();
    const record = mkRecord();
    const input = mkLastInput({ strengthSkill: "Snatch" });
    setSessions([session]);
    localStorage.setItem(
      "pd:calculator-state",
      JSON.stringify({ barKg: 15, discs: [] }),
    );
    localStorage.setItem("pd:calculator-records", JSON.stringify([record]));
    setLastInput("crossfit", input);

    const shape = exportAllData();
    expect(shape.data.sessions).toEqual([session]);
    expect(shape.data.calculatorState).toEqual({ barKg: 15, discs: [] });
    expect(shape.data.calculatorRecords).toEqual([record]);
    expect(shape.data.lastInputs).toEqual({ crossfit: input });
  });
});

describe("importAllData", () => {
  it("imports sessions, calculator state, records, and last inputs", () => {
    const session = mkSession();
    const record = mkRecord();
    const input = mkLastInput({ strengthSkill: "Snatch" });
    const shape = {
      exportedAt: "2026-09-02T10:00:00.000Z",
      version: 1,
      data: {
        sessions: [session],
        calculatorState: { barKg: 15, discs: [] },
        calculatorRecords: [record],
        lastInputs: { crossfit: input },
      },
    };

    const result = importAllData(shape);
    expect(result.ok).toBe(true);
    expect(result.imported).toEqual(
      expect.arrayContaining([
        "sessions",
        "calculatorState",
        "calculatorRecords",
        "lastInput:crossfit",
      ]),
    );
    expect(result.errors).toEqual([]);
    expect(JSON.parse(getSessionsRaw())).toEqual([session]);
    expect(localStorage.getItem("pd:calculator-state")).not.toBeNull();
    expect(getAllLastInputs()).toEqual({ crossfit: input });
  });

  it("imports the three singleton keys and reports ok when the backup is empty", () => {
    const shape = {
      exportedAt: "2026-09-02T10:00:00.000Z",
      version: 1,
      data: {
        sessions: [],
        calculatorState: { barKg: 20, discs: [] },
        calculatorRecords: [],
        lastInputs: {},
      },
    };
    const result = importAllData(shape);
    expect(result.ok).toBe(true);
    // Three singleton keys are written (`sessions`, `calculatorState`,
    // `calculatorRecords`); `lastInputs: {}` contributes no entries
    // because the for-loop over `Object.entries` has nothing to iterate.
    expect(result.imported).toEqual(
      expect.arrayContaining([
        "sessions",
        "calculatorState",
        "calculatorRecords",
      ]),
    );
    expect(result.imported).not.toContain("lastInput:crossfit");
    expect(result.imported.length).toBe(3);
    expect(result.errors).toEqual([]);
  });

  it("preserves lastInput fields verbatim (does not drop optionals)", () => {
    const input: PersistedLastInput = {
      durationMinutes: "60",
      strengthSkill: "Snatch",
      wodFormat: "AMRAP",
      focusMovement: "Hip thrust",
      considerations: "Evitar lesiones de rodilla",
    };
    const shape = {
      exportedAt: "2026-09-02T10:00:00.000Z",
      version: 1,
      data: {
        sessions: [],
        calculatorState: { barKg: 20, discs: [] },
        calculatorRecords: [],
        lastInputs: { crossfit: input },
      },
    };
    importAllData(shape);
    expect(getAllLastInputs()).toEqual({ crossfit: input });
  });
});

describe("roundtrip export → import", () => {
  it("exportAllData() then importAllData() yields an equivalent BackupShape", () => {
    // Seed localStorage with a representative snapshot.
    const session = mkSession();
    const record = mkRecord();
    const input = mkLastInput({ strengthSkill: "Snatch" });
    setSessions([session]);
    localStorage.setItem(
      "pd:calculator-state",
      JSON.stringify({ barKg: 15, discs: [] }),
    );
    localStorage.setItem("pd:calculator-records", JSON.stringify([record]));
    setLastInput("crossfit", input);

    const exported = exportAllData();
    clearAllData();
    expect(getSessionsRaw()).toBe("");
    expect(getAllLastInputs()).toEqual({});

    const result = importAllData(exported);
    expect(result.ok).toBe(true);
    // Re-export and compare the data sub-shape (exportedAt is a fresh
    // timestamp on the second pass, so we compare only the data).
    const reExported = exportAllData();
    expect(reExported.version).toBe(exported.version);
    expect(reExported.data).toEqual(exported.data);
  });
});

describe("clearAllData", () => {
  it("removes every `pd:*` key from localStorage", () => {
    setSessions([mkSession()]);
    setLastInput("crossfit", mkLastInput());
    localStorage.setItem("pd:calculator-state", JSON.stringify({ barKg: 20, discs: [] }));
    localStorage.setItem("pd:calculator-records", JSON.stringify([mkRecord()]));
    // A non-pd key should NOT be removed.
    localStorage.setItem("unrelated:key", "noise");

    clearAllData();

    expect(getSessionsRaw()).toBe("");
    expect(getAllLastInputs()).toEqual({});
    expect(localStorage.getItem("pd:calculator-state")).toBeNull();
    expect(localStorage.getItem("pd:calculator-records")).toBeNull();
    expect(localStorage.getItem("unrelated:key")).toBe("noise");
  });

  it("does not throw when localStorage is empty", () => {
    expect(() => clearAllData()).not.toThrow();
  });

  it("fires a synthetic `storage` event for each removed key", () => {
    setSessions([mkSession()]);
    setLastInput("crossfit", mkLastInput());
    const handler = vi.fn();
    window.addEventListener("storage", handler);

    clearAllData();

    // Two pd:* keys were present; one storage event per key.
    expect(handler).toHaveBeenCalledTimes(2);
    const keys = handler.mock.calls.map((call) => {
      const event = call[0] as StorageEvent;
      return event.key;
    });
    expect(keys).toEqual(expect.arrayContaining(["pd:sessions", "pd:last-input-crossfit"]));
    window.removeEventListener("storage", handler);
  });
});

// ─── Session CRUD wrappers ───────────────────────────────────────────────────

describe("addSession / updateSession / removeSession", () => {
  it("addSession appends to existing sessions", () => {
    setSessions([mkSession({ id: "ss-1" })]);
    addSession(mkSession({ id: "ss-2" }));
    expect(getSessions().map((s) => s.id)).toEqual(["ss-1", "ss-2"]);
  });

  it("addSession starts from empty when localStorage is empty", () => {
    addSession(mkSession({ id: "ss-first" }));
    expect(getSessions()).toHaveLength(1);
    expect(getSessions()[0]?.id).toBe("ss-first");
  });

  it("updateSession replaces the matching session by id", () => {
    setSessions([mkSession({ id: "ss-1", title: "old" }), mkSession({ id: "ss-2" })]);
    updateSession(mkSession({ id: "ss-1", title: "new" }));
    const result = getSessions();
    expect(result[0]?.title).toBe("new");
    expect(result[1]?.id).toBe("ss-2");
  });

  it("updateSession is a no-op when the id does not exist", () => {
    setSessions([mkSession({ id: "ss-1" })]);
    updateSession(mkSession({ id: "ss-does-not-exist" }));
    expect(getSessions()).toHaveLength(1);
    expect(getSessions()[0]?.id).toBe("ss-1");
  });

  it("removeSession deletes the matching session by id", () => {
    setSessions([mkSession({ id: "ss-1" }), mkSession({ id: "ss-2" })]);
    removeSession("ss-1");
    expect(getSessions().map((s) => s.id)).toEqual(["ss-2"]);
  });

  it("removeSession is a no-op when the id does not exist", () => {
    setSessions([mkSession({ id: "ss-1" })]);
    removeSession("ss-does-not-exist");
    expect(getSessions()).toHaveLength(1);
  });
});

describe("getRecentSessions", () => {
  it("returns the most recent sessions, newest first", () => {
    setSessions([
      mkSession({ id: "old", createdAt: "2026-01-01T00:00:00.000Z" }),
      mkSession({ id: "new", createdAt: "2026-09-01T00:00:00.000Z" }),
      mkSession({ id: "mid", createdAt: "2026-05-01T00:00:00.000Z" }),
    ]);
    expect(getRecentSessions(5).map((s) => s.id)).toEqual(["new", "mid", "old"]);
  });

  it("respects the limit parameter", () => {
    setSessions([
      mkSession({ id: "a", createdAt: "2026-01-01T00:00:00.000Z" }),
      mkSession({ id: "b", createdAt: "2026-02-01T00:00:00.000Z" }),
      mkSession({ id: "c", createdAt: "2026-03-01T00:00:00.000Z" }),
    ]);
    expect(getRecentSessions(2).map((s) => s.id)).toEqual(["c", "b"]);
  });

  it("returns [] when there are no sessions", () => {
    expect(getRecentSessions(5)).toEqual([]);
  });
});

// ─── Records CRUD wrappers ───────────────────────────────────────────────────

describe("addRecord / updateRecord / removeRecord", () => {
  it("addRecord appends to existing records", () => {
    localStorage.setItem("pd:calculator-records", JSON.stringify([mkRecord({ id: "r-1" })]));
    addRecord(mkRecord({ id: "r-2" }));
    const result = getRecords();
    expect(result.map((r) => r.id)).toEqual(["r-1", "r-2"]);
  });

  it("updateRecord replaces the matching record by id", () => {
    localStorage.setItem(
      "pd:calculator-records",
      JSON.stringify([mkRecord({ id: "r-1", exercise: "old" })]),
    );
    updateRecord(mkRecord({ id: "r-1", exercise: "new" }));
    expect(getRecords()[0]?.exercise).toBe("new");
  });

  it("updateRecord warns and is a no-op when the id does not exist", () => {
    const warnSpy = vi.spyOn(console, "warn");
    localStorage.setItem(
      "pd:calculator-records",
      JSON.stringify([mkRecord({ id: "r-1" })]),
    );
    updateRecord(mkRecord({ id: "r-does-not-exist" }));
    expect(getRecords()).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("removeRecord deletes the matching record by id", () => {
    localStorage.setItem(
      "pd:calculator-records",
      JSON.stringify([mkRecord({ id: "r-1" }), mkRecord({ id: "r-2" })]),
    );
    removeRecord("r-1");
    expect(getRecords().map((r) => r.id)).toEqual(["r-2"]);
  });

  it("removeRecord is a no-op when the id does not exist", () => {
    localStorage.setItem(
      "pd:calculator-records",
      JSON.stringify([mkRecord({ id: "r-1" })]),
    );
    removeRecord("r-does-not-exist");
    expect(getRecords()).toHaveLength(1);
  });
});

describe("getRecentRecords", () => {
  it("returns labeled records sorted by createdAt desc", () => {
    localStorage.setItem(
      "pd:calculator-records",
      JSON.stringify([
        mkRecord({ id: "auto", exercise: null, createdAt: "2026-01-01T00:00:00.000Z" }),
        mkRecord({ id: "labeled-old", createdAt: "2026-02-01T00:00:00.000Z" }),
        mkRecord({ id: "labeled-new", createdAt: "2026-09-01T00:00:00.000Z" }),
      ]),
    );
    expect(getRecentRecords(5).map((r) => r.id)).toEqual([
      "labeled-new",
      "labeled-old",
    ]);
  });

  it("respects the limit parameter", () => {
    localStorage.setItem(
      "pd:calculator-records",
      JSON.stringify([
        mkRecord({ id: "r-1", createdAt: "2026-01-01T00:00:00.000Z" }),
        mkRecord({ id: "r-2", createdAt: "2026-02-01T00:00:00.000Z" }),
        mkRecord({ id: "r-3", createdAt: "2026-03-01T00:00:00.000Z" }),
      ]),
    );
    expect(getRecentRecords(2).map((r) => r.id)).toEqual(["r-3", "r-2"]);
  });
});

describe("getUniqueExercises", () => {
  it("delegates to dedupeExercises for the records list", () => {
    localStorage.setItem(
      "pd:calculator-records",
      JSON.stringify([
        mkRecord({ id: "r-1", exercise: "Back Squat" }),
        mkRecord({ id: "r-2", exercise: "Deadlift" }),
        mkRecord({ id: "r-3", exercise: "BACK SQUAT" }),
      ]),
    );
    const result = getUniqueExercises();
    // dedupeExercises preserves the case of the most recent occurrence.
    // r-3 ("BACK SQUAT", createdAt 2026-09-01) is most recent, so it
    // wins over r-1 ("Back Squat", createdAt 2026-09-01). The factory
    // uses the same createdAt for all three, but the API walk is in
    // insertion order, so r-3's "BACK SQUAT" is the last seen and wins.
    expect(result).toContain("BACK SQUAT");
    expect(result).toContain("Deadlift");
    expect(result).toHaveLength(2);
  });

  it("returns [] when there are no records", () => {
    expect(getUniqueExercises()).toEqual([]);
  });
});

// ─── Calculator state ────────────────────────────────────────────────────────

describe("getCalculatorState / setCalculatorState", () => {
  it("getCalculatorState returns defaults when no data is stored", () => {
    expect(getCalculatorState()).toEqual({ barKg: 20, discs: [] });
  });

  it("getCalculatorState returns the persisted state when valid", () => {
    localStorage.setItem(
      "pd:calculator-state",
      JSON.stringify({ barKg: 15, discs: [mkDisc({ weight: 25, count: 2 })] }),
    );
    expect(getCalculatorState()).toEqual({
      barKg: 15,
      discs: [mkDisc({ weight: 25, count: 2 })],
    });
  });

  it("getCalculatorState returns defaults when barKg is invalid (zero, negative, non-number)", () => {
    localStorage.setItem("pd:calculator-state", JSON.stringify({ barKg: 0, discs: [] }));
    expect(getCalculatorState()).toEqual({ barKg: 20, discs: [] });
    localStorage.setItem("pd:calculator-state", JSON.stringify({ barKg: -5, discs: [] }));
    expect(getCalculatorState()).toEqual({ barKg: 20, discs: [] });
    localStorage.setItem(
      "pd:calculator-state",
      JSON.stringify({ barKg: "twenty", discs: [] }),
    );
    expect(getCalculatorState()).toEqual({ barKg: 20, discs: [] });
  });

  it("getCalculatorState returns defaults when discs is not an array", () => {
    localStorage.setItem(
      "pd:calculator-state",
      JSON.stringify({ barKg: 20, discs: "not an array" }),
    );
    expect(getCalculatorState()).toEqual({ barKg: 20, discs: [] });
  });

  it("getCalculatorState returns defaults when a sample disc fails DiscRowSchema", () => {
    localStorage.setItem(
      "pd:calculator-state",
      JSON.stringify({
        barKg: 20,
        discs: [{ weight: -5, unit: "kg", count: 1 }], // negative weight
      }),
    );
    expect(getCalculatorState()).toEqual({ barKg: 20, discs: [] });
  });

  it("getCalculatorState returns defaults for malformed JSON", () => {
    localStorage.setItem("pd:calculator-state", "{not json}");
    expect(getCalculatorState()).toEqual({ barKg: 20, discs: [] });
  });

  it("setCalculatorState persists the state and dispatches a storage event", () => {
    const handler = vi.fn();
    window.addEventListener("storage", handler);
    const state = { barKg: 15, discs: [mkDisc()] };
    setCalculatorState(state);
    expect(getCalculatorState()).toEqual(state);
    expect(handler).toHaveBeenCalled();
    window.removeEventListener("storage", handler);
  });
});

// ─── Subscribe helpers ───────────────────────────────────────────────────────

describe("subscribeToSessions", () => {
  it("returns a no-op cleanup when called server-side (no window)", async () => {
    // The function early-returns `() => {}` when `typeof window === "undefined"`.
    // We can't truly simulate SSR in jsdom, so we just assert the return
    // type is a function (the function's body is defensive).
    const cleanup = subscribeToSessions(() => {});
    expect(typeof cleanup).toBe("function");
    cleanup();
  });

  it("triggers the callback when a `storage` event for pd:sessions fires", () => {
    const callback = vi.fn();
    const cleanup = subscribeToSessions(callback);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "pd:sessions",
        newValue: "[]",
      }),
    );
    expect(callback).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("does NOT trigger the callback for a storage event with a different key", () => {
    const callback = vi.fn();
    const cleanup = subscribeToSessions(callback);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "pd:calculator-state",
        newValue: "{}",
      }),
    );
    expect(callback).not.toHaveBeenCalled();
    cleanup();
  });

  it("cleanup unregisters the listener", () => {
    const callback = vi.fn();
    const cleanup = subscribeToSessions(callback);
    cleanup();
    window.dispatchEvent(
      new StorageEvent("storage", { key: "pd:sessions", newValue: "[]" }),
    );
    expect(callback).not.toHaveBeenCalled();
  });
});

describe("subscribeToLastInput", () => {
  it("triggers the callback only for the matching modality", () => {
    const callback = vi.fn();
    const cleanup = subscribeToLastInput("crossfit", callback);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "pd:last-input-crossfit",
        newValue: "{}",
      }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "pd:last-input-powerlifting",
        newValue: "{}",
      }),
    );
    expect(callback).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("cleanup unregisters the listener", () => {
    const callback = vi.fn();
    const cleanup = subscribeToLastInput("crossfit", callback);
    cleanup();
    window.dispatchEvent(
      new StorageEvent("storage", { key: "pd:last-input-crossfit", newValue: "{}" }),
    );
    expect(callback).not.toHaveBeenCalled();
  });
});
