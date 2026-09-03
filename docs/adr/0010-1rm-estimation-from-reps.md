# 1RM Estimado a partir de `(totalKg, reps)` con Epley Piecewise

La vista de análisis de ejercicio (issue 0038) requiere una estimación del **1RM por ejercicio** para alimentar la tabla de Prilepin y los charts de progresión. La estimación se deriva de los `SavedWeightRecord` ya persistidos en `pd:calculator-records`, calculando `1RM_estimado = f(totalKg, reps)` por registro y tomando el máximo por ejercicio.

**Status**: propuesta — pendiente de aceptación por el equipo.

## Contexto

Antes de este ADR, `SavedWeightRecord` (`docs/adr/0009-saved-weight-records.md`) no persistía `reps`. Sólo guardaba el desglose de la barra (`barKg` + `discs`) y los totales pre-calculados (`totalKg`, `totalLb`). El `reps` no tenía representación en el modelo porque la calculadora se concibió como un utility que mide *carga*, no *esfuerzo*.

Para que la vista de análisis pueda mostrar:

- **Tabla de Prilepin** (1-12 reps × % de 1RM): necesita un 1RM de referencia por ejercicio.
- **e1RM rolling** (tendencia del 1RM estimado en el tiempo): necesita poder calcular 1RM para cada punto temporal.

necesitamos poder responder: "para un set de `X` kg a `Y` reps, ¿cuál sería el 1RM estimado?". Las dos familias de fórmulas más usadas son:

- **Epley** (1985): `1RM = peso × (1 + reps / 30)`. Sencilla, popular, sobreestima ~3% en `reps = 1`. Para `reps = 5`: factor `1.167`; para `reps = 10`: factor `1.333`.
- **Brzycki** (1993): `1RM = peso × 36 / (37 - reps)`. Más precisa en `reps = 1` (factor exacto `1.0`), diverge más rápido para reps altas. Para `reps = 5`: factor `1.125`; para `reps = 10`: factor `1.333`.

Ambas asumen que el set fue a **fallo o cerca del fallo** (single set to failure). Si el coach hizo 5 reps con peso que podría haber hecho 8, la fórmula sobreestima el 1RM real. Esto es una limitación conocida y aceptada en la industria.

## Decisión

### Schema: `reps` obligatorio en nuevos `manual`, opcional en legacy/foto

`SavedWeightRecord` gana dos campos:

```ts
interface SavedWeightRecord {
  // ... campos existentes
  reps: number | null;          // null en legacy/foto; ≥1 en nuevos manual
  isOneRepMax?: boolean;         // override opcional, default false
}
```

- **`reps: number`** — entero ≥ 1. **Obligatorio** en registros nuevos `source: "manual"`. El form de `Guardar con etiqueta` (issue 0036) suma el input con validación.
- **`reps: null`** — para registros pre-migración (sin el campo en storage) y para registros `source: "foto"` (el Foto tab no captura reps). Se filtran del cálculo de 1RM pero siguen contando para los charts de peso total y volumen.
- **`isOneRepMax?: boolean`** — flag manual del coach. Sirve como override cuando la fórmula no refleja la realidad (1RM testeado en competencia, set con `reps = 1` y peso máx confirmado). Default `false`. Se acepta `undefined` para registros legacy; el storage parser aplica `.default(false)`.

### Fórmula: piecewise Epley con override del flag

```ts
function estimateOneRepMax(record: SavedWeightRecord): number | null {
  if (record.reps === null) return null;          // legacy/foto: sin estimación
  if (record.reps === 1) return record.totalKg;  // identidad, evita el sesgo de Epley
  return record.totalKg * (1 + record.reps / 30); // Epley clásico
}

function aggregateExerciseOneRepMax(records: SavedWeightRecord[]): number | null {
  const formulaMax = records
    .map(estimateOneRepMax)
    .filter((x): x is number => x !== null)
    .reduce((max, x) => Math.max(max, x), 0);

  const flagMax = records
    .filter((r) => r.isOneRepMax === true)
    .reduce((max, r) => Math.max(max, r.totalKg), 0);

  if (formulaMax === 0 && flagMax === 0) return null;  // sin datos
  return Math.max(formulaMax, flagMax);
}
```

Decisiones deliberadas:

1. **Piecewise con `reps = 1` → `totalKg` directo**: Epley puro sobreestima ~3% en `reps = 1` porque aplica el factor `(1 + 1/30) = 1.0333`. Cuando el coach declara explícitamente que hizo 1 rep, no tiene sentido estimar: el 1RM *es* ese peso. Idempotente y honesto.
2. **Epley en lugar de Brzycki para `reps ≥ 2`**: Epley es la fórmula más citada en apps de fitness (Strong, Hevy, etc.). La diferencia numérica entre Epley y Brzycki para `reps ∈ [2, 10]` es < 1% — no vale la pena documentar Brzycki para el coach. Si más adelante se quiere Brzycki como toggle, es trivial agregar.
3. **`isOneRepMax` como override, no como fuente única**: originalmente se discutió usar el flag como única fuente (ver `grill-with-docs` Ronda 1 Q1). Se descartó porque ignora sets sub-máximos con peso alto (e.g. un set de 5×100kg da mejor 1RM estimado que un set de 1×95kg). El flag queda como "puerta de escape" para 1RM testeado fuera de la app.
4. **`null` como sentinela, no `0`**: si todos los registros del ejercicio son legacy/foto, `aggregateExerciseOneRepMax` retorna `null` y la vista de análisis muestra empty state explícito. `0` colapsaría "sin datos" con "1RM estimado es 0kg", que es ambiguo.
5. **El flag es per-registro, no per-ejercicio**: la decisión de override es del coach por set concreto, no por ejercicio. Si el coach marca dos sets como 1RM (porque retesteó), el de mayor `totalKg` gana automáticamente.

### Storage migration

`pd:calculator-records` ya contiene registros pre-migración. La migración es **silenciosa** vía el storage parser:

- Registros sin `reps` → `reps: null` (default).
- Registros sin `isOneRepMax` → `isOneRepMax: false` (default).
- Registros con `reps` presente pero inválido (negativo, no-integer) → **se descartan silenciosamente** (mismo patrón que el storage parser actual para `RecordSource` inválido).

No se bump-ea la versión del storage key. El shape se expande in-place vía Zod `.default()`.

### UI surface

- **`SaveRecordForm` (issue 0036)**: input `Repeticiones` (number, default 1) y checkbox `Marcar como 1RM` (opcional, default false).
- **Vista de análisis (issue 0038)**: por registro del ejercicio, badge `1RM` si `isOneRepMax === true`. Botón `Marcar como 1RM` / `Desmarcar` en la lista del ejercicio. La tabla Prilepin y los charts derivan del `1RM_ejercicio` calculado por `aggregateExerciseOneRepMax`.

## Consecuencias

- `lib/calculator/one-rm.ts` (nuevo) exporta `estimateOneRepMax`, `aggregateExerciseOneRepMax`, y `PRILEPIN_TABLE` (constante de la tabla de Prilepin 1-12). Es código puro, testeable en aislamiento.
- `lib/calculator/schemas.ts` extiende `SavedWeightRecordSchema` con `reps: z.number().int().min(1).nullable()` y `isOneRepMax: z.boolean().default(false)`.
- `lib/storage.ts` no necesita cambios: el parser actual ya aplica `.default()` a través de `SavedWeightRecordSchema`. Los registros legacy se rehidratan con `reps: null` y `isOneRepMax: false` automáticamente.
- La vista de análisis (issue 0038) depende de `aggregateExerciseOneRepMax` para alimentar la tabla de Prilepin y el chart de e1RM rolling.
- ADR-0009 (saved weight records) sigue vigente: el modelo sigue siendo string-libre en `exercise` y snapshot del desglose. Este ADR **no convierte** la calculadora en una herramienta de periodización; agrega una capa analítica encima del utility existente.
- La **noción de "1RM" se introduce por primera vez** en el modelo. Hasta ahora, la calculadora medía carga instantánea, no capacidad máxima. Esto es un cambio conceptual: el coach ahora puede ver "cuánto puedo levantar a 1RM" además de "cuánto estoy cargando ahora". El trade-off es que requiere disciplina al guardar (siempre declarar reps honestamente).
- Si el coach guarda sets muy sub-máximos con reps altas (e.g. 20 reps de 50kg en un ejercicio donde su 1RM real es 100kg), la fórmula Epley daría `50 × (1 + 20/30) = 83kg` — subestima. Es responsabilidad del coach guardar sets a fallo o cerca del fallo para que la estimación sea útil. La UI no lo fuerza; es documentación + convención.

## Alternativas consideradas

- **Brzycki puro en lugar de piecewise Epley**: matemáticamente más preciso en `reps = 1` (factor exacto). Pero Brzycki es menos conocido fuera del círculo de powerlifting, y la diferencia numérica en reps medias es marginal. Se descartó en favor de Epley (más comunicable al coach).
- **Epley puro sin piecewise para `reps = 1`**: más simple de explicar (una sola fórmula). Pero introduce el sesgo de ~3% en `reps = 1` que es justo el caso más común de "1RM testeado". El piecewise es trivial (2 líneas) y arregla el problema sin sacrificar consistencia.
- **Tabla custom por banda (1-3 / 4-6 / 7-10 / 11-15 reps)**: más precisa por banda (RPE-style). Pero requiere definir los % manualmente y mantener una tabla separada. Overhead de mantenimiento sin ganancia observable en este single-user local. Se descartó para v1; queda como work futuro si el coach reporta que Epley no le sirve.
- **`isOneRepMax` como única fuente (sin fórmula)**: la decisión original del grill R1 Q1 fue flag explícito. Se descartó porque ignora sets sub-máximos. El flag sobrevive como override opcional, no como fuente única.
- **Inferir 1RM del registro más pesado (sin `reps`)**: la opción del grill R1 Q1 original. Se descartó porque el coach puede tener registros de warm-up (peso bajo) y registros pesados (peso alto) sin saber cuál fue su 1RM. La fórmula explícita es más transparente.
- **Pedir `reps` en el Foto tab**: el grill R3 Q10 lo propuso. Se descartó porque el Foto tab está desactivado (issue 0039) y el coach no lo usa. Si se reactiva Foto, se reconsidera.
- **Requerir `reps` también en legacy (asumir `reps = 1` por default)**: el grill R3 Q11 opcion B. Se descartó porque fuerza una migración que inventa datos. El coach puede editar registros viejos gradualmente.

## Out of scope (explícito)

- **RPE (Rate of Perceived Exertion)**: el coach podría querer guardar "5 reps a RPE 8" en lugar de "5 reps a fallo". La fórmula Epley no usa RPE. Queda como work futuro.
- **Tabla de Prilepin custom por ejercicio**: el coach podría querer % distintos por ejercicio (e.g. sentadilla full range vs pin squat). Por ahora es una sola tabla hardcodeada. Queda como work futuro.
- **Comparación entre ejercicios (gráfico agregado de todos los 1RM)**: el grill R2 Q1 opcion C (vista global). Queda como work futuro.
- **Sin export del 1RM**: el grill R4 Q15 decidió no exportar en v1. Si el coach quiere compartir, lo anota a mano.
- **Validación de "set a fallo"**: la fórmula asume esfuerzo cerca del fallo. La UI no lo pregunta. Documentado como convención del coach.

## Migration & rollout

- `pd:calculator-records` se rehidrata en el próximo read. Registros sin `reps` → `reps: null`; sin `isOneRepMax` → `false`. Cero acción del coach.
- Si un registro existente tiene `reps` con valor inválido (negativo, no-integer, NaN), el storage parser lo descarta silenciosamente y loguea en consola. El coach no ve nada raro en la UI; el registro simplemente desaparece del historial.
- La feature es **aditiva**: no se rompe ningún flujo existente. Los charts y tablas nuevas aparecen sólo en la vista de análisis (issue 0038); el resto de la calculadora y el Foto tab (desactivado) siguen iguales.
- Rollback: si la fórmula Epley resulta ser claramente mala para el caso del coach, cambiar a Brzycki o tabla custom es un edit de 3 líneas en `lib/calculator/one-rm.ts` + actualizar tests. La estructura del schema y la UI no se tocan.
