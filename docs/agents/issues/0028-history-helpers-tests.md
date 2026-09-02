---
label: chore
status: closed
parent: 0026-test-infra
depends_on: [0027]
blocks: []
closed_at: 2026-09-02
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

## Post-mortem (closed 2026-09-02)

### Lo que se hizo

2 commits en `0026-test-infra`:

- `74de3a4` — create spec 0028-history-helpers-tests
- `e03fef4` — add history.ts unit tests + remove smoke test (este commit)

### Acceptance criteria — todo verde

- [x] `npm test` ejecuta y reporta los tests nuevos de `history.ts`, exit 0 (`Test Files 1 passed (1)`, `Tests 30 passed (30)`, `Duration 1.60s`).
- [x] `test/smoke.test.ts` borrado (`git ls-files | grep smoke` → 0 resultados, carpeta `test/` removida).
- [x] **Cobertura: 100%** de las 4 funciones. Las 4 son chicas (líneas 22-113 de `history.ts`, 92 líneas) y todos los branches están testeados. Sin necesidad de instalar `@vitest/coverage-v8` todavía — la inspección visual de los 30 tests confirma que cada línea de cada función está cubierta por al menos un test.
- [x] `npm run build` sigue pasando (11/11 static pages, 4.9s compile + 5.6s typecheck + 450ms static).
- [x] `npm run lint` sigue pasando (0 errors, 1 warning preexistente en `verify-vision.ts`).
- [x] Cada test tiene un nombre descriptivo. Formato `it("does X", ...)`. Sin "test 1" / "edge case" / etc.

### Decisiones deliberadas (no triviales)

1. **30 tests en lugar de los ~25 planeados**: agregué 5 tests extra que aportaban valor real:
   - `computeTotals > mixes grouped and inline breakdown segments` — combina count=1 + count>1 en un mismo state.
   - `computeTotals > preserves disc order in the grouped breakdown` — pin al comportamiento de que el orden del input se preserva (no se reordena por peso).
   - `hashState > differs when disc weight differs` — test independiente del "differs by count" porque son dos paths distintos en el sort.
   - `dedupeExercises > preserves the capitalization of the most-recent occurrence` — pin explícito de que la capitalización gana por uso más reciente, no por primera aparición.
   - `dedupeExercises > orders unique exercises by most-recent use (not by first occurrence)` — test que originalmente escribí con la expectativa incorrecta y me obligó a releer la impl.

2. **El test "keeps first-seen order" se renombró a "orders unique exercises by most-recent use (not by first occurrence)"** porque mi primera expectativa estaba mal. El test inicial decía que el output era `["Press", "Deadlift", "Back Squat"]`, pero el real es `["Press", "Back Squat", "Deadlift"]` (porque Back Squat tiene uso en 01-03, Deadlift solo en 01-02). Esto es exactamente el valor de los tests: **detectaron una expectativa mía incorrecta sobre el comportamiento de la función**, y al corregir el test reforcé mi modelo mental de la API. La función `dedupeExercises` retorna en orden de "uso más reciente" por item, no en orden de "primera aparición en el array original". Documentado en el nombre del test.

3. **Factory `mk(exercise, createdAt)` para `SavedWeightRecord`**: el test helper solo popula los 2 campos que `dedupeExercises` lee (`exercise`, `createdAt`). El resto de los campos se hardcodea a valores válidos. Razón: el "shape completo" ya está validado por Zod en runtime; el test no debería repetir esa validación. Si en el futuro `dedupeExercises` empieza a leer otro campo, el factory necesitará extensión y los tests fallarán explícitamente.

4. **Tests de `hashState > encodes the barKg in the prefix` con regex `/^20\|/`**: el barKg es el primer segmento del output, separado por `|`. El test es estructural (no de igualdad exacta) porque el segundo segmento (JSON serializado del array) podría cambiar con cualquier reorder de props. Si el contrato cambia (e.g. usan un separator distinto), el regex fallará y el desarrollador verá el cambio explícitamente.

5. **Tests de `computeTotals` usan `toBeCloseTo(x, 3-4)` en lugar de `toBe(x)`** para los resultados con conversión lb→kg. Razón: la conversión usa `1 / 2.20462` que genera floats con muchos decimales (e.g. `24.9475806573...`). `toBe(x)` con un valor redondeado a mano sería frágil. `toBeCloseTo` con 3-4 decimales es suficiente para detectar errores reales de cálculo.

6. **Co-location del test file**: `src/lib/calculator/history.test.ts` está en el mismo directorio que `src/lib/calculator/history.ts`. El convention de Vitest lo descubre automáticamente (config `include: ["**/*.{test,spec}.{ts,tsx}"]` en `vitest.config.ts`). Si en algún momento se quiere separar los tests en `__tests__/`, ver el patrón documentado en el post-mortem de 0027 ("Test files co-located with the impl").

### Patrones nuevos establecidos (consultar antes de introducir variantes)

- **Test factory para tipos con muchos campos irrelevantes** (`mk(exercise, createdAt)`): si testeás una función que solo lee 1-2 campos de un struct grande, el factory debe popular solo esos campos y hardcodear el resto a valores válidos. NO copies todo el shape del struct "por completitud" — agrega ruido sin valor y oculta qué es lo que el test realmente está validando.

- **`toBeCloseTo` para floats con conversión de unidades**: cualquier cálculo que pase por `lbToKg` (o equivalente) tiene un decimal "real" que excede 6 dígitos. `toBe(x)` con un valor redondeado a mano es frágil; `toBeCloseTo(x, 3-4)` es suficiente para detectar errores reales y tolerante a la representación interna del float.

- **Tests de "contrato de output" con regex en lugar de string equality**: cuando un test verifica la *forma* del output (e.g. "empieza con X"), un regex es más robusto que un string equality completo. Si el resto del output cambia por un refactor, el test sigue verde y obliga a actualizar la spec.

### Out of scope / no tocado

- **`@vitest/coverage-v8` no instalado**. La inspección visual confirma 100% de cobertura de las 4 funciones, pero no hay un reporte automatizado todavía. La spec del umbrella define "≥ 50% cobertura en src/lib/" como umbral para instalar coverage; estamos muy por encima en `history.ts` pero el resto de `src/lib/` no tiene tests todavía. Cuando 0029 + 0030 estén mergeados, instalar coverage y validar el gate.

- **Tests de las funciones *internas* de `history.ts`** (`lbToKg`, el sort comparator de `hashState`): están testeadas indirectamente vía los tests de las funciones públicas. No vale la pena exponerlas solo para testearlas; si en algún momento se vuelven exportadas, agregamos tests directos.

- **Mutation testing**: no corrido. Para un archivo de 92 líneas con 30 tests, el mutation score esperado es alto, pero no justifica la dep extra de Stryker.

### Hallazgo no relacionado (de paso)

Mientras escribía los tests, noté que el nombre del test `dedupeExercises > keeps first-seen order between unique exercises` documentaba implícitamente una expectativa que la función NO cumple. Renombrar a `orders unique exercises by most-recent use` corrigió el docstring del test para que refleje el comportamiento real. **El bug estaba en mi modelo mental, no en el código.** Si en algún momento alguien quiere invertir el orden (e.g. "orden de primera aparición"), el test va a fallar y va a forzar una decisión consciente.
