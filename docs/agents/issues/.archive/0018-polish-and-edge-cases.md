---
label: chore
status: open
parent: 0012-saved-weight-records
phase: 6
adr: 0009-saved-weight-records
depends_on:
  - 0017-full-history-page
blocks:
  - 0019-docs-and-verify
affects:
  - src/app/tools/weight-calculator/_components/calculator-client.tsx
  - src/app/tools/weight-calculator/_components/save-record-form.tsx
  - src/app/tools/weight-calculator/_components/saved-records-panel.tsx
  - src/app/tools/weight-calculator/history/_components/history-client.tsx
  - src/app/tools/weight-calculator/history/_components/history-row.tsx
---

# 0018 — Fase 6: Polish & edge cases

## Contexto

Sexta fase del umbrella [0012-saved-weight-records](./0012-saved-weight-records.md). Las cinco fases anteriores entregan la feature funcional. Esta fase la hace **nativa** del design system: a11y completa, mobile fluido, edge cases cubiertos, sin warnings de consola ni de lint. No agrega funcionalidad nueva; hace que lo existente se sienta terminado.

Este es típicamente un PR de polish largo pero mecánico. Si crece demasiado, partirlo en sub-PRs por superficie (calculadora, página de historial).

## Tareas

### 1. A11y

#### 1.1. Calculadora — form `Guardar` y mini-panel

- [ ] El input `Ejercicio` tiene `<label htmlFor="...">` asociado, no sólo label visual.
- [ ] El `<datalist id="exercise-history">` no necesita label (es implícito del input asociado).
- [ ] El botón `Guardar` (footer) tiene `aria-label` descriptivo cuando está disabled: `aria-label="Sin carga para guardar"` para que screen readers no digan sólo "Guardar, deshabilitado".
- [ ] El form inline (Fase 2) tiene `role="region"` o `aria-labelledby` apuntando al label "Ejercicio" para que screen readers anuncien el contexto al entrar.
- [ ] El mini-panel de registros (Fase 4) tiene `aria-label="Cargas guardadas"` o `<h2>` interno.
- [ ] Las filas del mini-panel son `<li>` dentro de `<ul aria-label="Cargas guardadas">` (estructura semántica correcta, no `<div>`s anidados).
- [ ] El botón `Cargar` por fila tiene `aria-label` que incluya el ejercicio: `Cargar Back Squat 80kg`.
- [ ] El link `Ver historial completo →` tiene `aria-label="Ver historial completo de cargas"`.

#### 1.2. Página de historial

- [ ] Input de búsqueda: `<label>` o `aria-label="Buscar por ejercicio"`.
- [ ] Chips de filtro: `aria-pressed={sourceFilter === "auto-log"}` etc., `aria-label` descriptivo por chip.
- [ ] Select de sort: `<label>` o `aria-label="Ordenar por"`.
- [ ] Lista: `<ul aria-label="Registros de cargas">`.
- [ ] Cada fila: `<li>` (no `<div>`). Los tres botones (`Cargar`, `Copiar`, `Eliminar`) tienen `aria-label` que incluya el ejercicio.
- [ ] Mensajes de empty state (`Sin registros todavía`, `Ningún resultado coincide`) tienen `role="status"` y `aria-live="polite"` para que screen readers los anuncien al cambiar.
- [ ] La barra sticky (search + filtros + sort) tiene `<div role="search">` o `aria-label="Filtros y orden"` para landmark.

#### 1.3. Focus management

- [ ] Cuando el form `Guardar` se abre, el focus va al input `Ejercicio` (no al body).
- [ ] Cuando el form se cierra (submit o cancel), el focus vuelve al botón `Guardar` que lo abrió.
- [ ] Cuando se elimina un registro en la página de historial, el focus se mueve al siguiente registro (o al anterior si era el último). No queda "perdido" en el body.
- [ ] Cuando el search sticky se monta, el focus no salta (no es un modal).

### 2. Mobile

#### 2.1. Calculadora

- [ ] En viewport `< sm` (640px), el form `Guardar` ocupa full-width dentro del footer. El input no se corta.
- [ ] El footer sticky con el form abierto **no** tapa el contenido scrollable de arriba. Verificar con un iphone SE (375x667) que se puede ver el bar visualization mientras el form está abierto.
- [ ] El mini-panel de registros (Fase 4) en mobile: las filas son una card vertical con nombre arriba, totales al medio, fecha + `Cargar` abajo. No más de 2-3 líneas por fila.
- [ ] Botones touch target ≥ 44x44px (verificar `Cargar`, `Copiar`, `Guardar`, `Cancelar`).
- [ ] Sin overflow horizontal accidental (iOS Safari es quisquilloso con esto).

#### 2.2. Página de historial

- [ ] Search sticky no overflows. Los chips de filtro se envuelven a la siguiente línea si no caben.
- [ ] El select de sort ocupa full-width en mobile (no inline con los chips).
- [ ] Las filas en mobile: botones `Cargar` / `Copiar` / `Eliminar` apilados verticalmente con full-width o en grid 3-col. Decisión: grid 3-col con texto más corto (`Cargar` | `Copiar` | `Eliminar`, sin iconos en mobile) — ajustar según prueba visual.
- [ ] El total del peso se mantiene visible sin necesidad de scroll horizontal.

### 3. Edge cases

#### 3.1. Storage quota

- [ ] Si `addRecord` tira `QuotaExceededError` (5MB cap de `localStorage` alcanzado), el helper actual loguea warn. Mejorar a un toast: `toast.error("Sin espacio para guardar más cargas. Exportá el historial o limpiá el navegador.")`. Decisión: ¿queremos el feedback o sólo el warn silencioso? **Default**: toast. La calculadora es un utility, no un sistema silencioso.
- [ ] Si el JSON de `pd:calculator-records` está corrupto (e.g., un dev editó manualmente a `[1,2,3]`), `getRecords` debe filtrar con Zod y descartar. Verificar que la versión actual ya lo hace (issue 0013 lo cubre); este issue verifica que el path completo (load → filter → render) no rompe.
- [ ] Si el coach guarda un registro con `barKg: 0` o negativo, Zod lo rechaza. Verificar que `addRecord` no rompe con un input inválido (debería ser imposible porque los inputs UI validan, pero defensa en profundidad).

#### 3.2. Race conditions

- [ ] `Guardar` + auto-log en el mismo tick: el form submit genera un manual; el auto-log genera un auto-log. Ambos con IDs únicos. No colisión. (Cubierto por issue 0015; verificar con un test manual.)
- [ ] Doble click en `Guardar`: el botón se deshabilita durante el submit. Si no está deshabilitado, se crean dos registros con timestamps muy cercanos pero IDs distintos. **Decisión**: deshabilitar el botón durante el click para evitar duplicados accidentales.
- [ ] Eliminar un registro mientras se está renderizando otro: el storage event re-dispara, el state se actualiza, no hay referencia colgante.

#### 3.3. Foto + Guardar

- [ ] Si el coach sube una foto, la aplica, y luego click `Guardar` con etiqueta: se crea un registro `source: "foto"` (de la fase 3, inmediato) **y** un registro `source: "manual"` con la etiqueta. **Decisión**: ¿queremos deduplicar? **Default**: no. Cada uno tiene su propósito: el foto es la atribución del origen, el manual es la unidad con nombre. Si el coach quiere evitar el foto, puede Descartar el preview antes de aplicar (eso ya no crea nada).
- [ ] Si el coach sube una foto, no la aplica (cancela), y usa el form `Guardar` con el estado previo: sólo se crea un `manual` con el estado actual. El foto nunca se aplicó, así que no hay registro `source: "foto"`. (Verificar.)

#### 3.4. Cargar + edición

- [ ] `Cargar` desde el mini-panel con el estado actual idéntico: no-op silencioso. (Cubierto por issue 0016; verificar.)
- [ ] `Cargar` desde la página de historial: escribe a `pd:calculator-state` y navega. La calculadora rehidrata y **pierde** el draft que tenía antes. **Decisión actual**: aceptar. Si el coach quiere proteger el draft, debería Guardar primero. Documentar en el PR description.

### 4. Console hygiene

- [ ] Cero `console.log` o `console.warn` durante uso normal (excepto los `console.warn` de storage corruption, que son desired).
- [ ] Cero `console.error` en flujos esperados.
- [ ] No `eslint-disable` innecesarios. Cada disable tiene comentario de por qué.
- [ ] `npm run lint` 0 errors, 0 warnings.
- [ ] `npm run build` 0 errors.

### 5. Performance

- [ ] El watcher de auto-log (issue 0015) no genera re-renders innecesarios. El `useEffect` con `[barKg, discs]` dispara en cada cambio, pero el cleanup con `clearTimeout` es lo único que importa. Verificar con React DevTools Profiler que no hay renders excesivos.
- [ ] El `getRecentRecords(5)` en el mini-panel no itera arrays de 1000+ registros. (Cap 200, así que es trivial.) Pero igual: si el array crece, evaluar memoización.
- [ ] La página de historial con 200 registros renderiza en < 100ms. (Verificar con React DevTools.)
- [ ] El storage event listener está cleanup'd correctamente en unmount.

### 6. Visuales (per design system)

- [ ] Cero `box-shadow`. Cero `backdrop-filter`. Cero gradientes.
- [ ] El `text-bone` para texto principal, `text-mute` para metadata. Contraste ≥ 4.5:1 (verificar con axe DevTools).
- [ ] El verde `signal` sólo aparece en: CTAs primarias, focus rings, badges de source (no — los badges son mute, no signal). Verificar.
- [ ] Las hairlines son `1px solid` (no `2px`).
- [ ] El display italic (Archivo Narrow) sólo se usa en nombres de registros. No en labels de filtro ni en el sort.

### 7. Empty states

- [ ] Mini-panel (calculadora) con 0 registros: empty state visible, copy claro, link al historial visible o no (decisión: no, está vacío así que no invita a más vacío).
- [ ] Página de historial con 0 registros: empty state con CTA a la calculadora.
- [ ] Página de historial con resultados filtrados = 0 (pero hay registros sin filtrar): empty state "Ningún resultado coincide con el filtro." con botón "Limpiar filtros".

## Aceptación

- [ ] `npm run build` y `npm run lint` 0 errors, 0 warnings.
- [ ] Lighthouse a11y score ≥ 95 en `/tools/weight-calculator` y en `/tools/weight-calculator/history`.
- [ ] Manual con keyboard-only (sin mouse): tab, enter, escape — todo el flujo Guardar / Cargar / Eliminar funciona.
- [ ] Manual con screen reader (VoiceOver en macOS o NVDA en Windows): cada acción se anuncia con contexto (nombre del ejercicio, tipo de registro, etc.).
- [ ] Manual en mobile (375px viewport): nada se rompe, todos los touch targets son alcanzables, no overflow horizontal.
- [ ] Manual: edge cases 3.1, 3.2, 3.3, 3.4 se comportan según especificación.
- [ ] Capturas de pantalla:
  - Calculadora mobile + desktop, sin form abierto, con form abierto, con registros en el mini-panel.
  - Página de historial mobile + desktop, con/sin registros, con/sin filtros activos, con empty state, con search sticky en uso.

## Decisiones durables

- A11y: ningún `aria-*` decorativo. Cada uno tiene propósito.
- Mobile: las decisiones de layout (grid vs stack, full-width vs auto) son las que están en las descripciones. Cambios se hacen en PRs de polish subsecuentes.
- Edge cases 3.x: el comportamiento documentado es la fuente de verdad. Cambios requieren nuevo issue.
- Console hygiene: la regla es cero ruido en uso normal. Los warns de storage corruption son la excepción justificada.

## Out of scope

- Refactors no relacionados (e.g., reorganizar `calculator-client.tsx` que ya es largo). Si urge, se hace en PR aparte.
- Cambios al design system (paleta, type scale, etc.). Esto es polish **dentro** del design system.
- Tests automatizados (no se introdujo infra de testing en este umbrella). Si el equipo decide sumar tests, un PR aparte.

## Follow-ups (no en este PR)

- Si el coach pide `Intl.RelativeTimeFormat` (vs el helper inline), se cambia. Default actual: helper inline, suficiente.
- Si los tests automatizados se vuelven prioritarios, este es el primer surface a cubrir (muchos helpers puros en `lib/calculator/history.ts`).
- Si el cap de 200 resulta muy bajo o muy alto, ajustar.
