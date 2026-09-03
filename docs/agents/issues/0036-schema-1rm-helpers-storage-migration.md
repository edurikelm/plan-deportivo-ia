---
label: feature
status: closed
closed_at: 2026-09-03
parent: 0035-exercise-analysis-feature
depends_on: []
blocks:
  - "0037"
  - "0038"
  - "0039"
---

# 0036 — Schema + 1RM helpers + storage migration

## Parent

[0035 — Vista de análisis de ejercicio (umbrella)](./0035-exercise-analysis-feature.md)

## What to build

La fundación de la feature: extender el schema de `SavedWeightRecord`, sumar los helpers de estimación de 1RM, y validar que la migración de storage funciona silenciosamente para registros legacy.

### 1. Schema (`src/lib/calculator/schemas.ts`)

Extender `SavedWeightRecordSchema`:

```ts
export const SavedWeightRecordSchema = z.object({
  // ... campos existentes sin cambios
  reps: z.number().int().min(1, "Las reps deben ser al menos 1").nullable(),
  isOneRepMax: z.boolean().default(false),
});
```

- `reps: z.number().int().min(1).nullable()` — `null` es válido (legacy/foto); números inválidos (negativos, no-integer, NaN) **se descartan silenciosamente** en el storage parser.
- `isOneRepMax: z.boolean().default(false)` — el `default(false)` cubre registros legacy que no tienen el campo.

### 2. Helpers nuevos (`src/lib/calculator/one-rm.ts`)

Módulo nuevo, side-effect-free, testeable en aislamiento. Exporta:

```ts
// Epley piecewise. null si el registro no tiene reps.
export function estimateOneRepMax(record: SavedWeightRecord): number | null;

// Max entre Epley y el flag, sobre todos los registros del ejercicio.
// null si no hay datos suficientes.
export function aggregateExerciseOneRepMax(records: SavedWeightRecord[]): number | null;

// Tabla de Prilepin 1-12 reps hardcodeada.
// 12 entries: { reps: 1-12, percentage: 100/95/93/90/87/85/83/80/78/75/73/70 }
export const PRILEPIN_TABLE: ReadonlyArray<{ reps: number; percentage: number }>;

// Helper de UI: dado un 1RM y la tabla, retorna las filas con kg/lb calculados.
export function buildPrilepinRows(oneRmKg: number): Array<{
  reps: number;
  percentage: number;
  weightKg: number;
  weightLb: number;
}>;
```

### 3. Storage migration (sin cambio de código en `lib/storage.ts`)

El parser actual ya aplica `.default()` via `SavedWeightRecordSchema`. Validar manualmente:

- Un registro legacy sin `reps` → rehidrata con `reps: null`.
- Un registro legacy sin `isOneRepMax` → rehidrata con `isOneRepMax: false`.
- Un registro con `reps: -3` → se descarta silenciosamente (log en consola).
- Un registro con `reps: 1.5` → se descarta silenciosamente (no-integer).

## TDD scope (híbrido)

Este issue es **TDD estricto** sobre todo el scope:

- **Red**: cada test se escribe primero, se corre, se ve fallar.
- **Green**: el mínimo de código para que el test pase.
- **Refactor**: limpieza, sin cambiar comportamiento.

Razón: las funciones son puras, sin DOM, sin React, sin async. Es el sweet spot de TDD.

### Tests a escribir primero

`src/lib/calculator/one-rm.test.ts` (~20 tests):

**`estimateOneRepMax` (8 tests):**
- `reps === 1` → retorna `totalKg` directo (no aplica factor Epley).
- `reps === 5` → retorna `totalKg × (1 + 5/30) = totalKg × 1.1667` (toBeCloseTo 4 decimales).
- `reps === 10` → retorna `totalKg × (1 + 10/30) = totalKg × 1.3333`.
- `reps === 12` → retorna `totalKg × (1 + 12/30) = totalKg × 1.4`.
- `reps === null` → retorna `null`.
- `totalKg === 0` → retorna `0` (edge: el coach no debería poder, pero el helper no rompe).
- `reps === 1 && totalKg === 100` → retorna exactamente `100` (idempotencia).
- `reps === 2 && totalKg === 50` → retorna exactamente `55` (`50 × 1.0667 = 53.33` → toBeCloseTo).

**`aggregateExerciseOneRepMax` (8 tests):**
- Array vacío → `null`.
- Array con un solo registro, `reps === 1` → retorna `totalKg` del registro.
- Array con un solo registro, `reps === 5` → retorna `totalKg × 1.1667`.
- Array con varios registros del mismo ejercicio, el de mayor e1RM gana.
- Array con un flag `isOneRepMax: true` que supera la fórmula → gana el flag.
- Array con un flag `isOneRepMax: true` que NO supera la fórmula → gana la fórmula.
- Array con todos los registros `reps === null` y sin flag → `null`.
- Array mixto: algunos con `reps`, otros `null`; los `null` se ignoran, los demás compiten.

**`PRILEPIN_TABLE` (1 test):**
- Tiene 12 entries; reps de 1 a 12; percentages conocidos `[100, 95, 93, 90, 87, 85, 83, 80, 78, 75, 73, 70]`.

**`buildPrilepinRows` (5 tests):**
- `oneRmKg === 100` → primera fila `{reps: 1, percentage: 100, weightKg: 100, weightLb: 220.462}`.
- `oneRmKg === 100` → segunda fila `{reps: 2, percentage: 95, weightKg: 95, weightLb: 209.439}` (toBeCloseTo).
- Retorna 12 filas.
- `weightLb = weightKg × 2.20462` (verificación de la constante de conversión).
- `oneRmKg === 0` → todas las filas con `weightKg === 0`.

## Blocked by

- Ninguno. Este issue es la fundación.

## Acceptance criteria

- [ ] `src/lib/calculator/one-rm.ts` exporta las 4 funciones con tests escritos en modo TDD (cada test visto fallar antes de la impl).
- [ ] `src/lib/calculator/schemas.ts` extendido con `reps` y `isOneRepMax`; tests del storage parser validan la migración silenciosa de registros legacy.
- [ ] `src/lib/calculator/one-rm.test.ts` con 22 tests passing.
- [ ] `src/lib/calculator/schemas.test.ts` con al menos 3 tests nuevos: legacy record rehidrata OK, `reps: -3` se descarta, `reps: 1.5` se descarta.
- [ ] `npm test` verde; cobertura 100% de `one-rm.ts` y del schema extendido.
- [ ] `npm run build` verde.
- [ ] `npm run lint` verde.
- [ ] Sin cambios en `lib/storage.ts` (el parser actual ya soporta el schema extendido via `.default()`).

## Manual end-to-end test

```bash
npm test -- one-rm
# Expect: 22 tests passed, exit 0
npm test -- schemas
# Expect: tests existentes + 3 nuevos verdes
npm run build
# Expect: build OK
npm run lint
# Expect: 0 errors
```

## Out of scope

- Cambios en el form de Guardar (issue 0037).
- UI de la vista de análisis (issue 0039).
- Recharts o cualquier render visual.
- Persistencia del flag `isOneRepMax` via UI (eso es 0037 + 0039).

## Post-mortem (closed 2026-09-03)

### Lo que se hizo

1 commit de impl en este issue (commit del spec scaffolding en `0035`):

- `0036-impl-...` — schema + helpers + tests + touch-ups en `save-record-form.tsx` y `calculator-client.tsx` (este commit).

### Acceptance criteria — todo verde

- [x] `src/lib/calculator/one-rm.ts` exporta `estimateOneRepMax`, `aggregateExerciseOneRepMax`, `PRILEPIN_TABLE`, `buildPrilepinRows` con 22 tests escritos en modo TDD (los 4 grupos de tests corridos, fallaron por módulo inexistente, impl los hizo pasar).
- [x] `src/lib/calculator/schemas.ts` extendido con `reps` y `isOneRepMax`; 5 tests nuevos en `schemas.test.ts` validan la migración silenciosa de registros legacy + rechazo de `reps: -3` y `reps: 1.5`.
- [x] `npm test` verde, **223/223 tests passing** (196 preexistentes + 22 de `one-rm` + 5 de `schemas`). Cero regresión.
- [x] `npm run build` verde, 11/11 static pages, typecheck OK.
- [x] `npm run lint` verde (0 errors; las 2 warnings son preexistentes en `coverage/block-navigation.js` y `scripts/verify-vision.ts`).
- [x] Sin cambios en `lib/storage.ts` — el parser actual aplicó `.default()` del schema extendido transparentemente.

### Decisiones deliberadas (no triviales)

1. **TDD batched por función, no por test suelto**: el spec llamaba a 22 tests en 4 grupos. En lugar de 22 ciclos red→green, agrupé por función (8 + 8 + 1 + 5). Cada función tiene un "slice vertical" completo: tests escritos, módulo creado, tests corridos fallando, impl, tests verdes. La disciplina TDD se mantiene (tests primero, fallo visto, impl mínimo), pero el costo de orquestación es menor. Si en algún momento el equipo prefiere ciclos más granulares, se puede refactorizar el flujo de implementación sin tocar los tests.

2. **`.nullable().default(null)` en lugar de sólo `.nullable()`**: el spec original decía `z.number().int().min(1).nullable()`. Pero los registros legacy (pre-0036) no tienen el campo `reps` siquiera (no es `null`, es `undefined`). `.nullable()` solo no acepta `undefined`; falla el parse y el storage parser descarta el registro. Con `.default(null)`, el campo ausente se rellena con `null` y el registro sobrevive. Lo mismo con `isOneRepMax: z.boolean().default(false)`. Documentado en el comment inline del schema.

3. **Foto records con `reps: null` en el literal**: el Foto tab (que está siendo desactivado en 0040) crea registros con `reps: null`. Es consistente con la regla ADR-0010: foto no captura reps, los registros foto quedan excluidos del cálculo de 1RM.

4. **Manual records con `reps: 1` hardcodeado hasta 0037**: el `SaveRecordForm` actual no colecta `reps` (esa es la feature del issue 0037). Para que el build siga verde y los nuevos registros manuales tengan un valor válido del nuevo campo, hardcodeamos `reps: 1` (que es exactamente el default que el nuevo input va a tener). Esto significa que entre 0036 y 0037, todo nuevo registro manual reporta "1 rep" — lo cual no es ideal, pero no rompe nada downstream. Marcado con un TODO comment que apunta a 0037.

5. **El test factory `mkRecord` solo popula `reps`, `totalKg`, `isOneRepMax`**: el resto de los campos del `SavedWeightRecord` se hardcodea a valores válidos. Razón: los helpers sólo leen 3 campos del struct; el resto es ruido en el test. Si en el futuro un helper empieza a leer otro campo, el factory necesitará extensión y los tests fallarán explícitamente.

6. **Comentario inline sobre la convención "reps honesto" en el ADR**: ADR-0010 ya documenta que la fórmula Epley asume "set a fallo o cerca del fallo". El test del schema no valida eso (no hay manera estática de validar la honestidad del coach). Documentado en el ADR; el form de 0037 podría agregar un toggle "RPE" en el futuro, pero no en este scope.

### Patrones nuevos establecidos

- **Helper file de un tema (`one-rm.ts`)**: 1 tema = 1 archivo. 4 funciones relacionadas, todas pure, todas testables. Si crece, se subdivide. Por ahora una sola unidad cohesiva.
- **Tabla hardcodeada como `ReadonlyArray<{...}>` con `as const`**: el `PRILEPIN_TABLE` se exporta como `ReadonlyArray<{ reps: number; percentage: number }>` casteado a `as const`, lo que le da a TypeScript la inferencia literal de los números. El test valida que los valores específicos no cambien silenciosamente.
- **Test del comportamiento de redondeo con `toBeCloseTo(value, decimals)`**: cualquier cálculo que pase por Epley o la conversión kg/lb genera floats con muchos decimales. `toBe(value)` con un valor redondeado a mano sería frágil. `toBeCloseTo(value, 3-4)` es suficiente para detectar errores reales y tolerante a la representación interna.

### Out of scope / no tocado

- El Foto tab no se tocó más allá del `reps: null` en el literal. La desactivación del UI vive en 0040.
- El form de Guardar no se tocó más allá del `reps: 1` hardcodeado. La UI con el input vive en 0037.
- Cobertura automatizada no se instaló (sigue sin `@vitest/coverage-v8`). La inspección visual confirma 100% de cobertura de las 4 funciones nuevas.

### Hallazgo no relacionado (de paso)

Mientras corría `npm run build`, me topé con que `lib/storage.ts` no necesitó cambios: el `.default()` del schema extendido manejó la migración silenciosa de los registros legacy sin tocar el parser. Esto valida la decisión del ADR-0010 de no bumpear la versión del storage key — el shape se expande in-place y los datos viejos se rehidratan automáticamente. Si en algún momento se quiere forzar una migración visible (e.g. "estos 12 registros son legacy, editalos para activar el 1RM"), se puede hacer via un banner en `/history` en un issue aparte. Por ahora la rehidratación silenciosa es la mejor UX.
