---
label: feature
status: closed
parent: 0035-exercise-analysis-feature
depends_on: [0036, 0038]
blocks: []
---

# 0039 — Analysis view: Recharts + Prilepin

## Parent

[0035 — Vista de análisis de ejercicio (umbrella)](./0035-exercise-analysis-feature.md)

## What to build

La vista de análisis por ejercicio: ruta nueva `/tools/weight-calculator/exercise/[name]` con 3 charts Recharts, tabla de Prilepin, y lista del ejercicio con acciones.

### Estructura de archivos

```
src/app/tools/weight-calculator/exercise/
├── [name]/
│   ├── page.tsx                          (server shell, exporta metadata)
│   └── _components/
│       └── analysis-page-client.tsx      (client-only, toda la lógica)
```

### Dependencia nueva

Sumar `recharts` a `package.json`:

```json
{
  "dependencies": {
    "recharts": "^2.13.0"
  }
}
```

(Verificar la última versión estable en npm al momento de la impl. Si la versión cambió significativamente, actualizar el snippet de código соответственно.)

### Layout de la página

```
┌──────────────────────────────────────────────────────────────┐
│ ← Volver · Back Squat                              [edit]   │
│ 12 registros · 1RM estimado 142.5kg · último 03 sep 2026    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐             │
│  │ Progresión  │ │  Volumen    │ │  e1RM       │             │
│  │ (LineChart) │ │ (BarChart)  │ │ (LineChart) │             │
│  │ totalKg     │ │ totalKg×    │ │ rolling     │             │
│  │ vs fecha    │ │ reps        │ │ 3 últimos   │             │
│  └─────────────┘ └─────────────┘ └─────────────┘             │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  (main column en desktop)          (sidebar sticky 18rem)   │
│                                                              │
│  Historial del ejercicio            Tabla de RM (Prilepin)  │
│  ┌─────────────────────────┐        ┌─────────────────────┐  │
│  │ 03 sep · 140kg × 1      │        │ Reps │ %    │ kg   │  │
│  │ ⭐ 1RM     [Cargar]     │        │ 1    │ 100% │ 142  │  │
│  │ [Eliminar]              │        │ 2    │ 95%  │ 135  │  │
│  ├─────────────────────────┤        │ 3    │ 93%  │ 133  │  │
│  │ 28 ago · 135kg × 3      │        │ ...  │ ...  │ ...  │  │
│  │ [Cargar]                │        └─────────────────────┘  │
│  │ [Eliminar]              │                                 │
│  ├─────────────────────────┤                                 │
│  │ ...                     │                                 │
│  └─────────────────────────┘                                 │
└──────────────────────────────────────────────────────────────┘
```

### Componentes

#### 1. `AnalysisPageClient` (entry)

- Lee `params.name` (Next.js dynamic route), `decodeURIComponent`.
- Suscribe a `pd:calculator-records` via `useSyncExternalStore` (mismo patrón que `history-page-client.tsx`).
- Llama `getRecordsForExercise(records, name)` para obtener los registros del ejercicio.
- Llama `aggregateExerciseOneRepMax(records)` para el 1RM.
- Si `records.length === 0` → empty state "No hay registros para este ejercicio".
- Si `1RM === null` (todos los records tienen `reps === null`) → empty state parcial "Marcá tus reps en el historial para calcular el 1RM" + link al historial.
- Si `records.length === 1` → muestra el 1 chart, los otros 2 con copy "Necesitás ≥ 2 registros para ver progresión".

#### 2. `ProgressionChart` (LineChart)

- X: `createdAt` (formateado como fecha corta).
- Y: `totalKg`.
- Tooltip: muestra `totalKg` y `reps` del punto.
- Color: `signal` (color de acento del design system).

#### 3. `VolumeChart` (BarChart)

- X: `createdAt`.
- Y: `totalKg × reps`.
- Tooltip: muestra el cálculo y los inputs.

#### 4. `EstimatedOneRmChart` (LineChart, rolling)

- X: `createdAt`.
- Y: `estimateOneRepMax(record)` por cada registro, ordenado cronológicamente.
- Tooltip: muestra el valor y el `reps` del registro que lo origina.
- Si el ejercicio tiene < 3 registros → copy "rolling window acortada por muestra chica".

#### 5. `PrilepinTable`

- Sticky en desktop (sidebar 18rem `sticky top-4`).
- Full-width stack en mobile.
- 4 columnas: `Reps`, `% 1RM`, `Peso (kg)`, `Peso (lb)`.
- Generado por `buildPrilepinRows(estimatedOneRmKg ?? 0)` (helper de 0036).
- Si `estimatedOneRmKg === null` → empty state "Sin 1RM estimado" en lugar de la tabla.

#### 6. `ExerciseHistoryList`

- Lista de registros del ejercicio, ordenados por `createdAt` desc.
- Cada fila:
  - Fecha (formato corto).
  - `totalKg × reps` (o `totalKg` si `reps === null`).
  - Badge `⭐ 1RM` si `isOneRepMax === true`.
  - Botón `Cargar` (mismo handler que en el mini-panel, llama `setCalculatorState`).
  - Botón `Eliminar` (con `window.confirm`).
  - Botón `Marcar 1RM` / `Desmarcar` (togglea `isOneRepMax` en el record, persiste via `updateRecord`).

### Empty states y sparse data

| Condición | Comportamiento |
|---|---|
| 0 registros con `exercise === decodedName` | Página entera: "No hay registros para este ejercicio" + link a la calculadora |
| 1 registro | Muestra el 1 chart (progresión) con copy "Necesitás ≥ 2 registros para ver tendencia". Volume y e1RM ocultos. |
| ≥ 2 registros pero todos con `reps === null` | Los 3 charts se muestran con datos de `totalKg`, pero la tabla Prilepin muestra "Sin 1RM estimado" porque no hay fórmula posible. |
| ≥ 2 registros con `reps` y un flag | El flag sobrescribe la fórmula si es mayor. Badge `⭐ 1RM` en el row del flag. |

## TDD scope (híbrido)

- **TDD estricto** sobre los helpers puros nuevos: `getRecordsForExercise` (issue 0038 ya lo cubre, se reusa), `formatProgressionTick`, `rollingEstimatedOneRm` (helper nuevo para la ventana rolling).
- **Patrón del proyecto** sobre los componentes visuales: render tests con `recharts` montados en jsdom, snapshots del SVG output. Sin ciclo red-green (la integración Recharts + DOM no se presta).

### Tests a escribir primero

`src/lib/calculator/chart-helpers.test.ts` (TDD estricto, ~8 tests):

- `formatProgressionTick(iso)` retorna `"03 sep"` para `"2026-09-03T..."`.
- `formatProgressionTick` para fechas inválidas → string vacío.
- `rollingEstimatedOneRm(records, windowSize = 3)` retorna serie con `estimateOneRepMax` por cada índice, tomando el max de los últimos N.
- `rollingEstimatedOneRm` con 0 registros → `[]`.
- `rollingEstimatedOneRm` con 1 registro → 1 entry.
- `rollingEstimatedOneRm` con 5 registros, window 3 → 5 entries, las primeras 2 con ventana corta, las últimas 3 con ventana full.
- `rollingEstimatedOneRm` ignora records con `reps === null` para el cálculo (devuelve `null` para esa entry).
- `rollingEstimatedOneRm` con todos los records `reps === null` → serie vacía o de nulls (decisión: serie con nulls, así el chart puede decidir cómo mostrarla).

`src/app/tools/weight-calculator/exercise/_components/analysis-page-client.test.tsx` (patrón del proyecto, ~5 tests):

- Render con 0 records → empty state.
- Render con 3 records (1 con flag) → header con nombre + summary + 3 charts visibles + tabla Prilepin con 12 rows + lista con 3 rows (1 con badge `⭐ 1RM`).
- Render con 1 record → 1 chart visible, los otros 2 ocultos con copy.
- Render con todos los records `reps === null` → tabla Prilepin muestra "Sin 1RM estimado".
- Click en `Marcar 1RM` de un row → actualiza el record, badge aparece, tabla Prilepin refleja el nuevo 1RM.

## Blocked by

- **0036** — los helpers de 1RM y la tabla Prilepin.
- **0038** — el helper `getRecordsForExercise` (aunque también se podría definir localmente, lo correcto es reusar).

## Acceptance criteria

- [ ] `recharts` sumada a `package.json` y al bundle.
- [ ] `src/app/tools/weight-calculator/exercise/[name]/page.tsx` + `analysis-page-client.tsx` con los 6 componentes internos.
- [ ] `src/lib/calculator/chart-helpers.ts` con `formatProgressionTick` y `rollingEstimatedOneRm`. 8 tests passing (TDD estricto).
- [ ] 5 render tests del `analysis-page-client`.
- [ ] Empty states documentados y testeados para las 4 condiciones de la tabla.
- [ ] Responsive: desktop con sidebar sticky 18rem (siguiendo ADR-0005), mobile stack vertical.
- [ ] `npm test` verde, 13 tests nuevos (8 de chart-helpers + 5 de analysis-page-client).
- [ ] `npm run build` verde, bundle size de la ruta reportado.
- [ ] `npm run lint` verde.

## Manual end-to-end test

```bash
npm test -- chart-helpers
# Expect: 8 tests passed
npm test -- analysis-page-client
# Expect: 5 tests passed
npm run build
# Expect: build OK, ruta /tools/weight-calculator/exercise/[name] listada
npm run lint
# Expect: 0 errors
```

Smoke manual completo:

1. Ir a `/classes` → `Ejercicios guardados` → click en "Back Squat" (suponiendo que hay registros).
2. Ver el header con summary, los 3 charts, la tabla Prilepin a la derecha, y la lista del ejercicio abajo.
3. Tildar `Marcar 1RM` en un row → ver el badge aparecer y la tabla Prilepin recalcular.
4. Click en `Cargar` de un row → la calculadora abre con ese snapshot.
5. Click en `Eliminar` → `window.confirm` → desaparece del historial, el chart se actualiza.
6. Resize a mobile (< 768px) → los charts stackean vertical, la tabla Prilepin se mueve abajo de los charts.
7. En una URL inexistente (e.g. `/tools/weight-calculator/exercise/foo-bar-baz-no-existe`) → empty state correcto.

## Out of scope

- Export de la vista (PNG/MD) — grill R4 Q15 lo dejó fuera de v1.
- Edición del `reps` de un registro ya guardado (sólo se permite togglear `isOneRepMax` en este issue).
- Recharts con animaciones coreografiadas al design system (estilo chalk).
- Sincronización de los charts con el toggle `Marcar 1RM` (no es necesario: el storage event dispara re-render del componente raíz).
- Internacionalización de los formatters de fecha (se mantiene el formato `"03 sep"` estilo `history-page-client`).
- Tests E2E con Playwright.
