---
label: feature
status: closed
parent: null
depends_on: []
blocks: []
---

# 0044 — Favoritos + catálogo en inglés (revisión de 0043)

## Context

0043 shippeó un catálogo curado de 23 ejercicios típicos con nombres canónicos en español + alias en inglés, y una fila de chips clickeables arriba del input "Ejercicio" en la calculadora. PR #5 quedó abierto y CI verde, pero **no mergeado** a `master`.

Después de revisar la feature, el entrenador pidió tres cambios que rediseñan el modelo mental:

1. **Dejar los nombres en inglés** — el placeholder histórico es "Ej. Back Squat", el campo es libre, y los nombres en inglés (Back Squat, Bench Press, Deadlift) son los que el entrenador realmente usa para hablar de los movimientos. El español canónico introducía un step de traducción innecesario.
2. **Marcar ejercicios como favorito desde el form** — al guardar, poder tildar "Agregar a favoritos" para que el ejercicio quede en una lista personal persistente.
3. **La fila de chips pasa a mostrar los favoritos del entrenador**, no el catálogo curado. El catálogo sigue existiendo (para el datalist/autocomplete) pero los chips son personalizados.

Los tres cambios están en la misma vertical y refactorizan lo que 0043 dejó a mitad de camino. Tiene sentido cerrarlos juntos en un solo ticket.

## Goal

1. Cambiar el catálogo típico a inglés, sin alias.
2. Sumar el concepto de "favoritos" persistidos en `localStorage` con CRUD.
3. Reemplazar la fila de chips del catálogo por una fila de chips de favoritos, con botón X para sacar.
4. Sumar "Agregar a favoritos" como checkbox en el form de guardado (pre-checked si el ejercicio ya es favorito).

## User stories

1. Como entrenador, quiero ver los nombres en inglés para no traducir mentalmente.
2. Como entrenador, cuando guardo una carga, quiero poder marcarla como favorita para que el ejercicio quede en mi lista personal.
3. Como entrenador, cuando abro el form de guardado, quiero ver mis favoritos como chips clickeables para seleccionarlos sin tipear.
4. Como entrenador, si un ejercicio ya no me interesa, quiero poder quitarlo de favoritos con un click (sin abrir el form).

## Solution

Un ticket, seis entregables, todos en la misma vertical sobre `feature/0043-typical-exercises`:

1. **Catálogo → inglés, sin alias** (`src/lib/calculator/typical-exercises.ts`):
   - Quitar el campo `alias`. Queda solo `name` (en inglés) y `category`.
   - Renombrar todas las entradas a la nomenclatura inglesa que el entrenador ya usa: `Back Squat`, `Front Squat`, `Conventional Deadlift`, `Sumo Deadlift`, `Romanian Deadlift`, `Bench Press`, `Incline Bench Press`, `Overhead Press`, `Barbell Row`, `Pendlay Row`, `Pull-up`, `Lat Pulldown`, `Power Clean`, `Power Snatch`, etc.
   - El catálogo se sigue usando para alimentar el `<datalist>` (autocomplete), no los chips.
   - `findTypicalByName` sigue funcionando case-insensitive sobre el `name` (ahora en inglés).
   - Tests actualizados: las 6 entradas del AC anterior se renombran a sus contrapartes en inglés.

2. **Helpers puros de favoritos** (`src/lib/calculator/favorites.ts`, nuevo):
   - `addFavorite(list, name)`: prepend, dedupe case-insensitive, trim.
   - `removeFavorite(list, name)`: filter case-insensitive.
   - `isFavorite(list, name)`: lookup case-insensitive, trim.
   - `toggleFavorite(list, name)`: conveniencia, devuelve la nueva lista + el nuevo estado.
   - Sin localStorage, sin React. 100% cubierto por tests.

3. **Storage layer de favoritos** (`src/lib/storage.ts`):
   - Nueva constante `FAVORITES_KEY = "pd:calculator-favorites"`.
   - Storage shape: `string[]` (JSON-serializado, orden estable: most recently favorited first).
   - Funciones: `getFavorites()`, `addFavorite(name)`, `removeFavorite(name)`, `toggleFavorite(name)`, `isFavorite(name)`, `setFavorites(list)`.
   - Mismas garantías que `getRecords()`: read path defensivo (try/catch + Zod-like shape check), write path confiado.
   - Backup: extender `BackupShape.data` con `favorites: string[]`. `exportAllData` los incluye. `importAllData` los restaura. `clearAllData` los borra (ya lo hace por prefijo `pd:`).
   - Tests nuevos en `storage.test.ts`.

4. **Chip component rediseñado** (`src/app/tools/weight-calculator/_components/favorite-exercise-chips.tsx`, rename del archivo `typical-exercise-chips.tsx`):
   - Antes: `value` (input actual) + `onSelect(name)`, renderiza `TYPICAL_EXERCISES`.
   - Ahora: `favorites: string[]` + `onSelect(name)` + `onRemove(name)`, renderiza la lista recibida.
   - Cada chip es un `<div>` con dos botones: el cuerpo (rellena input) y la X (saca de favoritos con `e.stopPropagation()`).
   - Active state: si el `value` matchea el nombre del chip (case-insensitive, trim), el chip se ve destacado.
   - Empty state: si `favorites.length === 0`, el row se oculta (no muestra un row vacío con "0 favoritos").

5. **Form de guardado extendido** (`save-record-form.tsx`):
   - Nuevo estado `isFavorite` (default: chequea el storage en mount).
   - Nuevo checkbox "Agregar a favoritos" en la misma fila que el 1RM checkbox.
   - Pre-checked si el `defaultExercise` o el input actual matchea un favorito existente.
   - En `handleSubmit`: si el checkbox está tildado, llamar `addFavorite(name)` antes de `addRecord(record)`. Si está destildado y el nombre YA está en favoritos, llamar `removeFavorite(name)`. Esto permite "des-favoritear" desde el form al guardar.
   - Reemplaza la importación de `TypicalExerciseChips` por `FavoriteExerciseChips`, le pasa `favorites={getFavorites()}` + handlers.

6. **Tests del form extendidos**:
   - Verifica que el checkbox "Agregar a favoritos" se renderiza y arranca destildado.
   - Verifica que al guardar con el checkbox tildado, el nombre queda en `getFavorites()`.
   - Verifica que al guardar con el checkbox destildado y un nombre previamente favorito, el nombre se saca de `getFavorites()`.
   - Verifica que el X de un chip llama `removeFavorite` y el chip desaparece.
   - Verifica que la fila de chips se oculta cuando no hay favoritos.
   - Verifica que el datalist sigue conteniendo los nombres en inglés del catálogo (sin cambios al `mergeTypicalAndHistory`).
   - Verifica que la lista de chips muestra los nombres en inglés (Back Squat, no Sentadilla trasera).

## Out of scope

- **Editar el catálogo** desde la UI. Sigue estático en código.
- **Migración de nombres viejos en español**. Como 0043 nunca se mergeó, no hay datos en producción. El catálogo pasa a inglés sin pérdida.
- **Reordenar / agrupar favoritos**. Los favoritos se persisten en orden "más reciente primero" (LRU-ish). No hay drag-to-reorder, no hay agrupación por categoría.
- **Sincronización cross-device**. Los favoritos son locales (localStorage). Si el entrenador quiere favoritos en varios dispositivos, va en un ticket aparte con su ADR de storage.
- **Favoritos por modalidad** (crossfit, weightlifting, etc.). El concepto es plano: cualquier favorito aplica a la calculadora de pesas. Si después hay favoritos de CrossFit, va aparte.
- **Contador / metadata por favorito**. Es solo una lista de strings. Si necesitamos "favoritedAt" o "useCount" por favorito, va en una evolución del storage shape.

## Acceptance

- [ ] `src/lib/calculator/typical-exercises.ts` tiene nombres en inglés, sin campo `alias`
- [ ] `TYPICAL_EXERCISES` incluye: Back Squat, Conventional Deadlift, Bench Press, Overhead Press, Barbell Row, Pull-up (y al menos 14 más)
- [ ] `src/lib/calculator/favorites.ts` existe con los 4 helpers puros + 100% coverage
- [ ] `getFavorites()` / `addFavorite()` / `removeFavorite()` / `toggleFavorite()` / `isFavorite()` / `setFavorites()` exportados desde `storage.ts`
- [ ] `pd:calculator-favorites` se incluye en `exportAllData` y se restaura en `importAllData`
- [ ] `clearAllData` borra el key (ya cubierto por el prefijo `pd:`, verificarlo en test)
- [ ] El chip component se llama `FavoriteExerciseChips` y vive en `favorite-exercise-chips.tsx`
- [ ] El chip row muestra los favoritos del storage, no `TYPICAL_EXERCISES`
- [ ] El chip row se oculta cuando no hay favoritos
- [ ] Cada chip tiene un X que llama `removeFavorite` y lo desaparece del row
- [ ] El form tiene un checkbox "Agregar a favoritos"
- [ ] El checkbox arranca pre-checked si el nombre actual ya es favorito
- [ ] Submitir con el checkbox tildado persiste el nombre en `getFavorites()`
- [ ] Submitir con el checkbox destildado + nombre previamente favorito lo saca de `getFavorites()`
- [ ] El datalist sigue conteniendo los nombres en inglés del catálogo + historial del entrenador
- [ ] `npm run lint` verde, `npm run build` verde, `npm test -- --coverage` verde
- [ ] Coverage de los nuevos archivos: 100/100/100/100

## Implementation decisions

- **Sort order de favoritos**: most recently favorited first. La nueva entrada se prepende. Es el orden que el entrenador espera ver ("lo último que favoriteé es lo más fresco en mi cabeza") y es trivial de implementar sin timestamps.
- **Case-insensitive**: el dedupe y lookup son case-insensitive sobre `name.trim()`. Coherente con `dedupeExercises` y `findTypicalByName` que ya usan la misma convención.
- **Pre-check del checkbox**: el form lee `isFavorite(getFavorites(), defaultExercise ?? exercise)` en mount. Si el entrenador ya tenía "Back Squat" como favorito y abre el form, el checkbox está tildado. Si tipea un nombre distinto, el checkbox sigue como estaba (no se re-evalúa con cada keystroke — el form es una snapshot controlada por el entrenador, no se reescribe sobre sus decisiones).
- **X en cada chip**: pequeño botón con `aria-label="Quitar {name} de favoritos"`, `e.stopPropagation()` para no triggerear el fill del input. Estilo: `text-bone/40 hover:text-signal` — discreto, no compite con el label del chip.
- **Empty state del chip row**: si no hay favoritos, el row no se renderiza (`{favorites.length > 0 && <FavoriteExerciseChips ... />}`). El form sigue siendo usable — el entrenador puede tipear y/o marcar como favorito por primera vez.
- **No se renombra `TYPICAL_EXERCISES`**: el archivo sigue llamándose `typical-exercises.ts` porque sigue describiendo "ejercicios típicos" — sólo que ahora en inglés. La función `findTypicalByName` también se queda (sigue siendo útil para el datalist).
- **No se cambia el `placeholder`** del input ("Ej. Back Squat") — ya está en inglés, coherente con el nuevo modelo.
- **Backward compat con 0043**: ninguno. 0043 nunca se mergeó, así que no hay datos en español que migrar. Si el entrenador llega a tener registros bajo nombres en español, se mantienen como strings libres (igual que "Press militar" en su historial previo) — no se migran.

## Further notes

- **Relación con 0043**: 0044 es una revisión de 0043. No los mergeamos juntos. El PR #5 absorbe estos cambios y queda como un solo feature ticket (0044 cierra el ciclo).
- **Relación con 0042** (`/exercises`): el catálogo `deriveExerciseIndex` agrupa por nombre. Los favoritos son ortogonales: el entrenador puede tener favoritos sin tener registros previos, y los registros existentes se mantienen en su grupo independiente.
- **Relación con el hábito PR+CI**: este es el segundo ticket bajo el nuevo hábito. Como el branch ya existe y el PR #5 está abierto, los commits se pushean al mismo branch y el CI corre de nuevo en el PR. No abrimos un PR nuevo.
