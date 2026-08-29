---
label: feature
status: open
parent: 0012-saved-weight-records
phase: 1
adr: 0009-saved-weight-records
depends_on: []
blocks:
  - 0014-save-button-with-label
  - 0015-auto-log-watcher
  - 0016-mini-panel-in-calculator
  - 0017-full-history-page
affects:
  - src/lib/types.ts
  - src/lib/calculator/schemas.ts
  - src/lib/calculator/history.ts (new)
  - src/lib/calculator/index.ts
  - src/lib/storage.ts
---

# 0013 — Fase 1: Dominio & storage

## Contexto

Primer issue ejecutable del umbrella [0012-saved-weight-records](./0012-saved-weight-records.md) y pieza foundational del feature. Antes de tocar cualquier UI necesitamos que el modelo de datos (`SavedWeightRecord`), el schema de validación, los helpers puros y los helpers de `localStorage` estén listos y consistentes. Esta fase **no introduce UI nueva** — es invisible para el usuario final, pero todo lo que viene después depende de ella.

Ver el rationale completo en [ADR-0009](../adr/0009-saved-weight-records.md). Los detalles de la decisión (cap 200, dedupe, normalización de ejercicio) están allí; este issue es la traducción a código.

## Tareas

### 1. Tipo `SavedWeightRecord` y `RecordSource`

En `src/lib/types.ts`:

```ts
import type { DiscRow } from "./calculator/schemas";

export type RecordSource = "auto-log" | "manual" | "foto";

export interface SavedWeightRecord {
  id: string;
  createdAt: string;            // ISO
  exercise: string | null;      // null solo en auto-log
  barKg: number;
  discs: DiscRow[];             // snapshot
  totalKg: number;
  totalLb: number;
  breakdownLine: string;
  source: RecordSource;
}
```

No exportes el `EmptyRecord` initializer — los registros siempre se construyen explícitamente al persistir (computan totales, etc.).

### 2. Schema Zod en `src/lib/calculator/schemas.ts`

Agregar al final del archivo:

```ts
export const SavedWeightRecordSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),                       // no validamos ISO estricto (compat)
  exercise: z.string().trim().min(1).max(80).nullable(),
  barKg: z.number().positive(),
  discs: z.array(DiscRowSchema),                      // reusar el existente
  totalKg: z.number().positive(),
  totalLb: z.number().positive(),
  breakdownLine: z.string().min(1).max(200),
  source: z.enum(["auto-log", "manual", "foto"]),
});
```

Reexportar `SavedWeightRecordSchema` y `RecordSource` desde `src/lib/calculator/index.ts` para mantener el barrel consistente.

### 3. Helpers puros en `src/lib/calculator/history.ts` (nuevo)

Funciones puras, sin acceso a `window`/`localStorage`. Testables en aislamiento.

- `computeTotals(state: { barKg: number; discs: DiscRow[] }): { totalKg: number; totalLb: number; breakdownLine: string }` — reusar la lógica de totales ya presente en `calculator-client.tsx` y `crossCheckBreakdown` (`src/lib/calculator/schemas.ts`). Llamar a `formatBreakdownLine` (ya exportado) para `breakdownLine`.
- `hashState(state: { barKg: number; discs: DiscRow[] }): string` — `${barKg}|${JSON.stringify(sortedDiscs)}`. **Importante**: el `sort` debe ser estable y considerar `{weight, unit, count}` como clave compuesta, no sólo `weight`, para que dos discos distintos con el mismo peso pero distinta unidad no colisionen.
- `normalizeExerciseName(s: string): string` — `s.trim().replace(/\s+/g, " ")`. Mantener capitalización original.
- `dedupeExercises(items: SavedWeightRecord[]): string[]` — ordenar items por `createdAt` desc, dedupe case-insensitive preservando la capitalización de la primera aparición. Devolver array de strings.

### 4. Storage helpers en `src/lib/storage.ts`

Agregar al final del archivo, siguiendo el patrón existente (`getSessions`, `addSession`, etc.):

```ts
const RECORDS_KEY = "pd:calculator-records";

function isSavedWeightRecord(value: unknown): value is SavedWeightRecord {
  return SavedWeightRecordSchema.safeParse(value).success;
}

export function getRecords(): SavedWeightRecord[];
export function addRecord(record: SavedWeightRecord): void;          // cap 200 sobre auto-log
export function updateRecord(record: SavedWeightRecord): void;       // exportado, no usado en UI MVP
export function removeRecord(id: string): void;
export function getRecentRecords(limit?: number): SavedWeightRecord[];   // default 5, sólo exercise !== null
export function getUniqueExercises(): string[];                      // usa dedupeExercises(getRecords())
```

Detalles importantes:

- `getRecords()` filtra con `SavedWeightRecordSchema.safeParse` por entrada; las que fallan se descartan con `console.warn("[pd:calculator-records] corrupt entry discarded:", id_or_index, result.error.issues)`. Mismo patrón que `getCalculatorState()`.
- `addRecord()` aplica el cap: si el nuevo record es `source: "auto-log"` y el array ya tiene 200 entries, descartar el más antiguo (sort por `createdAt` asc, splice el primero). Los `manual` y `foto` se insertan siempre sin chequear cap.
- Internamente centralizar en un `setRecords(records: SavedWeightRecord[])` que serializa y dispara `storage` event (mismo patrón que `setSessions`).
- `getRecentRecords(limit = 5)` filtra `r.exercise !== null` antes de sort por `createdAt` desc y slice.
- `getUniqueExercises()` retorna `dedupeExercises(getRecords())` — el helper puro está en `lib/calculator/history.ts`.

### 5. Reexports

En `src/lib/calculator/index.ts`:

```ts
export {
  // ... existentes
  SavedWeightRecordSchema,
  type RecordSource,
} from "./schemas";
export {
  computeTotals,
  hashState,
  normalizeExerciseName,
  dedupeExercises,
} from "./history";
```

## Aceptación

- [ ] `npm run build` y `npm run lint` pasan sin errores ni warnings.
- [ ] `SavedWeightRecord`, `RecordSource`, `SavedWeightRecordSchema` están exportados desde los barrels correctos.
- [ ] `computeTotals({ barKg: 20, discs: [] })` retorna `{ totalKg: 20, totalLb: 44.0924, breakdownLine: "20kg" }` (verificar tolerancia con el cálculo actual de la calculadora).
- [ ] `hashState({ barKg: 20, discs: [{weight:25,unit:"kg",count:1}, {weight:10,unit:"kg",count:1}] })` === `hashState({ barKg: 20, discs: [{weight:10,unit:"kg",count:1}, {weight:25,unit:"kg",count:1}] })`.
- [ ] `hashState({ barKg: 20, discs: [{weight:25,unit:"kg",count:1}] })` !== `hashState({ barKg: 20, discs: [{weight:25,unit:"lb",count:1}] })` (unit importa).
- [ ] `dedupeExercises([{exercise:"Back Squat", createdAt:"2026-08-30T..."}, {exercise:"back squat", createdAt:"2026-08-29T..."}])` retorna `["Back Squat"]`.
- [ ] En devtools, `JSON.parse(localStorage.getItem("pd:calculator-records") || "[]")` retorna `[]` antes de cualquier add.
- [ ] Smoke test: en la consola del navegador, ejecutar `addRecord({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), exercise: "Back Squat", barKg: 20, discs: [], totalKg: 20, totalLb: 44.0924, breakdownLine: "20kg", source: "manual" })`. Confirmar que aparece en `getRecords()`. Refrescar la página y confirmar que sigue ahí.

## Decisiones durables (a documentar en `CONTEXT.md` cuando se cierre)

- `pd:calculator-records` es la key nueva; ausencia = array vacío, sin migración.
- Auto-log tiene cap 200; manual/foto no tienen cap.
- El hash de dedupe ordena los `discs` antes de serializar — un mismo cálculo en distinto orden de filas produce el mismo hash.
- La normalización de ejercicio es trim + collapse whitespace, **no lowercase**. El dedupe es case-insensitive sólo para el autocomplete; los registros guardados preservan la capitalización del coach.
- `updateRecord` queda exportado por simetría con `updateSession`, pero no se usa en UI del MVP (reservado para futuro).

## Out of scope

- Cualquier UI nueva (mini-panel, form, página de historial). Eso vive en issues 0014-0017.
- Auto-log real con debounce (eso es el issue 0015, que consume los helpers de esta fase).
- Tests automatizados. Si el equipo decide sumar `vitest` o `node:test` después, esta fase es trivialmente testeable. No agregamos infra de tests en este PR.
- Edición inline de un registro (`updateRecord` queda listo pero la UI no lo llama).

## Follow-ups (no en este PR)

- Si el equipo quiere tests para los helpers puros, se agregan en un PR separado con la infra de testing que elija.
- Si en el futuro se quiere un registry de movimientos tipado (en lugar de string libre), `dedupeExercises` será la base para popularlo.
