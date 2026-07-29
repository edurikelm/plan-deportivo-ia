# Surface Brief — `/classes/[id]/generate`

**Surface**: `/classes/[id]/generate` (`src/app/classes/[id]/generate/page.tsx` + `src/app/classes/[id]/generate/_components/generate-client.tsx`)
**Mode**: Operate (generación de Ideas + edición + acciones sobre la Idea generada)
**Adjacent files**: `src/app/api/generate/route.ts`, `src/lib/build-prompt.ts`, `src/lib/storage.ts`

> **Surface focal de todo el proyecto.** El "momento-LLM" — la tira de estado pasando de pasiva a signal-fill cronómetro mientras el LLM responde — vive aquí. Esta brief manda sobre las demás cuando hay conflicto visual.

## Audience, job, action, proof

- **Audience**: Entrenador 10 minutos antes de la sesión, abriendo la app en el teléfono o laptop.
- **Job**: escribir un foco opcional, generar la Idea, leerla, editarla si hace falta, guardarla o exportarla.
- **Primary action**: **GENERAR** (signal, pasa a label "GENERANDO…" + tira de estado en estado `active`). Tras el resultado, **GUARDAR** (signal, sólo si hay cambios pendientes vs la `content` persistida).
- **Secondary actions** sobre la Idea generada (inline en la chalk card, ghost):
  - **Copiar** — escribe el markdown en portapapeles. Toasts "Copiado al portapapeles" / "No se pudo copiar".
  - **Exportar `.md`** — descarga `{slug}-{YYYY-MM-DD}.md`. Toast "Exportado".
  - **Regenerar** — vuelve a llamar al LLM. Si hay edición pendiente, `window.confirm` antes.
  - **Editar** — toggle view ↔ edit. En edit, la chalk card muestra textarea + preview side-by-side (desktop) o stacked (mobile), con la regla de tiza (border-left signal) como focus indicator.
- **Proof real**: el `content` persistido refleja la versión editada por el coach, no la salida cruda del LLM. Al volver a abrir la Idea (futuro `/ideas`), lo que ve es lo que firmó.

## States & ranges

- **Pristine** (cargó la página, sin Idea): form con un único textarea para `focus` + status strip pasiva + CTA `GENERAR` full-width abajo.
- **Focusing** (textarea con foco): status strip pasiva, input focus ring signal.
- **Submitting** (`busy = true`): status strip en estado `active` (relleno signal, cronómetro tabular monospace ticking desde submit). Form fieldset disabled. CTA cambia label a "GENERANDO…" y se desactiva. Sin spinner rotando — el cronómetro ES la motion.
- **Success** (response ok): status strip vuelve a pasiva con transición de 200ms. Aparece chalk card con: title (display italic), metadatos en mono tabular (DURACIÓN · EJERCICIOS · FOCO), markdown renderizado en `prose prose-invert`. Inline actions debajo del título (ghost).
- **Edit mode** (toggle): chalk card entra en `data-edit="true"` → border-left 1px signal (la regla de tiza). Reemplaza el bloque render con grid de 2 columnas (≥md) o stack (<md): textarea mono a la izquierda, vista previa markdown a la derecha. CTA Guardar (signal) habilita sólo si hay delta entre `editedContent` y `result.content`. Cancelar (ghost) revierte.
- **Error** (API failed o response vacío): strip vuelve a pasiva con label "REINTENTAR" si `busy` se desactiva sin éxito. Toast rojo "No se pudo generar el plan. Intenta de nuevo."

## Interaction & layout

- **Top**: status strip fija con nombre de la Clase (display italic) a la izquierda y CTA pill `GENERAR` a la derecha. La pill se mueve entre estados según `busy` + editing vs view.
- **Body (focus state)**: container `max-w-3xl mx-auto px-5 md:px-8`. Stack vertical: `<form>` con `<fieldset disabled={busy}>` y un único `<Textarea>` para `focus` (label visible: "FOCO DE LA SESIÓN").
- **Body (post-generate)**: la chalk card reemplaza el form. Stack: title → divider hairline → metadata → divider → markdown → divider → actions row.
- **Body (edit mode)**: dentro del `[data-edit="true"]`, split textarea+preview. El border-left signal es el focus indicator.
- **Cronómetro (sólo en submitting)**: absoluto en la status strip, derecha, `tabular` numerals. Sin segundos visualmente saltando — actualiza cada 1000ms. Para al volver a pasiva.
- **No sidebar. No modal.** Regeneración es la única acción con `window.confirm`, no Dialog.

## Components involved

- `status-strip` (signature) — el componente que define el sistema.
- `chalk-card` (signature) — el contenedor de la Idea.
- `Textarea` shadcn (focus + edit modes).
- `ReactMarkdown` + `remark-gfm` para render del `content`.
- `ScrollArea` para la vista previa en edit mode sólo si el contenido excede ~80vh.
- `Button` primary + ghost (nunca icon-only para acciones principales).
- Sonner toasts.

## Animation

La única transición coreografiada:
- **Status strip transition** (`ease-strip`, 200ms): pasiva → active (signal-fill + texto canvas) cuando LLM genera; active → pasiva cuando aterriza. El cronómetro tabular es la motion constante durante `busy`.
- **Hairline border-left en chalk card** durante edit: aparece con `150ms ease` (la regla de tiza).
- **Cero** hover scale/translate. Cero entrance fades. Cero parallax.

## Open / undecided

- Streaming del response: el LLM entrega `content` completo; no hay streaming token-by-token. Si el día de mañana se quiere streaming, la status strip ya está diseñada para alojar el cronómetro ticking.
- Sin vista comparativa "Idea original vs editada" — sólo diff mental del coach.
- Sin historial de versiones por Idea. La Clase-edit-then-save garantiza inmutabilidad histórica pero no se hace rollback.

## Resolución previa

- **El momento-LLM está aquí**, no en otra superficie. Toda decisión visual en esta brief prioriza hacer este momento espectacular (signal-fill cronómetro, no spinner).
- **Type-Voice Rule**: el display italic sólo en el título de la Idea.
- **Measure Rule**: el markdown prose dentro de la chalk card respeta `max-w-prose` para que la lectura respire.
- **Sin icon-only buttons como acciones principales**: Copiar / Exportar / Regenerar / Editar son ghost text-only con iconito a la izquierda.
