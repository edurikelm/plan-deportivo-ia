---
label: feature
status: closed
parent: null
depends_on: []
blocks: []
---

# 0043 — Catálogo curado de ejercicios típicos de levantamiento en la calculadora

## Context

Hoy, cuando el entrenador guarda una carga desde `/tools/weight-calculator`, el campo **Ejercicio** es un input de texto con `<datalist>` poblado únicamente con los nombres que ya guardó en su historial (`getUniqueExercises()`). Al estar empezando, el datalist está vacío y el entrenador tiene que tipear el nombre cada vez.

Para ejercicios típicos de levantamiento (sentadilla, peso muerto, press banca, press militar, remo, dominada, etc.) la carga cognitiva es injustificada: el nombre es fijo, conocido, y la mayoría de los entrenadores trabaja con un set estándar de movimientos. Tenerlos como **lista seleccionable** acelera el guardado, reduce typos ("Back Squat" vs "Back squatt" como dos ejercicios distintos), y mejora la consistencia del historial — que es la base del 1RM, Prilepin, y el catálogo de `/exercises`.

## Goal

Sumar al formulario de guardado (`SaveRecordForm`) un **catálogo curado y fijo** de ejercicios típicos de levantamiento, presentado como **chips clickeables sobre el input** y como opciones adicionales en el `<datalist>` existente. El catálogo es código, no persiste en storage, y el entrenador sigue pudiendo tipear cualquier nombre libre.

## User stories

1. Como entrenador, quiero ver los ejercicios típicos como botones visibles, para no tener que recordar el nombre exacto cada vez.
2. Como entrenador, quiero tipear y que el datalist me sugiera tanto mis ejercicios previos como los típicos, para no romper mi flujo si el movimiento no está en el catálogo.
3. Como entrenador, quiero que el chip del ejercicio que ya seleccioné se vea marcado, para confirmar visualmente que estoy registrando el movimiento correcto.
4. Como entrenador, si mi movimiento favorito no está en el catálogo, quiero poder tipearlo igual y guardarlo, sin fricción.

## Solution

Un ticket, cuatro entregables, todos en la misma vertical:

1. **Módulo nuevo** `src/lib/calculator/typical-exercises.ts`:
   - Exporta `TYPICAL_EXERCISES: TypicalExercise[]` (~22 ejercicios, español canónico + alias en inglés + categoría).
   - Exporta `getTypicalExerciseNames(): string[]` para alimentar el datalist.
   - Exporta `findTypicalByName(name): TypicalExercise | undefined` para resolver el chip activo (case-insensitive).
   - Tipos: `interface TypicalExercise { name: string; alias?: string; category: ExerciseCategory }`.
   - `ExerciseCategory` literal union: `"squat" | "hinge" | "push" | "pull" | "overhead" | "olympic" | "accessory"`.
   - 100% cubierto por tests (proyecto: disciplina de cobertura en helpers puros).

2. **UI: chips sobre el input** en `save-record-form.tsx`:
   - Fila horizontal de chips compactos (mismo patrón visual que los type-tags de `/classes`).
   - Renderiza todos los `TYPICAL_EXERCISES` en una fila con `overflow-x-auto` (scrollable en mobile).
   - Click en un chip → setea `exercise` al `name` canónico del típico, foco se queda en el input.
   - Chip activo: si `exercise` (normalizado, case-insensitive) matchea un típico, ese chip se renderiza con estilo destacado (signal border + bg).
   - Mantiene el input de texto debajo, con el `<datalist>` ahora poblado por la **unión** de `getUniqueExercises()` + `getTypicalExerciseNames()` (dedupe case-insensitive, típicos primero).

3. **Componente nuevo** `src/app/tools/weight-calculator/_components/typical-exercise-chips.tsx`:
   - Componente cliente presentacional puro, recibe `value`, `onSelect`.
   - Renderiza la fila scrollable de chips.
   - Resalta el chip cuyo `name` matchea `value` (case-insensitive, trimmed).
   - Accesibilidad: cada chip es un `<button type="button">` con `aria-pressed={isActive}` y `aria-label="Seleccionar {name}"`.

4. **Test del form extendido** (`save-record-form.test.tsx`):
   - Verifica que el form renderiza al menos un chip (los 6 más comunes visibles en el primer viewport: sentadilla, peso muerto, press banca, press militar, remo, dominada).
   - Verifica que clickear un chip rellena el input con el `name` canónico.
   - Verifica que el datalist contiene los nombres típicos (test de presencia, no de todos).
   - Verifica que submitir con un típico persiste `exercise` con el `name` canónico.

## Out of scope

- **Edición del catálogo por el entrenador** (agregar/quitar). El catálogo es código. Si se quiere editable, va en un ticket aparte con su ADR de storage.
- **Migración de nombres**. Si el entrenador ya tiene registros bajo "Back Squat" en inglés, va a convivir con "Sentadilla trasera" en español como dos ejercicios distintos en el catálogo y los charts. Esto es consistente con el modelo actual (string libre, dedupe case-insensitive pero exacto) y un fix de merge/rename es un ticket aparte (probablemente requiere ADR de storage + UI de merge).
- **Agrupación visual por categoría** en los chips (squat / hinge / push / pull / etc.). El campo `category` queda en el dato para un follow-up; en este ticket los chips van en una sola fila plana.
- **i18n de los nombres típicos**. El catálogo se hardcodea en español. Si en el futuro hay entrenadores con otro idioma, se mueve a un recurso i18n.
- **Métricas por ejercicio típico** (volumen sugerido, RM estimado por defecto, etc.). El catálogo es solo nombres.

## Acceptance

- [ ] `src/lib/calculator/typical-exercises.ts` existe, exporta `TYPICAL_EXERCISES` (≥20 entradas) y los helpers
- [ ] `getTypicalExerciseNames()` devuelve los `name` de los típicos, en el orden del array
- [ ] `findTypicalByName("  back SQUAT ")` resuelve al típico "Sentadilla trasera" (case-insensitive + trim)
- [ ] `findTypicalByName("inventé esto")` devuelve `undefined`
- [ ] El form renderiza una fila de chips clickeables arriba del input, scrollable horizontal
- [ ] Los 6 típicos más comunes (sentadilla, peso muerto, press banca, press militar, remo, dominada) están entre los chips visibles
- [ ] Click en un chip rellena el input con el `name` canónico en español
- [ ] Si el input matchea un típico, su chip se ve activo
- [ ] El datalist incluye los nombres típicos además de los del historial
- [ ] Submitir un típico persiste `record.exercise` con el `name` canónico (verificado por test)
- [ ] Tipear un nombre libre que no está en el catálogo sigue funcionando como antes
- [ ] 100% de cobertura en `typical-exercises.ts`
- [ ] Tests del `SaveRecordForm` actualizados y pasando
- [ ] `npm run lint` verde, `npm run build` verde, `npm test -- --coverage` verde

## Implementation decisions

- **Lista inicial** (~22 ejercicios, espanol canónico + alias en inglés):

  | Español canónico | Alias (en) | Categoría |
  |---|---|---|
  | Sentadilla trasera | Back Squat | squat |
  | Sentadilla frontal | Front Squat | squat |
  | Sentadilla búlgara | Bulgarian Split Squat | squat |
  | Zancada | Lunge | squat |
  | Peso muerto convencional | Deadlift | hinge |
  | Peso muerto sumo | Sumo Deadlift | hinge |
  | Peso muerto rumano | Romanian Deadlift | hinge |
  | Hip Thrust | Hip Thrust | hinge |
  | Good Morning | Good Morning | hinge |
  | Press banca | Bench Press | push |
  | Press inclinado | Incline Bench Press | push |
  | Press declinado | Decline Bench Press | push |
  | Fondos | Dip | push |
  | Press militar | Overhead Press | overhead |
  | Press con mancuernas | Dumbbell Press | push |
  | Remo con barra | Barbell Row | pull |
  | Remo Pendlay | Pendlay Row | pull |
  | Dominada | Pull-up | pull |
  | Jalón al pecho | Lat Pulldown | pull |
  | Cargada | Power Clean | olympic |
  | Envión | Snatch | olympic |
  | Curl con barra | Barbell Curl | accessory |
  | Encogimiento | Shrug | accessory |

  (23 entradas. Si alguna sobra para el contexto chileno gym, se baja en review.)

- **Datalist enrichment**: el array de opciones se computa una vez al mount del form (con `useMemo`) como `mergeUnique([...getTypicalExerciseNames(), ...getUniqueExercises()])`. Típicos primero. Función helper `mergeUnique` vive en el mismo módulo y deduplica case-insensitive preservando el orden (primera aparición gana — los típicos).

- **Chip activo**: se calcula con `findTypicalByName(exercise)` cada render. Si el input está vacío o no matchea, ningún chip está activo.

- **Visual del chip**:
  - Inactivo: `border border-hairline bg-transparent text-bone/80 hover:text-bone hover:border-bone/30`
  - Activo: `border-signal bg-signal/15 text-bone`
  - Tamaño: `text-[0.7rem] tracking-[0.04em] font-mono px-2.5 py-1 rounded-full whitespace-nowrap`
  - Coherente con el sistema: misma familia de tokens (`hairline`, `signal`, `bone`) que el resto del form.

- **Sin reorden del input existente**: el form sigue siendo un `<input type="text">`. Los chips son una capa visual encima, no reemplazan la captura libre.

- **No se cambia el placeholder** ("Ej. Back Squat"). Sigue siendo un buen ejemplo. Si después se decide, se cambia en otro PR.

- **Tests con `@testing-library/user-event`**, igual que los existentes. No se introduce testing-library/jest-dom nuevo — los matchers ya están en `vitest.setup.ts`.

## Further notes

- **Relación con 0042**: 0042 creó `/exercises` y el helper `deriveExerciseIndex` que agrupa registros por nombre. Esta feature NO toca ese agrupamiento — los registros bajo nombres en inglés van a seguir formando un grupo separado de los nuevos bajo el nombre canónico español. Es un trade-off documentado arriba (Out of scope: Migración de nombres).
- **Relación con 0037** (form con reps + 1RM flag): este ticket extiende el mismo form. 0037 no se toca, solo se le suma la sección de chips y se actualiza el `suggestions` del datalist.
- **Relación con el hábito PR+CI**: este ticket es el primero del nuevo hábito. Va con feature branch + PR desde el primer commit para que el workflow de `ci.yml` corra en el PR.
