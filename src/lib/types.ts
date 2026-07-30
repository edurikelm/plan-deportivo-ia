import type { CrossFitPlan, CrossFitSessionInput } from "./modalities/crossfit";

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
