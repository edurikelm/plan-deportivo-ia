---
label: chore
status: open
parent: 0026-test-infra
depends_on: [0027]
blocks: []
---

# 0028 — Tests para `src/lib/calculator/history.ts`

## Parent

[0026 — Test infrastructure](../0026-test-infra.md)

## What to build

Tests unitarios de las **4 funciones puras** exportadas en `src/lib/calculator/history.ts`. Co-located con la impl (`src/lib/calculator/history.test.ts`).

### `computeTotals(state)` — ~7 tests
- Estado vacío (`discs: []`) → `totalKg = barKg`, `breakdownLine = "{barKg}kg"`.
- Single disc kg → el peso se duplica (uno por lado).
- Single disc lb → conversión correcta vía `lbToKg`.
- Disc con `count > 1` → multiplica también por count.
- Mixed units (kg + lb) → suma correctamente.
- Breakdown con count===1 grouped: `"{barKg}kg + (a + b)×2"`.
- Breakdown con count>1 inline: `"{barKg}kg + (xunit)×n"`.

### `hashState(state)` — ~6 tests
- Determinístico: mismo input → mismo output.
- Order-independent: mismo set de discs en distinto orden → mismo hash.
- Sensible a `barKg`: distinto barKg → distinto hash.
- Sensible a `unit`: 25kg vs 25lb → distinto hash (no collision).
- Sensible a `count`: count=1 vs count=2 → distinto hash.
- Formato: el resultado matchea `/^{barKg}\|/`.

### `normalizeExerciseName(s)` — ~6 tests
- Trim leading/trailing whitespace.
- Colapsa múltiples espacios internos.
- Normaliza tabs y newlines a un solo espacio.
- Preserva la capitalización original (no lowercase).
- String vacío → string vacío.
- Whitespace-only → string vacío.

### `dedupeExercises(items)` — ~6 tests
- Array vacío → `[]`.
- Skip `null` exercise (los auto-log y foto no entran al dedupe).
- Ordena most-recent-first (recorre el array en reversa).
- Dedup case-insensitive.
- Preserva la capitalización del primer match (que es el más reciente).
- Mantiene el orden first-seen entre items únicos.

### Cleanup
- **Borrar `test/smoke.test.ts`** — su existencia tiene sentido solo entre el setup y el primer test real (per decisión #4 del post-mortem de 0027). Vitest re-descubre automáticamente por convención de nombre, así que remover el archivo es suficiente.

## Blocked by

- **0027** (Vitest setup) — los tests usan la infra que 0027 creó.

## Acceptance criteria

- [ ] `npm test` ejecuta y reporta los tests nuevos de `history.ts`, exit 0.
- [ ] `test/smoke.test.ts` borrado (no debe aparecer en `git ls-files`).
- [ ] Cobertura de las 4 funciones: 100% (las funciones son chicas y determinísticas).
- [ ] `npm run build` sigue pasando.
- [ ] `npm run lint` sigue pasando.
- [ ] Cada test tiene un nombre que describe el comportamiento. Formato: `it("returns bar only for empty discs", ...)` o equivalente. NO usar nombres genéricos como "test 1", "edge case".

## Manual end-to-end test

```bash
npm test
# Expect: ~25 tests passed (24+ de history), exit 0
npm run build
# Expect: build pasa, 11/11 static pages
npm run lint
# Expect: 0 errors
```

## Post-mortem (TBD)
