# Surface Brief — `/classes/[id]`

**Surface**: `/classes/[id]` (`src/app/classes/[id]/page.tsx` + `src/app/classes/[id]/_components/edit-class-page-client.tsx` + reuso de `src/components/clase-form.tsx`)
**Mode**: Operate (formulario de edición con cascade delete)
**Adjacent files**: `src/components/clase-form.tsx`

## Audience, job, action, proof

- **Audience**: Entrenador revisando o ajustando una Clase existente.
- **Job**: ajustar nombre, estructura markdown, pool de ejercicios, o duración. O bien, eliminar la Clase y todas sus Ideas asociadas (cascade).
- **Primary action**: **Guardar cambios** (signal, full-width en mobile / inline en desktop) tras cambios pendientes.
- **Secondary action**: **Cancelar** (link a `/classes`). **Eliminar clase** (destructive, ghost, en la parte superior del pie) — sólo visible cuando se está editando, no creando.
- **Proof**: la Clase persistida en `pd:classes` refleja los nuevos valores; al volver a `/classes` se ve el cambio.

## Estados & ranges

Reuso de los mismos estados que `/classes/new` (`pristine / dirty / submitting / error / success`) más:
- **Cascade delete confirmation**: click en "Eliminar clase" dispara `window.confirm("¿Eliminar esta clase y todas sus ideas?")`. Si acepta → `removeClass(id)` + `removeIdeasByClass(id)` + redirect a `/classes`. Toast "Clase eliminada".

## Interaction & layout

Mismo layout y fieldset que `/classes/new`. Diferencias:

- Status strip muestra el nombre de la Clase en lugar de "NUEVA CLASE".
- El CTA se vuelve "GUARDAR CAMBIOS" y está deshabilitado hasta que el form esté `dirty && valid`.
- Aparece "Eliminar clase" en el pie (izquierda), con confirmación vía `window.confirm`. Inline preferida sobre Dialog.

## Components involved

- Reuso completo de `ClaseForm` con la prop `initialClase`.
- `status-strip`
- `chalk-card`

## Animation

Mismo que `/classes/new`.

## Open / undecided

- Sin undo para delete (irreversible por diseño local-first). Si el coach lo pide, agregar un toast con "Deshacer" durante 5s.
- Sin preview diff entre la versión guardada y la editada — el coach ve su versión actual siempre.

## Resolución previa

- **Una sola prop `initialClase`** diferencia new/edit; ninguna duplicación visual.
- **Validación inline** y mensajes en destructive al pie del campo, no en toast.
- **`window.confirm` sobre Dialog**: alineado con el rechazo a modales del craft-floor ("A modal for a task that needs neither interruption nor protected focus").
