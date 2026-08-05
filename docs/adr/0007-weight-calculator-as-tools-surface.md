# Weight Calculator as `/tools` Surface

The Calculadora de Pesos is exposed as a separate `/tools/weight-calculator` surface that lives outside the modality registry. Tools are manual utilities, not AI-generation modules; modalities are exclusively AI-driven. This separation keeps the modality contract clean and allows the calculator to evolve independently.

**Status**: accepted

## Decision

### Why not a modality

The system offers modalities (CrossFit first) as code-registered modules. Each modality encapsulates its own canonical context, input schema, output schema, markdown converter, and render component (see ADR-0003). The modality contract has three implicit invariants:

1. **The modality calls an LLM** via `generate<ModalityName>Session()`.
2. **The modality produces a structured output** validated with Zod.
3. **The modality has a markdown render path** for the result (chalk card or per-modality view component).

The Calculadora de Pesos violates all three invariants:

- It does not call an LLM in the main flow. The Manual tab is pure math (bar + 2 × Σ(discs)).
- It has no "structured output" — the result is a single number pair (kg, lb), not a multi-section document.
- It has no "render path" — the result is a sticky footer, not a chalk card.

Forcing the calculator into the modality registry would require either:

- A "calculator" modality whose `generate()` is a no-op (the function exists but does nothing — bad signal in the code).
- A new "tool variant" branch in the registry, mixing two concepts in one abstraction.

Both alternatives weaken the modality contract.

### The `/tools` namespace

The calculator lives at `/tools/weight-calculator`, parallel to `/classes` (catalog of modalities) and `/generate/[modalityId]` (modality session flow). The `/tools` prefix is a deliberate URL namespace: it signals that the space contains manual utilities, not AI generators. Future tools (setups library, lift history, RPE calculator) can be added under the same prefix without changing the modality pattern.

### Catalog integration

The catalog at `/classes` displays two sections, separated by hairline:

```
MODALIDADES DEL SISTEMA
  [CrossFit]

HERRAMIENTAS
  [Calculadora de Pesos]
```

The "Herramientas" section uses the same `chalk-card` styling as modality cards. From the user's perspective, both are "things the system offers"; the section labels distinguish the categories without splitting routes.

## Consequences

- The calculator has its own endpoint (`/api/calculate-weight`) and its own state (`pd:calculator-state` in localStorage). It does not share the modality registry, the modality schema validation pipeline, or the modality model constant.
- Adding new tools follows the same pattern: a new deep route under `/tools/[tool-id]` plus a new card in the "Herramientas" section of `/classes`.
- The modality registry (`src/lib/modalities/`) is unchanged. CrossFit continues to be the only registered modality.
- If a future tool needs to call the LLM (e.g., a "regenerate session from a workout log" tool), it still goes through the modality contract — the tool layer wraps or calls the modality, it does not become one.
- The `/tools` namespace is reserved for manual utilities. New modalities continue to live under `/generate/[modalityId]`.

## Considered alternatives

- **Calculator as a modality**. Rejected. Forces a `generate()` no-op or a "tool variant" in the registry. Both weaken the modality contract.
- **Calculator as inline modal/sheet in `/classes`**. Rejected. The calculator is a primary surface, not a transient dialog. It has its own state (auto-saved), its own IA flow (Foto tab), and its own UI conventions (sticky bottom, tabs paralelos). A modal would crowd the catalog page.
- **Calculator as separate top-level catalog `/tools`**. Deferred. With one tool today, a separate catalog is overhead. The "Herramientas" section in `/classes` provides the same mental separation without a new route. Migration path is clear if tools grow: move the section to `/tools` and link from `/classes`.

## Out of scope

- Streaming IA response.
- Cross-device sync.
- Calculator as a saved entity (no `pd:calculator-saved` history).
- Named templates or setups (would be a separate tool under `/tools/[tool-id]`).
- Modalities beyond CrossFit (architecture prepared; implementation deferred).
