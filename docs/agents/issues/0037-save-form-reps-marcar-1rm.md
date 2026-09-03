---
label: feature
status: closed
closed_at: 2026-09-03
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

## Post-mortem (closed 2026-09-03)

### Lo que se hizo

1 commit de impl:

- `0037-impl-...` — helper `suggestRepsForExercise` (TDD estricto) + form actualizado + tests de render (4).

### Acceptance criteria — todo verde

- [x] `src/lib/calculator/suggest-reps.ts` exporta `suggestRepsForExercise` con 8 tests passing (TDD estricto: tests escritos primero, corridos, fallaron por módulo inexistente, impl los hizo pasar).
- [x] `save-record-form.tsx` extendido con input `Repeticiones` (number, default desde sugerencia) y checkbox `Marcar como 1RM`. Render test cubre los 4 escenarios: render inicial, submit con reps=0, submit con reps=5, submit con flag checked.
- [x] El botón `Guardar` queda disabled si `reps < 1` o `exercise.trim() === ""`. Validación numérica: `Number.isFinite(reps) && reps >= 1`.
- [x] El toast de éxito sigue apareciendo al guardar; el form se cierra vía `onSaved`.
- [x] `npm test` verde, 12 tests nuevos (8 de suggest-reps + 4 de save-record-form), 234/234 totales.
- [x] `npm run build` verde, 11/11 static pages, typecheck OK.
- [x] `npm run lint` verde (0 errors; las 2 warnings son preexistentes en `coverage/block-navigation.js` y `scripts/verify-vision.ts`).
- [x] El payload persistido incluye `reps: Math.trunc(reps)` (defensivo contra decimales) y `isOneRepMax` boolean.

### Decisiones deliberadas (no triviales)

1. **El form lee records vía `getRecords()` en su `useState` lazy initializer, no vía prop ni subscription.** El spec original planteaba pasar `records` como prop, pero eso requiere que el padre (calculator-client) mantenga una subscription a `pd:calculator-records` sólo para alimentar el form — overhead para un form que vive pocos segundos en pantalla. La alternativa: el form hace `getRecords()` una vez al montar. Tradeoff: si el coach abre el form, en otra tab alguien guarda un record, el form no se entera. Pero el form no necesita enterarse: la sugerencia es un one-shot, no un live binding. Si el coach quiere la sugerencia fresca, cierra y reabre el form. Esta decisión reduce el scope del issue a 2 archivos cambiados (form + helper), sin tocar el calculator-client ni el storage layer.

2. **`Math.trunc(reps)` al persistir.** El input es `type="number" step={1}` pero el coach podría usar flechas o scroll para llegar a 1.5. Truncar al guardar evita que `reps: 1.5` llegue al storage (lo cual Zod rechazaría después). Es defensivo y barato.

3. **`aria-invalid` en el input de reps** cuando `repsValid === false`. Da feedback al screen reader sobre el estado de validación sin necesidad de un mensaje inline. El `aria-[invalid=true]:border-signal` de Tailwind lo visualmente marca con el color de acento.

4. **El default de reps se aplica una sola vez, en el lazy initializer de `useState`.** Decisión explícita: si el coach tipea un ejercicio distinto en el form, las reps NO se sobreescriben. Razón: el coach podría estar en medio de tipear "Press militar" y el form ya prellenó 5 reps basándose en "Press banca"; si re-sugiriera en cada keystroke, el campo reps bailaría. El precio: el coach tiene que borrar y re-tipear si quiere que el form le sugiera reps para un nuevo ejercicio. Aceptable porque el form es corto-lived y la sugerencia es un nice-to-have.

5. **`onChange` del reps input maneja string vacío como `NaN`.** HTML number inputs nativos pueden tener `value === ""` cuando el coach borra el campo. Convertir a `NaN` mantiene el invariant de `reps` como `number` (no `string | number`), y `repsValid = Number.isFinite(reps) && reps >= 1` lo detecta correctamente para deshabilitar el submit.

6. **No agregué `useId` para `flagId` por accidente — sí lo hice.** La id se usa para el `htmlFor` del label del checkbox. Es requerido para a11y (asociar label con input).

### Patrones nuevos establecidos

- **`getRecords()` desde componentes short-lived** (form, modal, drawer): aceptable para one-shot reads. NO usar en componentes long-lived (la subscription `useSyncExternalStore` es la opción correcta cuando los datos deben estar vivos). La distinción es "el dato es relevante sólo mientras el componente está montado" vs "el dato es relevante siempre que el componente está montado".

- **TDD helper puro + render test del componente, ambos en el mismo issue:** confirma el seam correcto (helper testeable aislado + form testeable como integration). Si el helper fuera más complejo, lo valdría separar en un issue propio. Acá el helper es 5 líneas, así que el overhead de un issue separado no se justifica.

### Out of scope / no tocado

- **No agregué `subscribeToRecords` a `lib/storage.ts`:** el form no necesita reactividad, así que el helper no se justifica. Si en el futuro (0039, vista de análisis) hace falta, lo agregamos.
- **El `defaultExercise` no propaga un `defaultReps`:** el form computa su propia sugerencia al montar, leyendo `getRecords()` directamente. Mantiene la API del form simple (no prop nuevo).
- **El Foto tab no se tocó.** Sigue intacto, sigue desactivándose en 0040.

### Hallazgo no relacionado (de paso)

El test del form inicialmente falló con "Found multiple elements with the placeholder text of: Ej. Back Squat" — `cleanup()` no estaba siendo llamada explícitamente. Agregué `afterEach(cleanup)` después de ver el patrón en `recent-activity-banner.test.tsx`. Documenté el rationale inline en el test. La regla operativa: cuando un test file tiene múltiples `render()` en el mismo file (incluso en distintos `it()`), `cleanup()` debe ser explícito en `afterEach` como safety net. La auto-cleanup de `@testing-library/react` debería cubrirlo, pero en este proyecto la convención es explícita.
