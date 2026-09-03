---
label: feature
status: open
parent: 0035-exercise-analysis-feature
depends_on: [0036]
blocks: []
---

# 0037 — Save form: `reps` + `Marcar 1RM`

## Parent

[0035 — Vista de análisis de ejercicio (umbrella)](./0035-exercise-analysis-feature.md)

## What to build

Extender el `SaveRecordForm` (form inline del footer sticky de la calculadora) con dos campos nuevos:

1. **Input `Repeticiones`** — number, entero ≥ 1, obligatorio. Default sugerido: 1 si el último set del mismo ejercicio fue `reps = 1`, o 5 si fue `> 1`. Justificación: el coach que viene de hacer singles típicamente va a hacer más singles; el que viene de triples/5s probablemente repite el rango.
2. **Checkbox `Marcar como 1RM`** — boolean, opcional, default `false`. Mapea directo a `isOneRepMax` en el `SavedWeightRecord`.

Además: el botón `Guardar` queda disabled si `reps < 1` (suma a la validación existente de `exercise.trim() !== ""`).

## Cambios en archivos

### `src/app/tools/weight-calculator/_components/save-record-form.tsx`

Sumar al state local:

```ts
const [reps, setReps] = useState<number>(suggestedReps);
const [isOneRepMax, setIsOneRepMax] = useState<boolean>(false);
```

Sumar al `useEffect` que sugiere el default:

```ts
const lastRecordForExercise = records
  .filter((r) => r.exercise?.toLowerCase() === exercise.trim().toLowerCase())
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

const suggestedReps = lastRecordForExercise?.reps && lastRecordForExercise.reps > 1
  ? Math.max(5, lastRecordForExercise.reps)
  : 1;
```

Sumar el `reps` y `isOneRepMax` al payload de `onSubmit`.

### `src/lib/calculator/index.ts`

Re-exportar `suggestRepsForExercise(records, exercise): number` (helper puro extraído del useEffect, testeable en aislamiento). Se testea en este issue y se reusa en la vista de análisis (0039) si hace falta.

## TDD scope (híbrido)

- **TDD estricto** sobre el helper `suggestRepsForExercise` (~6 tests, ver abajo).
- **Patrón del proyecto** sobre el form component: render test con un snapshot del form con/sin error de validación, sin ciclo red-green (testing-library + jsdom).

### Tests a escribir primero

`src/lib/calculator/suggest-reps.test.ts` (TDD estricto, ~6 tests):

- Sin registros previos para el ejercicio → retorna 1.
- Último registro con `reps === 1` → retorna 1.
- Último registro con `reps === 3` → retorna 5 (sube al mínimo "rango de hipertrofia").
- Último registro con `reps === 8` → retorna 8 (no baja).
- Match case-insensitive: `exercise = "back squat"` matchea records con `"Back Squat"`.
- Records sin `exercise` (auto-log legacy) se ignoran, no influyen en la sugerencia.

`src/app/tools/weight-calculator/_components/save-record-form.test.tsx` (patrón del proyecto, ~4 tests):

- Render con state inicial: muestra input `Ejercicio`, input `Repeticiones` (default 1), checkbox `Marcar como 1RM` (default unchecked).
- Submit con `reps === 0` → no llama `onSubmit`, muestra mensaje de error.
- Submit con `reps === 5 && exercise === "Back Squat"` → llama `onSubmit({ reps: 5, exercise: "Back Squat", isOneRepMax: false, ... })`.
- Submit con checkbox `Marcar como 1RM` checked → llama `onSubmit({ ..., isOneRepMax: true })`.

## Blocked by

- **0036** — el schema extendido con `reps` y `isOneRepMax` debe existir para que el form pueda pasar esos campos al `addRecord`.

## Acceptance criteria

- [ ] `src/lib/calculator/suggest-reps.ts` exporta `suggestRepsForExercise` con 6 tests passing (TDD estricto).
- [ ] `save-record-form.tsx` extendido con input `Repeticiones` y checkbox `Marcar como 1RM`. Render test cubre los 4 escenarios.
- [ ] El botón `Guardar` queda disabled si `reps < 1` o `exercise.trim() === ""` (suma a la validación existente).
- [ ] El toast de éxito sigue apareciendo al guardar; el form se cierra y el mini-panel se actualiza via storage event.
- [ ] `npm test` verde, 10 tests nuevos (6 de suggest-reps + 4 de save-record-form).
- [ ] `npm run build` verde.
- [ ] `npm run lint` verde.
- [ ] Cero cambio en el storage key. El `addRecord` se llama con el shape extendido.

## Manual end-to-end test

```bash
npm test -- suggest-reps
# Expect: 6 tests passed
npm test -- save-record-form
# Expect: 4 tests passed
npm run build && npm run lint
# Expect: ambos verde
```

Smoke manual en `/tools/weight-calculator`:

1. Sin registros previos para "Back Squat" → el form sugiere `Reps: 1`.
2. Guardar un set de "Back Squat" con 5 reps. Volver a abrir el form → sugiere `Reps: 5`.
3. Tildar `Marcar como 1RM` → guardar → ver en `/history` (cuando esté refactorizado) que el registro tiene `isOneRepMax: true`.
4. Intentar submit con `reps: 0` → el botón queda disabled, no se persiste nada.

## Out of scope

- El Foto tab. Está desactivado en el issue 0040 y no captura reps. Cuando se reactive, se reconsidera.
- Edición de un registro ya guardado (cambiar `reps` o `isOneRepMax` post-guardado). Eso vive en la vista de análisis (issue 0039).
- RPE, RM calculation por fórmula distinta a Epley (issue 0036 lo deja hardcodeado).
