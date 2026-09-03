---
label: feature
status: open
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
