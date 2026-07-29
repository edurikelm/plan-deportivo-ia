# Surface Brief — `/classes`

**Surface**: `/classes` (`src/app/classes/page.tsx` + `src/app/classes/_components/classes-list-client.tsx`)
**Mode**: Operate (listado + creación CTA)
**Adjacent files**: `src/app/classes/new/page.tsx`, `src/components/clase-form.tsx`, `src/app/classes/[id]/_components/edit-class-page-client.tsx`

## Audience, job, action, proof

- **Audience**: single Entrenador abriendo la app para revisar o crear Clases.
- **Job**: encontrar una Clase existente para Editarla o Generar una Idea; o crear la primera/una nueva.
- **Primary action**: en cards existentes, **Generar** (signal, navega a `/classes/[id]/generate`). Sin Clases, **Nueva Clase** reemplaza a **Generar** como CTA dominante.
- **Proof real**: nombre de la Clase, conteo de ejercicios y duración en mono tabular. Sin ilustraciones decorativas.
- **Constraints**: sin DB, sin auth. Single-browser. Sin `lucide-react` como decoración (los íconos del MVP se reemplazan por acciones text-only cuando es posible).

## States & ranges

- **Empty (0 Clases)**: la pizarra semanal. Siete celdas (L M M J V S D) en grid `1 col mobile / 7 cols md+`, hairline border general y hairlines internas. Placeholder en cada celda: tipografía mute, mono tabular para abreviatura del día. CTA "Nueva Clase" debajo del grid, alineada a la izquierda.
- **1–4 Clases**: stack vertical con hairline entre cards. Cada card es `chalk-card` (no rounded), nombre en display italic, metadatos a la derecha (DURACIÓN · EJERCICIOS) en mono tabular.
- **5+ Clases**: misma card; agregar contador "Mostrando N Clases" arriba a la derecha en label uppercase.
- **Loading**: no aplica (lectura sincrónica de `localStorage`).
- **Error**: si falla la lectura, mensaje centrado en mute con CTA "Reintentar" ghost.

## Interaction & layout

- **Top**: status strip arriba del todo con label "MIS CLASES" a la izquierda (display italic) y CTA pill "NUEVA CLASE" a la derecha. Aplica estilos `.status-strip[data-state="idle"]`.
- **Body**: container `max-w-3xl mx-auto px-5 md:px-8`. Empty state → pizarra semanal. Lista → grid de cards.
- **Card**: layout horizontal con título + metadatos arriba; chips de ejercicios (max 5 + overflow " +N más") abajo a la izquierda; texto-only actions "EDITAR · GENERAR →" abajo a la derecha. Hover: hairline pasa de 10% a 18%. Sin sombras.
- **No sidebar.** Status strip es la navegación.

## Components involved

- `status-strip` (signature)
- `chalk-card` (signature) + `exercise badge` (signature)
- `button-primary` (full-width sólo en mobile; inline cuando aplica)
- `button-ghost` (para "EDITAR")
- Sin icon-only buttons como acciones principales — texto uppercase + tracking

## Animation

- Hover: sólo cambio de hairline border y surface bumps. Sin scale, sin translate, sin glow.
- Inserción de card nueva al volver del form: ninguno — la pintura es inmediata (sin fade-in).

## Open / undecided

- Sin soporte para reorder / drag. Si el usuario pide batch actions o agrupar por duración, se evalúa después.
- Sin filtros ni búsqueda. La cantidad esperada es < 30 Clases.

## Resolución previa

- **Estilo aplicado**: respetar el TYPE-VOICE RULE (Archivo Narrow italic sólo para nombres de Clase), el SQUARE PAPER RULE (cards cuadradas), el SINGLE-VOICE RULE (signal sólo en CTA "Generar").
- **Sin neon glow**, sin glass, sin tracker eyebrows, sin section numbers.
