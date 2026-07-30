import type { CrossFitPlan } from "./modalities/crossfit";
import type { CrossFitSessionInput } from "./modalities/crossfit";

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
 * The `structured` field holds the validated output (CrossFitPlan) for this session.
 */
export interface SavedSession {
  id: string;
  /** e.g. "crossfit" */
  modalityId: string;
  createdAt: string;
  model: string;
  /** Human-readable markdown — the "signed" version after edit-then-save */
  markdown: string;
  /** Structured validated output (e.g. CrossFitPlan). May be re-validated on edit. */
  structured: CrossFitPlan | null;
  /** The session input used to generate this session */
  input: CrossFitSessionInput;
  /** Title for display in mini-history */
  title: string;
}

/** Initializer for a new SavedSession — fill id + createdAt before persisting. */
export const EMPTY_SAVED_SESSION: Omit<SavedSession, "id" | "createdAt"> = {
  modalityId: "crossfit",
  model: "MiniMax-M3",
  markdown: "",
  structured: null,
  input: {
    durationMinutes: "60",
    strengthSkill: "",
    wodFormat: "AMRAP",
  },
  title: "",
};
