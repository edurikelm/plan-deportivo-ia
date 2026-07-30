# System Modalities Registry

The system offers **modalities** (CrossFit first) as code-registered modules. Each modality encapsulates its own canonical context, input schema, output schema, markdown converter, and render component. User-authored Clase templates are removed.

**Status**: accepted

**Supersedes**: ADR-0002 (Clase as source of truth) for the generation path. ADR-0003 (CrossFit four-phase generation) is folded into this ADR.

## Decision

### From Clase to Modality

The MVP's `Clase` model (user-authored markdown structure + exercise pool + duration) is replaced by a `ModalityDefinition` registry.

A `ModalityDefinition` is spread across three files in `src/lib/modalities/`:

```
crossfit-schemas.ts  (server-only)
  context: string          — loaded from docs/instrucciones-crossfit.md
  inputSchema              — CrossFitSessionInput (Zod)
  outputSchema             — CrossFitPlan (Zod)
  toMarkdown(output)       — converts validated JSON to readable markdown
  generateCrossFitSession() — assembles prompt + calls LLM + validates + retries

modalities.ts  (server + client, no Node.js built-ins)
  MODALITIES[]             — array of Modality objects (id, label, description, accent, iconKey)
  getModality(id)           — lookup helper

crossfit.tsx  ('use client')
  CrossFitPlanView          — React component rendering the 4-phase result
```

The Entrenador does not create or edit modality definitions. The catalog at `/classes` shows system modalities; no user-created Clase survives the migration.

### SavedSession replaces Idea

Sessions persist as `SavedSession`:

```ts
{
  id: string
  modalityId: string
  createdAt: string
  model: string
  title: string
  markdown: string      // readable form, for copy/export
  structured: object     // validated output from LLM
  input: object         // what the Entrenador filled in the form
}
```

Storage key: `pd:sessions`. `pd:classes` and `pd:ideas` are silently discarded on first read.

### Mini-historial

The last 5 `SavedSession` entries (ordered `createdAt` desc) are shown below the generation result. No dedicated history route.

### CrossFit is the first and defining modality

CrossFit validates exactly 4 phases: Warm-Up, Strength/Skill, WOD, Cool Down.

Per-session inputs (form fields):
- `strengthSkill` (required) — technique/strength prescription
- `wodFormat` (required) — `AMRAP | EMOM | For Time | Tabata | Intervalos | Aleatorio`
- `focusMovement` (optional) — main technical movement
- `considerations` (optional) — trainer notes
- `duration` (optional) — 45 | 60 | 75 | 90 minutes; default 60

`Aleatorio` is offered as a selectable option to the Entrenador (alongside AMRAP, EMOM, For Time, Tabata, Intervalos). When selected, the system resolves it internally to a concrete format before calling the LLM. The output `sections.wod.format` will always be a concrete value (never "Aleatorio").

### Why not `response_format` on MiniMax-M3

MiniMax-M3 does not support `response_format: { type: "json_object" }` in a stable way for this flow. JSON is requested via prompt, validated server-side with Zod, and retried once on failure before surfacing a generic error.

This is not a workaround — it is the designed path: prompt-based JSON request + server validation + retry.

## Consequences

- Adding a new modality (Bodybuild, Gymnastics) follows the same pattern: a `ModalityDefinition` module. No changes to storage, API, or routing.
- Existing `pd:classes` and `pd:ideas` data is silently dropped on first load.
- The route tree shrinks: `/classes/new`, `/classes/[id]`, `/classes/[id]/generate` are removed. `/generate/[modalityId]` is the single generation entry point.
- The 4-phase `CrossFitPlanView` replaces the chalk-card fluid markdown render for CrossFit output.
- `Guardar` is always available when a session exists. `Copiar` and `Exportar .md` are always available. `Regenerar` replaces the active session without persisting.

## Considered alternatives

- **Free-form per-session prompts** — rejected: loses structure consistency and the modality-as-code pattern.
- **Typed discriminator on Clase** (`wodFormat`, `splitType`, etc.) — rejected: per-session knobs don't belong on a reusable definition object.
- **Separate storage key per modality** — rejected: `SavedSession.modalityId` handles this cleanly.
- **`/ideas` history route** — deferred; mini-historial satisfies the immediate need.

## Out of scope

- Streaming LLM response.
- Cross-device sync.
- Dedicated history page.
- Video URL.
- Modalities beyond CrossFit (architecture prepared; implementation deferred).
