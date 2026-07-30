---
label: bug
status: closed
closed_at: 2026-07-29
---

## Resultado

Implementados, revisados y verificados 7 fixes mecánicos + 1 nota de brief. B1 y B2 (los críticos) corroborados empíricamente por `tester`.

### Cambios
- `src/app/globals.css`: agregados los tokens `signal-deep` y `hairline-strong` en `@theme inline` (B5); `.chalk-card-reveal { animation: none; }` sumada al media query `prefers-reduced-motion` existente (B7).
- `src/app/classes/_components/classes-list-client.tsx`: hover de cards pasa de `signal` a `hairline-strong` (B11).
- `src/app/classes/[id]/generate/_components/generate-client.tsx`:
  - `handleSubmit` ya NO llama `addIdea`. Persistencia se difiere al primer `handleSave`. (B1)
  - `handleRegenerate` ya NO llama `addIdea`. Solo `setResult` local. Estado `persisted` se preserva. (B2)
  - `handleSave` bifurca: `addIdea` la primera vez, `updateIdea` las siguientes. (B1+B2)
  - CTA del status strip bifurcadas según haya o no `result`. (B3)
  - `setElapsed(0)` al inicio de `handleSubmit` y `handleRegenerate`. (B12)
  - Anuncio `aria-live` con `lastOutcomeRef` para distinguir éxito vs error. (B9)
  - `useLayoutEffect` → `useEffect`. (trivial del reviewer)
  - `handleRegenerate` usa `focus: focus.trim() || result.focus || undefined` (textarea manda, alineado con el brief). (review #2 Opción A)
- `.impeccable/surface-briefs/classes-id-generate.md`: nota "Decisión de producto (documentada)" explicando la coexistencia del form con el chalk-card (B10 opción A).

### Verificación
- ✅ `npm run lint` — 0 errors, 0 warnings.
- ✅ `npm run build` — TypeScript OK.
- ✅ Smoke test (`tester`): `pd:ideas` queda vacía tras `Generar`; queda como 1 sola entrada tras `Editar → Guardar → Regenerar → Editar → Guardar` con mismo UUID; no se duplica al regenerar (B1+B2 confirmados).
- ✅ Acceptance criteria del issue: 10/10 cubiertos (los 2 que estaban "ya resueltos" verificados: B8 cronómetro 1000ms y 404-CTA ghost).

### Follow-ups explícitos (no en este PR)
- `AbortController` cleanup no-op (nunca se asigna `abortRef` en `handleSubmit`/`handleRegenerate`). Otro issue.
- `navigate-away` con edit pendiente o request en vuelo no tiene `beforeunload` guard. Otro issue.

### Refactorizado por el reviewer
- (Alta) A11y miente en error — fixed (`lastOutcomeRef`).
- (Media) Doc/code drift del focus — fixed (Opción A del reviewer: el textarea manda).
- (Media) B12 cronómetro reset — fixed.
- (Trivial) `useLayoutEffect` → `useEffect` — fixed.

Commit: `1bc9f8f fix(0007): restore edit-then-save contract and a11y/UI polish`.
Push: `bad44ef..1bc9f8f master -> master`.
