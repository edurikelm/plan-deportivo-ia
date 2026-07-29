# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A single **Entrenador** (fitness coach / trainer) who teaches one or more class modalities (Crossfit, Bodybuild, Gymnastics, etc.). Single-user, single-browser, single-language (Spanish).

Mental model: the Entrenador owns a small, hand-curated library of class definitions; they open the app a few minutes before a session to generate, edit, and save ideas they will run with their students.

Not multi-tenant. Not collaborative. Not for end-students of the coach — the consumer of each Idea is the Entrenador; students may receive the exported `.md` or a copy of the text, but they are not users of the app.

## Product Purpose

Generate, edit, and persist AI-assisted class session ideas ("Ideas") for predefined training modalities ("Clases").

The Entrenador defines a Clase once — name, structure (markdown template the AI must follow), exercises (text pool the AI must prefer), and typical duration. From that single source of truth, the Entrenador generates one or more Ideas, optionally writes a session-specific "focus", and uses the output (or its edited version) with their students.

Success means: the Entrenador can go from "I need today's session for Crossfit" to a saved, usable Idea in under a minute, with the AI respecting the existing Clase definition rather than improvising.

## Positioning

**Each Clase is the single source of truth for its own Ideas.** The system prompt is derived from the Clase object — never typed per session. This makes class definitions reusable, makes Ideas consistent across sessions, and makes the addition of a new class type a content-only operation (author a new markdown `structure`), not a code change.

The non-obvious mechanism that an adjacent product could not truthfully copy:

1. Structure → exercises → duration live in the Clase; "focus" is the only per-session knob.
2. An Idea persists as a snapshot of what the LLM produced at a moment in time, immune to later edits to its Clase.
3. No server-side state — the trainer's browser *is* the database, so the API key is the only server responsibility.

## Operating Context

- **Where**: desktop browser (the deployment is Vercel / Next.js 16 web). No mobile-specific surface planned in MVP.
- **When**: a few minutes before training a session, or during weekly prep.
- **Workflow**: open `/classes` → pick or create a Clase → hit Generar → optionally type today's `focus` → read the markdown response → toggle to the editor to tweak → save, copy, or download as `.md`.
- **Spanish voice**: system prompt and UI strings are in Spanish ("Sos un coach deportivo…", "Nueva Clase", "Generar", "Editar", "Guardar"). No i18n yet.
- **Browser storage**: clearing site data wipes the user's library. Acceptable for v1; documented in ADR 0001.

## Capabilities and Constraints

Confirmed from `CONTEXT.md`, the two ADRs, the codebase, and the route surface.

### Domain model

- `Clase { id, name, structure: markdown, exercises: string[], durationMinutes, createdAt }`
- `Idea { id, classId, content: markdown, model: string, focus?: string, createdAt }`
- Persisted as `pd:classes` and `pd:ideas` arrays in `localStorage`.

### Prompt construction (ADR 0002)

- System prompt = derivation of the Clase + (optional) `focus` user message.
- Structure of a Clase is binding — the AI may not add blocks outside it.
- Exercise list is a *preference*, not a hard constraint, when the user (via `focus`) asks for something else.
- Empty responses retry once; otherwise show error. `…` placeholders are filtered before persistence.

### Generation

- Model: `MiniMax-M3` via an OpenAI-compatible endpoint (`https://api.minimax.io/v1`).
- `temperature: 0.7`, `max_tokens: 4096`.
- API key (`MINIMAX_API_KEY`) lives **only** server-side; the browser hits `POST /api/generate` and receives `{ content, model }`.

### Surfaces (MVP)

| Route | Purpose |
|---|---|
| `/` | Redirects to `/classes` |
| `/classes` | List of Clases + empty state + "Nueva Clase" entry point |
| `/classes/new` | Create a Clase (name, structure markdown, exercises, duration) |
| `/classes/[id]` | View / edit an existing Clase |
| `/classes/[id]/generate` | Optional `focus` input, generate Idea, edit / save / copy / download / regenerate |
| `/ideas` | Deferred — out of MVP per `CONTEXT.md` |

### Idea actions on the result card

Copy (clipboard) · Export `.md` (`{className}-{YYYY-MM-DD}.md`) · Regenerate (confirms if unsaved edits) · Save (`pd:ideas`) · Edit toggle (markdown ↔ textarea preview).

### Hard constraints

- No auth, no DB, no multi-tenant (ADR 0001).
- No state outside `localStorage` and the in-flight API call.
- One model constant in `lib/minimax.ts`; per-request model selection is not implemented.
- Idea persistence reflects the **post-edit** `content`, not the raw LLM output.
- Tailwind v4 / shadcn (base-nova preset) only; no other UI lib.
- The crossfit canonical structure (Skill → Strength → WOD with `amrap|for_time|emom|tabata`) is documented in `CONTEXT.md` as an example, not a typed feature.

### Open / deliberately undecided

- i18n beyond Spanish.
- Cross-device sync (intentionally out-of-scope per ADR 0001; documented gap, not a defect).
- Class-type-specific niceties (e.g., a typed `wodFormat` picker for crossfit) — see ADR 0002, deferred.
- An aggregate `pd:ideas` history route (`/ideas`) — deferred per `CONTEXT.md`.
- Live browser overlay (`.impeccable/live`) — not configured in this session; available if invoked.

## Brand Commitments

- **Product name**: Plan Deportivo IA (literal, exact).
- **Voice**: utilitarian Spanish. Imperative verbs in actions ("Generar", "Guardar", "Exportar"). The AI persona in the system prompt uses "Sos un coach deportivo".
- **Personality commitments pulled from the codebase**:
  - Minimalist chrome — no decorative copy, no marketing prose, one primary action per screen.
  - Local-first — privacy as a product feature, not a sidebar pitch.
  - Coach-as-author — Clases are first-class authored objects, not chat transcripts.
- **No external brand assets** beyond the code repo and the MiniMax model signature.
- **No aesthetic commitments imported here** — the visual world (palette, type, density, "Linear / Vercel / Stripe-inspired" reference) lives in `DESIGN.md`. This document does not establish or extend it.

## Evidence on Hand

- `README.md` — stack, scripts, route map, deployment target (Vercel).
- `CONTEXT.md` — domain language, model, prompt construction, rules, route table, Spanish terminology.
- `docs/adr/0001-single-user-local-architecture.md` — single-user / local-first decision and consequences.
- `docs/adr/0002-clase-as-source-of-truth.md` — Clase-as-prompt decision.
- `src/lib/types.ts` — concrete `Clase` and `Idea` shapes.
- `src/app/**/*.tsx` + `src/app/api/generate/route.ts` — the working MVP.
- Canonical CrossFit class structure (Skill / Strength / WOD with `amrap|for_time|emom|tabata`) lives in `CONTEXT.md` as a content seed, not as typed fields.
- **Absent**: no customer testimonials, no public screenshots, no published case studies, no pricing, no licensing terms beyond the repo's `MIT`.

Future work must not fabricate customer evidence, performance benchmarks, or production-traction claims.

## Product Principles

Five durable rules derived from the confirmed record:

1. **Local-first, zero infra.** The browser is the database; the server only proxies the API key. Privacy is structural, not promised.
2. **Clase is the source of truth for its Ideas.** The system prompt is derived; per-session prompt typing is not a feature.
3. **One knob per session: `focus`.** Structure, exercises, and duration belong to the Clase. Anything else is per-shot noise.
4. **Edit-then-save.** What the user saves is what they edited, not what the LLM returned raw.
5. **Snapshot independence.** Once an Idea is saved, it survives any future edit to its Clase. History is immutable.

## Accessibility & Inclusion

No product-specific accessibility requirement has been documented. The MVP runs as a standard web app on Next.js (semantic HTML, shadcn components with Base UI primitives, Tailwind v4 defaults), so WCAG 2.2 AA basics (color contrast, keyboard navigation, focus visibility, semantic landmarks) apply as defaults. The app is Spanish-only at MVP — no English or bilingual UI is currently shipped.
