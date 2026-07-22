# Clase as source of truth for the prompt

Each Clase carries its own `structure` (markdown template), `exercises` (text pool), and `durationMinutes`. When generating an Idea, the system prompt is derived from the Clase object — the trainer does not compose prompts per session.

Chosen over a free-form chat interface because the domain has clear repeating templates (crossfit: Skill → Strength → WOD with `amrap | for_time | emom | tabata`), and training benefits from consistency over spontaneity. Each Idea's `content` is one shot at the definition that existed at generation time, so the design naturally survives definition changes.

**Status**: accepted

**Considered alternatives**:
- Free-form prompt per session (trainer types "generate a WOD" each time) — rejected: re-introduces the structure/form duplication that originally motivated Classes.
- Per-class typed fields (e.g., `wodFormat` enum for crossfit, `splitType` enum for bodybuilding) — rejected for v1: introduces a discriminator tree that grows with every new Clase kind and locks the data model to specific domains.

**Consequences**:
- Adding a new class type (e.g., "gymnastics") is just authoring a new `structure` markdown — no code changes.
- Existing Ideas remain valid after a Clase's definition changes (their `content` is the snapshot of what the LLM produced that day, stored independently).
- Crossfit-class-specific niceties (like a typed `wodFormat` picker) would require a separate schema layer; deferred to v2.
- The "focus" override is the one knob that escapes the Clase's authority — by design, since it's the trainer's per-session input.
