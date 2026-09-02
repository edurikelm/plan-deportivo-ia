/**
 * Unit tests for the pure helpers in `src/lib/modalities/crossfit-schemas.ts`.
 *
 * Only the functions that don't require mocking the `openai` SDK are
 * tested. Specifically:
 *  - `crossfitPlanToMarkdown(plan)` — deterministic converter.
 *  - `resolveAleatorio(strengthSkill)` — hash-based format picker.
 *
 * `generateCrossFitSession` is out of scope (requires mocking openai's
 * `chat.completions.create` plus a real `process.env.MINIMAX_API_KEY`).
 * `stripMarkdownFences` and `parseJsonResponse` are file-private and
 * exercised indirectly through the integration path.
 */
import { describe, it, expect } from "vitest";
import {
  crossfitPlanToMarkdown,
  resolveAleatorio,
  WOD_FORMATS,
  DURATION_OPTIONS,
  CrossFitSessionInputSchema,
  type CrossFitPlan,
  type CrossFitSessionInput,
} from "./crossfit-schemas";

const mkPlan = (overrides: Partial<CrossFitPlan> = {}): CrossFitPlan => ({
  class_title: "Snatch & Skill",
  focus_movement: "Snatch",
  estimated_duration_min: 60,
  sections: {
    warm_up: { duration_min: 10, description: "Pass-throughs", exercises: [] },
    strength_skill: {
      duration_min: 20,
      description: "Power Snatch 5x3 @ 70%",
      exercises: ["5x3 Power Snatch @ 70%"],
    },
    wod: {
      format: "AMRAP",
      time_cap_min: 15,
      description: "20 min AMRAP",
      score_type: "Rondas + Reps",
      exercises: ["5 Pull-ups", "10 Push Press", "15 Box Jumps"],
    },
    cool_down: {
      duration_min: 10,
      description: "Stretch",
      exercises: [],
    },
  },
  ...overrides,
});

// ─── crossfitPlanToMarkdown ──────────────────────────────────────────────────

describe("crossfitPlanToMarkdown", () => {
  it("renders the class title as the H1", () => {
    const md = crossfitPlanToMarkdown(mkPlan({ class_title: "Hero WOD" }));
    expect(md).toContain("# Hero WOD");
  });

  it("includes the focus_movement in the meta block", () => {
    const md = crossfitPlanToMarkdown(mkPlan({ focus_movement: "Clean & Jerk" }));
    expect(md).toContain("**Enfoque:** Clean & Jerk");
  });

  it("includes the estimated duration in the meta block", () => {
    const md = crossfitPlanToMarkdown(mkPlan({ estimated_duration_min: 45 }));
    expect(md).toContain("**Duración estimada:** 45 min");
  });

  it("renders each of the 4 sections with a heading", () => {
    const md = crossfitPlanToMarkdown(mkPlan());
    expect(md).toContain("## Warm-Up");
    expect(md).toContain("## Strength / Skill");
    expect(md).toContain("## WOD — AMRAP");
    expect(md).toContain("## Cool Down");
  });

  it("renders the WOD section with format and score_type", () => {
    const md = crossfitPlanToMarkdown(
      mkPlan({ sections: { ...mkPlan().sections, wod: { ...mkPlan().sections.wod, format: "EMOM", score_type: "Tiempo" } } }),
    );
    expect(md).toContain("## WOD — EMOM");
    expect(md).toContain("_15 min · Tiempo_");
  });

  it("renders the section descriptions inline", () => {
    const md = crossfitPlanToMarkdown(
      mkPlan({
        sections: {
          ...mkPlan().sections,
          warm_up: { duration_min: 10, description: "Banda y movilidad", exercises: [] },
        },
      }),
    );
    expect(md).toContain("Banda y movilidad");
  });

  it("renders the exercises as a bulleted list when present", () => {
    const md = crossfitPlanToMarkdown(
      mkPlan({
        sections: {
          ...mkPlan().sections,
          warm_up: {
            duration_min: 10,
            description: "Passthrough",
            exercises: ["10 Scapular Pull Ups", "3x5 Air Squats"],
          },
        },
      }),
    );
    expect(md).toContain("- 10 Scapular Pull Ups");
    expect(md).toContain("- 3x5 Air Squats");
  });

  it("omits the exercises block when the section has no exercises", () => {
    // The converter uses .filter(Boolean) on the spread, so when an
    // empty exercise array produces no bullet lines, the section ends
    // with the description and a blank line — no "- undefined" leakage.
    const md = crossfitPlanToMarkdown(mkPlan());
    expect(md).not.toContain("- undefined");
    expect(md).not.toContain("- null");
  });

  it("separates sections with horizontal rules", () => {
    const md = crossfitPlanToMarkdown(mkPlan());
    // The converter emits 4 `---` rules: one after the title/enfoque/duración
    // header block, and one between each pair of consecutive sections
    // (between Warm-Up → Strength/Skill, Strength/Skill → WOD, WOD → Cool Down).
    const separators = md.match(/^---$/gm);
    expect(separators).not.toBeNull();
    expect(separators?.length).toBe(4);
  });
});

// ─── resolveAleatorio ────────────────────────────────────────────────────────

describe("resolveAleatorio", () => {
  it("always returns a format from the resolved set (excludes 'Aleatorio')", () => {
    const resolved: WodFormat[] = ["AMRAP", "EMOM", "For Time", "Tabata", "Intervalos"];
    for (const skill of ["Snatch", "Clean & Jerk", "Back Squat", "Deadlift", "A", ""]) {
      const result = resolveAleatorio(skill);
      expect(resolved).toContain(result);
      expect(result).not.toBe("Aleatorio");
    }
  });

  it("is deterministic — same input always returns the same format", () => {
    expect(resolveAleatorio("Snatch")).toBe(resolveAleatorio("Snatch"));
    expect(resolveAleatorio("Clean & Jerk")).toBe(resolveAleatorio("Clean & Jerk"));
  });

  it("uses a hash that spreads different inputs across the resolved set", () => {
    // We don't lock to a specific mapping (the hash function can change),
    // but we assert that the set of returned formats covers at least 3
    // distinct values across a representative input set. If the hash
    // were broken (e.g. always returning the first item), this would
    // fail.
    const results = new Set<string>();
    for (let i = 0; i < 30; i++) {
      results.add(resolveAleatorio(`skill-${i}`));
    }
    expect(results.size).toBeGreaterThanOrEqual(3);
  });

  it("is stable across all WOD_FORMATS minus Aleatorio (full set membership)", () => {
    const allowed: WodFormat[] = ["AMRAP", "EMOM", "For Time", "Tabata", "Intervalos"];
    for (let i = 0; i < 50; i++) {
      expect(allowed).toContain(resolveAleatorio(`probe-${i}`));
    }
  });
});

// ─── WOD_FORMATS / DURATION_OPTIONS constants ─────────────────────────────────

describe("WOD_FORMATS constant", () => {
  it("includes Aleatorio as the 6th option (system-resolved later)", () => {
    expect(WOD_FORMATS).toContain("Aleatorio");
    expect(WOD_FORMATS.length).toBe(6);
  });

  it("contains the 5 concrete formats the form exposes", () => {
    expect(WOD_FORMATS).toEqual(
      expect.arrayContaining(["AMRAP", "EMOM", "For Time", "Tabata", "Intervalos"]),
    );
  });
});

describe("DURATION_OPTIONS constant", () => {
  it("is the canonical 45/60/75/90 quartet", () => {
    expect(DURATION_OPTIONS).toEqual([45, 60, 75, 90]);
  });
});

// ─── CrossFitSessionInputSchema (Zod) ────────────────────────────────────────

describe("CrossFitSessionInputSchema", () => {
  it("accepts a fully populated valid input", () => {
    const result = CrossFitSessionInputSchema.safeParse({
      durationMinutes: "60",
      strengthSkill: "Snatch",
      wodFormat: "AMRAP",
      focusMovement: "Hip thrust",
      considerations: "Evitar lesiones de rodilla",
    } satisfies CrossFitSessionInput);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid wodFormat", () => {
    const result = CrossFitSessionInputSchema.safeParse({
      durationMinutes: "60",
      strengthSkill: "Snatch",
      wodFormat: "Crossfit Games",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty strengthSkill", () => {
    const result = CrossFitSessionInputSchema.safeParse({
      durationMinutes: "60",
      strengthSkill: "",
      wodFormat: "AMRAP",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid durationMinutes (not in 45/60/75/90)", () => {
    const result = CrossFitSessionInputSchema.safeParse({
      durationMinutes: "30",
      strengthSkill: "Snatch",
      wodFormat: "AMRAP",
    });
    expect(result.success).toBe(false);
  });

  it("accepts 'Aleatorio' as a valid wodFormat (form-only option)", () => {
    const result = CrossFitSessionInputSchema.safeParse({
      durationMinutes: "60",
      strengthSkill: "Snatch",
      wodFormat: "Aleatorio",
    });
    expect(result.success).toBe(true);
  });
});
