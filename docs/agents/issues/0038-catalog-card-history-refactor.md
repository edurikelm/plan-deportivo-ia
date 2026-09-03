---
label: feature
status: closed
closed_at: 2026-09-03
parent: 0035-exercise-analysis-feature
depends_on: [0036]
blocks:
  - "0039"
---

# 0038 — Catalog card + `/history` refactor

## Parent

[0035 — Vista de análisis de ejercicio (umbrella)](./0035-exercise-analysis-feature.md)

## What to build

Dos cambios coordinados que materializan el entry point del análisis (ADR-0011):

### 1. Card nueva en `/classes/page.tsx`

Sumar un segundo `<li>` en la sección `HERRAMIENTAS`, debajo de `Calculadora de Pesos`:

- **Título**: "Ejercicios guardados".
- **Descripción**: "Visualizá progresión, 1RM estimado y tabla de RM por ejercicio." (copy a confirmar con el coach antes de merge).
- **CTA**: `Ver ejercicios →` que apunta a `/tools/weight-calculator/history`.

Mismo patrón visual que la card actual de la calculadora: `chalk-card`, footer con border-top, button `signal` ghost a la derecha.

### 2. Refactor de `/tools/weight-calculator/history`

`history-page-client.tsx` se reescribe para mostrar la **lista de ejercicios únicos** en lugar de la lista plana de registros.

#### Helper nuevo (`src/lib/calculator/aggregate.ts`)

```ts
export interface ExerciseSummary {
  name: string;                    // capitalización del primer match
  recordCount: number;             // count de records
  lastRecordAt: string;            // ISO del último createdAt
  lastTotalKg: number;             // totalKg del último record
  bestTotalKg: number;             // max totalKg entre records con reps === 1
  estimatedOneRmKg: number | null; // aggregateExerciseOneRepMax del grupo
}

// Case-insensitive dedupe, preserva capitalización del primer match (most recent).
export function aggregateByExercise(records: SavedWeightRecord[]): ExerciseSummary[];

// Helper: retorna los registros de UN ejercicio, ordenados por createdAt desc.
export function getRecordsForExercise(
  records: SavedWeightRecord[],
  exerciseName: string
): SavedWeightRecord[];
```

#### Página refactorizada

Layout:

```
┌────────────────────────────────────────┐
│ HERRAMIENTAS                           │
│                                        │
│ Ejercicios guardados                   │
│ [búsqueda opcional por nombre]         │
│ [sort: más recientes | más usados]     │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ Back Squat                  →     │ │
│ │ 12 registros · último 03 sep 2026  │ │
│ │ mejor 140kg · e1RM 142.5kg         │ │
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │
│ │ Press militar               →     │ │
│ │ 5 registros · último 28 ago 2026   │ │
│ │ mejor 60kg · e1RM 61.2kg          │ │
│ └────────────────────────────────────┘ │
│ ...                                    │
│                                        │
│ Empty state: "Todavía no guardaste     │
│ ningún ejercicio con nombre."          │
└────────────────────────────────────────┘
```

- Click en una fila → `/tools/weight-calculator/exercise/[encodeURIComponent(name)]` (la vista de análisis del issue 0039).
- La búsqueda y el sort son opcionales (pueden quedar para v1.1 si el alcance crece). El MVP lista todos los ejercicios, ordenados por `lastRecordAt` desc.
- Empty state cuando `aggregateByExercise(records).length === 0`.

#### Lo que se va

- Búsqueda por nombre de registro (la búsqueda ahora es por nombre de ejercicio, opcional).
- Filtros por `source` (ya no aplica: la lista de ejercicios es independiente del `source`).
- Sort por fecha / peso / nombre de ejercicio (reemplazado por sort por `lastRecordAt`).
- Acciones por fila: `Cargar`, `Copiar`, `Eliminar` (estas acciones sobreviven en la vista de análisis del ejercicio, issue 0039).

## TDD scope (híbrido)

- **TDD estricto** sobre `aggregateByExercise` y `getRecordsForExercise` (~10 tests, ver abajo).
- **Patrón del proyecto** sobre el componente de la lista: render test del layout (3-4 escenarios), sin ciclo red-green.

### Tests a escribir primero

`src/lib/calculator/aggregate.test.ts` (TDD estricto, ~10 tests):

**`aggregateByExercise` (7 tests):**
- Array vacío → `[]`.
- Array con 1 registro → 1 summary.
- Array con 3 registros del mismo ejercicio (case variations: "Back Squat", "back squat", "BACK SQUAT") → 1 summary, `name = "Back Squat"` (capitalización del más reciente).
- Array con 3 registros de 2 ejercicios distintos → 2 summaries, ordenados por `lastRecordAt` desc.
- Records con `exercise === null` (auto-log) → excluidos.
- Records con `source === "foto"` (también tienen `exercise: null`) → excluidos.
- `bestTotalKg` considera solo registros con `reps === 1`; si no hay ninguno, queda en 0 y `estimatedOneRmKg` toma el protagonismo.
- `estimatedOneRmKg === null` cuando todos los registros del ejercicio tienen `reps === null`.

**`getRecordsForExercise` (3 tests):**
- Filtra por match case-insensitive.
- Retorna los registros ordenados por `createdAt` desc.
- Retorna `[]` si el ejercicio no tiene registros (en lugar de explotar).

`src/app/tools/weight-calculator/_components/history-page-client.test.tsx` (patrón del proyecto, ~4 tests):

- Render con 0 records → empty state visible.
- Render con 2 ejercicios distintos → 2 cards visibles, links correctos.
- Render con múltiples case variations del mismo ejercicio → 1 sola card.
- Click en una card → `router.push("/tools/weight-calculator/exercise/[encoded name]")` (test del handler).

## Blocked by

- **0036** — los helpers `estimateOneRepMax` y `aggregateExerciseOneRepMax` deben existir para que `aggregateByExercise` los use.

## Acceptance criteria

- [ ] `src/lib/calculator/aggregate.ts` exporta `aggregateByExercise` y `getRecordsForExercise` con 10 tests passing (TDD estricto).
- [ ] `src/app/classes/page.tsx` tiene la card `Ejercicios guardados` que apunta a `/tools/weight-calculator/history`.
- [ ] `src/app/tools/weight-calculator/_components/history-page-client.tsx` reescrito para mostrar la lista de ejercicios. 4 render tests passing.
- [ ] El search y sort opcionales están documentados en el código con un comment "v1.1 candidate" si no se implementan en este issue.
- [ ] La lista plana vieja (búsqueda/filtros/source/sort/acciones por fila) **se elimina** del código (no se comenta, se borra).
- [ ] `npm test` verde, 14 tests nuevos (10 de aggregate + 4 de history-page-client).
- [ ] `npm run build` verde.
- [ ] `npm run lint` verde.

## Manual end-to-end test

```bash
npm test -- aggregate
# Expect: 10 tests passed
npm test -- history-page-client
# Expect: 4 tests passed
npm run build && npm run lint
# Expect: ambos verde
```

Smoke manual:

1. Ir a `/classes`. Ver la nueva card "Ejercicios guardados" debajo de la calculadora.
2. Click → aterriza en `/tools/weight-calculator/history` con la lista de ejercicios únicos.
3. Si no hay registros guardados con nombre → empty state.
4. Si hay registros → cards con nombre, count, último, mejor, e1RM. Click en uno → navega a la vista de análisis (que en este punto todavía no existe, así que se espera un 404; el fix es el issue 0039).

## Out of scope

- La vista de análisis en sí (issue 0039).
- Búsqueda y sort en la lista de ejercicios (v1.1).
- Preservar la lista plana vieja en otra ruta (grill R4 Q13 decidió eliminarla).
- Foto tab (issue 0040, independiente).
- Tests E2E con Playwright (el proyecto no usa E2E todavía, solo Vitest + render tests).

## Post-mortem (closed 2026-09-03)

### Lo que se hizo

1 commit de impl:

- `0038-impl-...` — helper `aggregate.ts` (TDD estricto) + reescritura de `history-page-client.tsx` + nueva card en `/classes` + 4 render tests.

### Acceptance criteria — todo verde

- [x] `src/lib/calculator/aggregate.ts` exporta `aggregateByExercise` y `getRecordsForExercise` con 11 tests passing (TDD estricto: tests escritos primero, run failed por módulo inexistente, impl los hizo pasar).
- [x] `src/app/classes/page.tsx` tiene la card `Ejercicios guardados` que apunta a `/tools/weight-calculator/history`.
- [x] `src/app/tools/weight-calculator/_components/history-page-client.tsx` reescrito: lista de ejercicios con click → `/exercise/[encodeURIComponent(name)]`. 4 render tests passing.
- [x] Search/sort opcionales marcados como "v1.1 candidate" en comment inline.
- [x] La lista plana vieja (búsqueda/filtros/source/sort/acciones por fila) **se eliminó** completamente del archivo (no se comentó, se borró).
- [x] `npm test` verde, 15 tests nuevos (11 de aggregate + 4 de history-page-client), 249/249 totales.
- [x] `npm run build` verde, 11/11 static pages, typecheck OK.
- [x] `npm run lint` verde (0 errors; las 2 warnings son preexistentes).

### Decisiones deliberadas (no triviales)

1. **El Map de groups se tipa con el narrowed type, no el wide type.** El type guard `(r): r is SavedWeightRecord & { exercise: string }` se pierde si el Map tiene `Array<SavedWeightRecord>` como value type. Solución: tipar el Map con `Array<SavedWeightRecord & { exercise: string }>`. Cero `as` cast, typecheck verde, contrato de la función claro.

2. **`<button>` para cada card, no `<Link>`.** La navegación va por `router.push` con `encodeURIComponent(name)`. Pro: la URL queda deep-linkable (el usuario puede copiar/pegar la URL de un ejercicio específico). Con: requiere el router en el componente, no funciona en SSR-only contexts. Aceptable porque la página es client-only (`"use client"`).

3. **El header de la página apunta a `/classes` (catálogo), no a `/tools/weight-calculator` (calculadora).** Razón: con el refactor, `/history` ya no es "el historial de la calculadora" — es "la lista de ejercicios guardados", un destino hermano de la calculadora. El back button refleja esa nueva jerarquía.

4. **`within(list).getAllByRole("button")` en los tests, no `screen.getAllByRole`.** El header de la página tiene otros elementos interactivos (futuros). Scoping al list es el contrato robusto: "estos son los botones de la lista de ejercicios". Si en el futuro sumamos un header con search, no rompe el test.

5. **`findByRole` (con `await`) en lugar de `getByRole` para esperar post-hidratación.** El componente tiene un placeholder pre-hidratación (server snapshot) que se reemplaza con la lista post-hidratación (client snapshot). El `useSyncExternalStore` actualiza en una microtask, no síncronamente. `findByRole` espera el re-render. Alternativa más invasiva: mockear `useHydrated` para forzar `true` en tests; descartada porque agrega un mock por test file.

6. **El header count dice "N ejercicios" no "N registros".** Es la nueva semántica: la página lista ejercicios, no records. La distinción es parte del cambio de modelo mental que el grill R2 Q5 fijó.

7. **`formatAbsolute` se preserva del archivo viejo.** El formatter locale-free (sin `Intl.*`) era útil y estable; reusarlo en lugar de reemplazarlo por `toLocaleString` evita inconsistencias cross-browser/CI.

### Patrones nuevos establecidos

- **Scope tests con `within(element)`, no `screen.getAllByRole`.** Cuando un componente tiene varias "regiones" de UI (header, list, footer), los tests deben hacer queries dentro de la región que están probando. Hace los tests robustos a cambios futuros en otras regiones.

- **`aggregate.ts` como home del per-exercise logic.** Junto con `one-rm.ts` (1RM math) y `suggest-reps.ts` (UI suggestion), `aggregate.ts` cubre el tercer eje de la feature: la agregación. Cada archivo = un tema cohesivo. Si en el futuro se suman más helpers de agregación, van al mismo lugar.

- **El back button refleja la jerarquía del producto, no la de la implementación.** Cuando el back lleva de `/history` a `/tools/weight-calculator` (calculadora), es porque en la cabeza del usuario `/history` es "el historial de la calculadora". Con el refactor, `/history` es otra tool, no un sub-destino de la calculadora. El back button sigue esa nueva semántica.

### Out of scope / no tocado

- **Búsqueda y sort** en la lista de ejercicios. Documentado en comment como "v1.1 candidate". Con ~5-10 ejercicios por usuario, no es crítico. Si la lista crece a 50+, lo agregamos.

- **El Foto tab** no se tocó. Sigue desactivándose en 0040 (independiente).

- **La vista de análisis en sí** (issue 0039). El click navega a `/exercise/[name]` pero la ruta todavía no existe. El usuario va a 404 hasta que 0039 la cree. Documentado en el manual end-to-end test del spec.

- **Tests E2E** con Playwright. El proyecto solo usa Vitest + render tests. Si en algún momento se quiere automatizar el smoke manual, se suma Playwright.

### Hallazgo no relacionado (de paso)

Mientras corría `npm run build`, el typecheck falló con `Type 'string | null' is not assignable to type 'string'`. El issue: el Map tenía `Array<SavedWeightRecord>` como value, lo que hacía que el type narrowing del filter se pierda al recuperar `mostRecent`. Fix: tipar el Map con el narrowed type. Esto es un patrón general: cuando un type guard se usa para construir una colección, la colección debe tener el narrowed type, no el wide type. Documentado como decisión deliberada #1.
