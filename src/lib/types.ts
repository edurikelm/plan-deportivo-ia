import type { CrossFitPlan, CrossFitSessionInput } from "./modalities/crossfit";
import type { DiscRow } from "./calculator/schemas";

// ─── Modality (system-defined, not user-created) ────────────────────────────

/** A modality registered in the system (e.g. CrossFit). */
export interface Modality {
  id: string;
  label: string;
  description: string;
  accent: string;
  iconKey: string;
}

// ─── SavedSession (formerly Idea) ──────────────────────────────────────────

/**
 * A saved training session.
 * Renamed from Idea → SavedSession to reflect that it is a one-off session,
 * not a reusable class template.
 *
 * The `markdown` field is the source of truth for Copiar / Exportar .md.
 * `structured` holds the validated `CrossFitPlan` for re-render via
 * `CrossFitPlanView` (issue 0011 — `MiniMax-Text-01` returns reliable JSON).
 */
export interface SavedSession {
  id: string;
  /** e.g. "crossfit" */
  modalityId: string;
  createdAt: string;
  model: string;
  /** Human-readable markdown — derived from `structured` for Copiar / Exportar */
  markdown: string;
  /** Validated structured output (CrossFitPlan). Source of truth for re-render. */
  structured: CrossFitPlan | null;
  /** The session input used to generate this session */
  input: CrossFitSessionInput;
  /** Title for display in mini-history */
  title: string;
}

/** Initializer for a new SavedSession — fill id + createdAt before persisting. */
export const EMPTY_SAVED_SESSION: Omit<SavedSession, "id" | "createdAt"> = {
  modalityId: "crossfit",
  model: "MiniMax-Text-01",
  markdown: "",
  structured: null,
  input: {
    durationMinutes: "60",
    strengthSkill: "",
    wodFormat: "AMRAP",
  },
  title: "",
};

// ─── SavedWeightRecord (calculator history) ──────────────────────────────────

/**
 * How a `SavedWeightRecord` was captured.
 *
 * - `auto-log` — passive capture by the calculator's debounced watcher.
 *   `exercise` is `null` for these; the record exists only as telemetry.
 * - `manual` — explicitly saved by the Entrenador through the Save form in
 *   the calculator footer. `exercise` is required and non-null.
 * - `foto` — captured immediately when the Entrenador accepts a load from
 *   the Foto tab. `exercise` is `null`; the photo origin is preserved even
 *   if the coach edits the bar/discs afterward.
 */
export type RecordSource = "auto-log" | "manual" | "foto";

/**
 * A persisted snapshot of a bar + disc calculation in the calculator.
 *
 * `discs` is a frozen snapshot of the rows at the moment the record was
 * captured — never a live reference to the calculator's current state.
 * Editing the calculator after the record is created does not mutate it.
 */
export interface SavedWeightRecord {
  id: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** Required for `manual` and `foto`; null for `auto-log`. */
  exercise: string | null;
  barKg: number;
  discs: DiscRow[];
  totalKg: number;
  totalLb: number;
  /** Pre-formatted line for display in lists (e.g. "20kg + (25kg + 10kg)×2"). */
  breakdownLine: string;
  source: RecordSource;
  /**
   * Repetitions executed in the set. Required for new `manual` records;
   * null for legacy records (pre-0036) and `foto` records. Drives the
   * 1RM estimation via Epley (see `one-rm.ts`).
   */
  reps: number | null;
  /**
   * Manual override flag marking this record as the user's 1RM for
   * the exercise. Always present after Zod parse (`.default(false)`).
   * If true, the record's `totalKg` competes with the Epley-estimated
   * value when aggregating per exercise (see ADR-0010).
   */
  isOneRepMax: boolean;
}
