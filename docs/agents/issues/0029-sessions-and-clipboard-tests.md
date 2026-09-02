---
label: chore
status: open
parent: 0026-test-infra
depends_on: [0028]
blocks: []
---

# 0029 — Tests para `src/lib/sessions.ts` y `src/lib/clipboard.ts`

## Parent

[0026 — Test infrastructure](../0026-test-infra.md)

## What to build

Tests unitarios de los helpers puros (y los thin wrappers sobre browser APIs) de dos archivos co-located:

### `src/lib/sessions.ts` — `loadSessionInto(source)` (~5 tests)
- **Roundtrip identity**: input con todos los campos → output con los mismos campos.
- **Idempotencia**: `loadSessionInto(x).id === x.id` y `createdAt/model` preservados (para que un `Guardar` posterior use `updateSession` en lugar de `addSession`).
- **Inmutabilidad**: `loadSessionInto(source)` no muta `source` (ni shallow ni deep — `structured` debe ser la misma referencia, no un clone, porque queremos zero-cost).
- **Acepta `structured: null`**: el caso real cuando un session pre-0011 o un session sin JSON estructurado entra al flow.
- **modalityId no-default**: el `modalityId` se preserva verbatim (e.g. `"crossfit"` o futuras modalidades).

### `src/lib/clipboard.ts` — browser-API wrappers (~7 tests)
- `copyToClipboard`:
  - `navigator.clipboard.writeText` resuelve → `{ok: true}`.
  - `navigator.clipboard.writeText` rechaza con `Error("denegado")` → `{ok: false, error: "denegado"}`.
  - `navigator` no existe (server-side) → `{ok: false, error: "Clipboard API no disponible"}`.
  - `navigator.clipboard` undefined → mismo error.
- `downloadAsFile`:
  - Crea un `Blob` con el `mimeType` correcto.
  - Llama a `URL.createObjectURL` exactamente 1 vez.
  - Llama a `URL.revokeObjectURL` después del click.
  - `document` undefined → no hace nada (no throw).
- `downloadAsMarkdown`:
  - Pasa `text/markdown` como `mimeType` a `downloadAsFile`.
- `markdownFilename`:
  - Lowercase + spaces → dashes (`"CrossFit WOD"` → `"crossfit-wod-{date}.md"`).
  - Sin espacios (single word) → sin dash.
  - Mayúsculas → lowercase.
  - Acentos/ñ preservados (no los reemplazamos con ASCII; el coach escribe "Press de Banca" o "Sentadilla").
  - Default date → formato `YYYY-MM-DD.md` (vía `toLocaleDateString("en-CA")`).
  - Custom `Date` → usa esa fecha.

## Blocked by

- **0028** (history.ts tests) — la infra ya está probada; este ticket sigue el mismo patrón.

## Acceptance criteria

- [ ] `npm test` ejecuta y reporta los tests nuevos, exit 0.
- [ ] Los dos archivos de test son co-located: `src/lib/sessions.test.ts` y `src/lib/clipboard.test.ts`.
- [ ] Cobertura ≥ 95% en ambos archivos. Las funciones son chicas, debería ser 100%.
- [ ] Los mocks de `navigator.clipboard` y `URL.createObjectURL` se restauran después de cada test (no leak entre tests).
- [ ] `npm run build` sigue pasando.
- [ ] `npm run lint` sigue pasando.

## Manual end-to-end test

```bash
npm test
# Expect: 30 (history) + 12+ (sessions + clipboard) tests passed, exit 0
npm run build
npm run lint
```

## Post-mortem (TBD)
