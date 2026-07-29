# Surface Brief — `/classes/new`

**Surface**: `/classes/new` (`src/app/classes/new/page.tsx` + `src/components/clase-form.tsx`)
**Mode**: Operate (formulario de creación)
**Adjacent files**: `src/app/classes/[id]/page.tsx`, `src/app/classes/[id]/_components/edit-class-page-client.tsx`

## Audience, job, action, proof

- **Audience**: Entrenador creando una nueva Clase por primera vez (crossfit, bodybuilding, gymnastics, etc.).
- **Job**: capturar nombre, estructura (markdown), pool de ejercicios (texto), y duración objetivo.
- **Primary action**: **Crear clase** (signal, full-width abajo; label "CREAR CLASE" en uppercase tracking).
- **Secondary action**: **Cancelar** (ghost, link a `/classes`).
- **Proof**: el usuario sabrá que la Clase se creó cuando la lista de `/classes` muestre su nombre y conteo.

## Form fields

| Field | Type | Validation | Visual |
|---|---|---|---|
| Nombre | text input | requerido, no vacío | input con label uppercase tracking-plus |
| Duración (min) | number input | requerido, > 0 | input con label uppercase |
| Estructura | textarea (markdown) con tabs Editor / Vista previa | requerida, no vacía | textarea mono, tabs son text-only underline-style |
| Ejercicios | textarea (uno por línea) | opcional, se splitea por `\n` | textarea mono |

## States & ranges

- **Pristine**: form vacío, placeholders en cada campo (mute).
- **Dirty**: cualquier campo tiene contenido. El botón Crear se habilita sólo si las validaciones pasan.
- **Submitting**: el CTA pasa a label "CREANDO…" con cursor `wait`, formulario disabled via `<fieldset disabled>`.
- **Error**: mensaje en destructive al pie de cada campo inválido. CTA no se desactiva hasta que el problema se resuelva.
- **Submission success**: `addClass(nueva)` en `pd:classes`, luego `router.push("/classes")`. Toast "Clase creada".
- **Submission error**: toast "No se pudo crear la Clase. Intenta de nuevo."

## Interaction & layout

- **Top**: status strip arriba, label "NUEVA CLASE" italic a la izquierda, pill "GUARDAR" disabled a la derecha (habilitado sólo cuando validaciones pasan; en realidad el CTA vive también abajo del form como redundancia visual de Operate).
- **Body**: container `max-w-3xl mx-auto px-5 md:px-8 py-10`.
- **Form**: vertical stack con `gap-6`. Cada fieldset = label uppercase tracking + input. La estructura usa tabs Editor/Vista previa con texto underline-style (no button backgrounds). El Editor es textarea mono; la Vista previa usa `prose prose-invert`.
- **Acciones**: pie del form = Cancelar (ghost, link) · Crear clase (primary). En mobile, full-width stacked.

## Components involved

- `status-strip`
- `chalk-card` (envuelve el form)
- `Input` shadcn con classes nativos
- `Textarea` shadcn
- Tabs (text-only style — personalizado, no los TabsList predefinidos con backgrounds)
- `Button` primary + ghost

## Animation

- Sin entrance animation.
- Tabs Editor/Vista previa: cambio instantáneo sin crossfade.
- Disabled state: 200ms transición de opacity.

## Open / undecided

- Sin soporte para duplicar Clase existente. Si más adelante se necesita, agregar un "Duplicar desde…" en `/classes`.
- Validación de markdown de la estructura no se ejecuta — el sistema confía en el texto del entrenador.

## Resolución previa

- **LABELS UPPERCASE TRACKING**: cada label es MAYÚSCULAS + 0.10em letter-spacing. Es la única "tipografía decorativa" del sistema.
- **Sin eyebrow ni section numbers**: este brief rehúye ambos.
- **Sin modal**: el delete confirmation (en edit) usa `window.confirm`, no Dialog. Inline preferida siempre.
