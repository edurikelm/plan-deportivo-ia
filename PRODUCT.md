# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A single **Entrenador** (fitness coach / trainer) who generates training session ideas for one or more modalities (CrossFit, Bodybuild, Gymnastics, etc.). Single-user, single-browser, single-language (Spanish).

Mental model: the Entrenador opens the app a few minutes before a session to complete a form, generate a structured session plan, optionally tweak it, and save or export it.

Not multi-tenant. Not collaborative. Not for end-students of the coach — students may receive the exported `.md`, but they are not users of the app.

## Product Purpose

Generate, edit, and persist AI-assisted training session ideas ("Sesiones") for predefined system modalities ("Modalidades").

Each modality is a code-registered module that encapsulates its own canonical context, input schema, output schema, markdown converter, and render component. The Entrenador fills a per-session form; the system generates a validated structured session.

CrossFit is the first modality. Its output is strictly 4-phase (Warm-Up, Strength/Skill, WOD, Cool Down), validated server-side as JSON, converted to readable markdown for display, copy, and export.

## Positioning

**Modalities are registered code modules, not user-authored templates.** The Entrenador does not create class definitions — they fill a session form and receive a validated output. This makes CrossFit the brand commitment for the product: the first modality, the one that defines the interaction model for all future ones.

Adding a new modality (Bodybuild, Gymnastics, Olympic Lifting) is a code change that follows the same pattern: a modality definition + per-session input form + structured output. No change to the rest of the system.

## Operating Context

- **Where**: desktop browser (Vercel / Next.js 16 web). No mobile-specific surface planned.
- **When**: a few minutes before training a session, or during weekly prep.
- **Workflow**: open `/classes` → pick a modality → fill session form (Strength/Skill, WOD format, optional focus and notes) → hit Generar → read the 4-phase result → optionally tweak → save, copy, or download as `.md`.
- **Spanish voice**: system prompt and UI strings are in Spanish ("Sos un coach deportivo…", "Generar", "Guardar", "Exportar"). No i18n yet.
- **Browser storage**: clearing site data wipes all sessions. Acceptable for v1; documented in ADR 0001.

## Capabilities and Constraints

### Domain model

- `Modality { id, label, description, accent, iconKey }` — definido en `src/lib/modalities/modalities.ts`. Compartido entre server y client.
- La definición de modalidad (context, schemas, converter, generator, renderComponent) está dispersa en tres archivos: `crossfit-schemas.ts` (server), `crossfit.tsx` (client), `modalities.ts` (shared). No existe un objeto literal `ModalityDefinition`.
- `SavedSession { id, modalityId, createdAt, model, title, markdown, structured, input }`
- `SavedWeightRecord { id, createdAt, exercise, barKg, discs, totalKg, totalLb, breakdownLine, source }` — snapshot durable de un cálculo de peso. Persistido en `pd:calculator-records` (issue 0012, ADR-0009). Se captura por dos caminos: auto-log pasivo (debounce 1500ms, `exercise: null`) y Guardar explícito con etiqueta de ejercicio obligatoria.
- Persisted as `pd:sessions` in `localStorage`. `pd:classes` and `pd:ideas` are silently discarded on first read. `pd:calculator-records` is a new key; absence = empty array, no migration needed.

### Prompt construction

- System prompt = derivation of the modality's canonical context + serialized input.
- Structured output validated server-side with Zod (`crossfit-schemas.ts`); retry once on failure if JSON is invalid, then surface a generic error.
- No `response_format` sent to MiniMax-M3 (not supported stably). JSON requested via prompt.

### Generation

- Model: `MiniMax-M3` via OpenAI-compatible endpoint (`https://api.minimax.io/v1`).
- `temperature: 0.7`, `max_tokens: 4096`.
- API key (`MINIMAX_API_KEY`) lives **only** server-side; the browser hits `POST /api/generate` and receives `{ content, structured, model }`.

### Surfaces

| Route | Purpose |
|---|---|
| `/` | Redirects to `/classes` |
| `/classes` | System modality catalog (CrossFit first) |
| `/generate/[modalityId]` | Session form + 4-phase result + mini-history (last 5 sessions) |
| `/tools/weight-calculator` | Calculadora de Pesos (Manual + Foto tabs, sticky total, mini-panel de registros etiquetados) |
| `/tools/weight-calculator/history` | Historial completo de cargas: búsqueda, filtros por source, sort, acciones por fila (issue 0012) |
| `/api/generate` | POST → validated generation |

### Session actions on the result card

Copy (clipboard) · Export `.md` (`{modalityId}-{YYYY-MM-DD}.md`) · Regenerate (confirms if unsaved changes) · Save (`pd:sessions`).

### Hard constraints

- No auth, no DB, no multi-tenant (ADR 0001).
- No state outside `localStorage` and the in-flight API call.
- Model `MiniMax-M3` is hardcoded in `src/lib/modalities/crossfit-schemas.ts` (line 192). No `lib/minimax.ts` exists.
- Save persists the session with its `structured` output intact (post-generation, no raw LLM save).
- Tailwind v4 / shadcn (base-nova preset) only; no other UI lib.
- **CrossFit is the first and defining modality**: 4-phase template (`docs/instrucciones-crossfit.md`), strict JSON output validated server-side, rendered as `CrossFitPlanView` with 4 labeled blocks.
- Future modalities follow the same registry pattern: context + inputSchema + outputSchema + converter + render component.
- **Aleatorio** WOD format is offered as a selectable option to the Entrenador. The system resolves it internally to a concrete format before calling the LLM. The output `sections.wod.format` will always be a concrete value, never "Aleatorio".
- No video URL in this scope.
- Calculadora de Pesos puede registrar cálculos de peso con etiqueta de ejercicio (Guardar explícito + atribución de Foto) y mantener un historial durable. El mini-panel y la página completa de historial son las dos superficies. No convierte la calculadora en una modalidad (sigue siendo utility manual, ADR-0007 + ADR-0009). El feature de auto-log pasivo que estaba en el spec original fue removido durante 0017 polish (más ruido que valor en uso real).

### Open / deliberately undecided

- i18n beyond Spanish.
- Cross-device sync (out-of-scope per ADR 0001).
- Dedicated history route (`/ideas`) — deferred.
- Live browser overlay (`.impeccable/live`) — not configured.
- Streaming of LLM response.
- Specific modalities beyond CrossFit (Bodybuild, Gymnastics, Olympic Lifting, etc.) — only the registry architecture is prepared.
- Registry de movimientos tipado para la calculadora. Hoy el campo `exercise` es string libre; el autocomplete ayuda a la consistencia.

## Brand Commitments

- **Product name**: Plan Deportivo IA (literal, exact).
- **Voice**: utilitarian Spanish. Imperative verbs in actions ("Generar", "Guardar", "Exportar"). The AI persona uses "Sos un coach deportivo".
- **Personality commitments**:
  - Minimalist chrome — no decorative copy, no marketing prose, one primary action per screen.
  - Local-first — privacy as a product feature, not a sidebar pitch.
  - **CrossFit as brand commitment**: the first modality defines the interaction model. It is the reference implementation for all future modalities.
  - Modality registry architecture — adding Bodybuild or Gymnastics is a code module, not a product restructure.
- **No external brand assets** beyond the code repo and the MiniMax model signature.
- **No aesthetic commitments imported here** — visual world (palette, type, density) lives in `DESIGN.md`.

## Roadmap (Modalities)

| Modalidad | Estado | Notas |
|---|---|---|
| CrossFit | ✅ MVP | 4 fases, JSON validado, `CrossFitPlanView` |
| Bodybuild | 🔲 Backlog | Schema de split + series/reps, render `BodybuildPlanView` |
| Gymnastics | 🔲 Backlog | Skills bodyweight, tiempo/técnica |
| Olympic Lifting | 🔲 Backlog | Técnica de arrancada y envión |
| Running / Cardio | 🔲 Backlog | Intervalos, tempo runs |

## Evidence on Hand

- `CONTEXT.md` — modality registry, SavedSession model, storage schema, route tree.
- `docs/adr/0003-system-modalities.md` — modality replacement of Clase, no `response_format` decision.
- `docs/adr/0009-saved-weight-records.md` — saved weight records (auto-log + Guardar con etiqueta, mini-panel + página de historial).
- `docs/agents/issues/0012-saved-weight-records.md` — phased implementation plan for the calculator history.
- `src/lib/modalities/` — code registry with crossfit as reference implementation.
- `src/app/**/*.tsx` + `src/app/api/generate/route.ts` — working surfaces.

## Product Principles

Five durable rules:

1. **Local-first, zero infra.** The browser is the database; the server only proxies the API key.
2. **Modalities are code modules.** The Entrenador does not author templates — each modality is a registered definition.
3. **One form per session.** Structure, exercises, and duration are encapsulated by the modality. The only per-session input is what the form collects.
4. **Structured output, validated then rendered.** JSON from LLM → Zod validation → markdown + structured object → display.
5. **SavedSession is the atomic unit.** History, re-render, copy, and export all derive from the saved `structured` object.

## Accessibility & Inclusion

No product-specific accessibility requirement has been documented. The MVP runs as a standard web app on Next.js (semantic HTML, shadcn components with Base UI primitives, Tailwind v4 defaults), so WCAG 2.2 AA basics (color contrast, keyboard navigation, focus visibility, semantic landmarks) apply as defaults. The app is Spanish-only at MVP.
