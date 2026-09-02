/**
 * Unit tests for `src/lib/sessions.ts`.
 *
 * `loadSessionInto` is a pure helper that gives a name to the
 * "load a previously-saved session into the active result" action.
 * The contract is small: preserve `id`/`createdAt`/`model` so a subsequent
 * `Guardar` does `updateSession` (idempotent) rather than `addSession`,
 * and do not mutate the source.
 */
import { describe, it, expect } from "vitest";
import { loadSessionInto } from "@/lib/sessions";
import type { SavedSession } from "@/lib/types";
import type { CrossFitPlan } from "@/lib/modalities/crossfit";

// Minimal but complete `SavedSession` factory. `loadSessionInto` is supposed
// to copy every field verbatim, so we populate all of them with distinct
// sentinel values to detect any field accidentally dropped or overwritten.
const mkSession = (overrides: Partial<SavedSession> = {}): SavedSession => ({
  id: "ss-001",
  modalityId: "crossfit",
  createdAt: "2026-09-01T10:00:00.000Z",
  model: "MiniMax-Text-01",
  markdown: "# Snatch & Burpees\n\n20 min AMRAP",
  structured: {
    title: "Snatch & Burpees",
    warmup: "5 min row",
    strength: "Snatch 5x3 @ 70%",
    wod: "20 min AMRAP",
    cooldown: "Stretch",
  } satisfies CrossFitPlan,
  input: {
    durationMinutes: "20",
    strengthSkill: "Snatch",
    wodFormat: "AMRAP",
  },
  title: "Snatch & Burpees",
  ...overrides,
});

describe("loadSessionInto", () => {
  it("returns a session with all fields equal to the source (roundtrip identity)", () => {
    const source = mkSession();
    const loaded = loadSessionInto(source);
    expect(loaded).toEqual(source);
  });

  it("preserves the id for update idempotency", () => {
    const source = mkSession({ id: "ss-abc-123" });
    const loaded = loadSessionInto(source);
    expect(loaded.id).toBe("ss-abc-123");
  });

  it("preserves createdAt, model, and modalityId", () => {
    const source = mkSession({
      createdAt: "2026-08-15T08:30:00.000Z",
      model: "MiniMax-Text-01",
      modalityId: "crossfit",
    });
    const loaded = loadSessionInto(source);
    expect(loaded.createdAt).toBe("2026-08-15T08:30:00.000Z");
    expect(loaded.model).toBe("MiniMax-Text-01");
    expect(loaded.modalityId).toBe("crossfit");
  });

  it("does not mutate the source object", () => {
    const source = mkSession();
    const snapshot = JSON.stringify(source);
    loadSessionInto(source);
    expect(JSON.stringify(source)).toBe(snapshot);
  });

  it("returns a different reference (does not return source itself)", () => {
    const source = mkSession();
    const loaded = loadSessionInto(source);
    expect(loaded).not.toBe(source);
  });

  it("preserves `structured: null` (pre-0011 or unstructured sessions)", () => {
    const source = mkSession({ structured: null });
    const loaded = loadSessionInto(source);
    expect(loaded.structured).toBeNull();
  });

  it("preserves `input` verbatim (for Regenerar to use the same brief)", () => {
    const source = mkSession({
      input: {
        durationMinutes: "30",
        strengthSkill: "Clean & Jerk",
        wodFormat: "EMOM",
      },
    });
    const loaded = loadSessionInto(source);
    expect(loaded.input).toEqual({
      durationMinutes: "30",
      strengthSkill: "Clean & Jerk",
      wodFormat: "EMOM",
    });
  });
});
