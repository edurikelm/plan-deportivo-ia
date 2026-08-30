---
label: feature
status: open
parent: 0018-ui-ux-polish
depends_on:
  - "0020"
blocks: []
---

# 0022 — /sessions page: browse, search, filter, sort, delete with undo

## Parent

[0018 — UI/UX polish: guards, history completeness, design tokens](../0018-ui-ux-polish.md)

## What to build

Una nueva ruta `/sessions` que expone la lista completa de `SavedSession` guardadas. Es la pareja natural de `/tools/weight-calculator/history` (precedente de 0016) y resuelve la limitación del mini-historial de 5 items.

1. **`/sessions/page.tsx` (Server Component)** que monta status strip + el client component. Status strip con back a `/classes` y label "Sesiones guardadas" (en `font-display italic font-semibold text-lg`).

2. **`/sessions/_components/sessions-client.tsx` (Client Component)** que:
   - Lee `pd:sessions` con `useSyncExternalStore` (patrón 0012 — `AGENTS.md:91-92`).
   - Helper `parseSessionsFromRaw(raw: string | null): SavedSession[]` paralelo a `parseRecordsFromRaw` de `src/lib/calculator/history.ts`. Tolerante: filtra entries corruptas con `console.warn` dev-visible, no rompe la UI.
   - Renderiza search input + filter chips + sort selector + lista + empty state.

3. **Search input** (`<input type="search">`):
   - `font-mono` con placeholder `Buscar por título…`.
   - Filtra case-insensitive con `String.prototype.includes` sobre `session.title` y `session.markdown` (primer heading como fallback si title es vacío).
   - Sin debounce — búsqueda local sobre < 100 items es instantánea.

4. **Modality filter** (chip group):
   - Default "Todas" + una chip por cada `modalityId` presente en los datos (hoy solo `crossfit`, pero la estructura es extensible).
   - Single-select. Mismo visual que los chips de duración en `generate-client.tsx:566-587` (mono tabular, hairline border, signal fill cuando selected).
   - Cuando el filtro activo da 0 resultados, mensaje inline `"No hay sesiones de {modality} que coincidan con tu búsqueda."` (mute, no empty state).

5. **Sort selector** (`<Select>` base-ui):
   - Opciones: `Más recientes` (default), `Más antiguos`, `Título A-Z`, `Título Z-A`.
   - Mismo componente `Select` que `generate-client.tsx:633-654`.

6. **Session list**:
   - `<ul>` con `space-y-px bg-hairline rounded-none overflow-hidden` (mismo patrón que `classes/page.tsx:32-65` y mini-historial).
   - Cada item es un `<li class="bg-panel">` con `<article class="chalk-card border-0 px-4 py-3">`.
   - Header: `title` en `font-display italic font-semibold text-sm leading-none tracking-tight text-bone truncate` + meta `createdAt` + `duration` + `model` en mono tabular.
   - Footer: 4 acciones ghost con `font-mono tabular text-[0.6875rem] tracking-[0.04em] text-mute hover:text-bone transition-colors flex items-center gap-1`:
     - **`Cargar`** (`FolderOpen` icon) — usa `loadSessionInto` de 0020, `setResult` en el `GenerateClient` vía query param `?fromSession={id}`. Toast `"Sesión cargada — redirigiendo…"`. `router.push("/generate/{modalityId}?fromSession={id}")`.
     - **`Copiar`** (`Copy` icon) — usa `copyToClipboard` de 0020.
     - **`Exportar`** (`Download` icon) — usa `downloadAsMarkdown` de 0020.
     - **`Eliminar`** (`Trash2` icon) — abre `window.confirm("¿Eliminar esta sesión?")`. Si confirma, `removeSession(id)` de storage, toast `"Sesión eliminada"` con `action: "Deshacer"` (5 segundos) que restaura la entry vía `addSession(deletedSession)`.

7. **Empty state**:
   - Si la lista filtrada está vacía por búsqueda/filter, mensaje inline (no empty state de página completa).
   - Si la lista total está vacía, chalk-card con label `Vacío` + descripción `"Generá una sesión y guardala. Todas las que persistas aparecen acá."` + link a `/classes`.

8. **Responsive**:
   - Mobile: stack vertical único (search + filter + sort arriba, lista abajo).
   - `lg+`: filter y sort pueden ir en una row horizontal arriba de la lista; lista full-width.
   - Mismo breakpoint y contenedor que `/generate/[modalityId]`: `max-w-5xl mx-auto px-5 md:px-8 py-10`.

9. **Cross-tab sync**: usar el patrón existente en `src/lib/storage.ts` con `dispatchStorage` (per `AGENTS.md:91`). Si dos tabs están abiertas, cambios en una refrescan la otra automáticamente.

Patrón storage: `useSyncExternalStore` con raw JSON snapshot. Read/write vía `getSessions()`, `addSession()`, `updateSession()`, `removeSession()` de `src/lib/storage.ts`. `isQuotaError` en `addSession` (toast accionable). `crypto.randomUUID()` para IDs nuevos.

## Blocked by

- **0020** — Necesita `copyToClipboard`, `downloadAsMarkdown` y `loadSessionInto` helpers para mantener consistencia con `/generate/[modalityId]` y el mini-historial.

## Acceptance criteria

- [ ] La ruta `/sessions` existe, renderiza sin errores, tiene status strip con back a `/classes` y label "Sesiones guardadas".
- [ ] La lista muestra TODAS las `SavedSession` de `pd:sessions`, ordenadas por `createdAt` desc por default.
- [ ] El search input filtra en tiempo real (sin debounce) sobre `title` y `markdown`, case-insensitive.
- [ ] El modality filter muestra "Todas" + una chip por `modalityId` presente. Single-select.
- [ ] El sort selector tiene 4 opciones y la default es "Más recientes".
- [ ] Cada item muestra: title, createdAt, duration, model. Trunca title con `truncate` si excede.
- [ ] La acción `Cargar` redirige a `/generate/{modalityId}?fromSession={id}` y muestra toast.
- [ ] El `GenerateClient` lee `?fromSession` en mount y hace `loadSessionInto` tras el primer paint (cambio a aplicar en `generate-client.tsx` o un nuevo wrapper).
- [ ] La acción `Copiar` usa `copyToClipboard` de 0020 y muestra toast.
- [ ] La acción `Exportar` usa `downloadAsMarkdown` de 0020 con filename `{slug}-{YYYY-MM-DD}.md`.
- [ ] La acción `Eliminar` muestra `window.confirm`, luego `removeSession` + toast con `Deshacer` (5s) que restaura.
- [ ] El empty state aparece si `pd:sessions` está vacío (con link a `/classes`).
- [ ] El empty state inline aparece si la búsqueda/filter da 0 resultados (sin link, solo mensaje).
- [ ] La página es navegable por teclado: Tab atraviesa search → filter → sort → lista → acciones. Enter activa botones.
- [ ] Tap targets ≥ 44x44px en mobile (`button` con `min-h-11` o padding equivalente).
- [ ] Cross-tab sync funciona: cambios en una tab se reflejan en otra sin refresh.
- [ ] `npm run build` pasa.
- [ ] `npm run lint` pasa.

## Manual end-to-end test

### Setup

- `npm run dev` y abrir `http://localhost:3000/classes`.
- DevTools → Application → Local Storage → delete `pd:sessions` (clean slate).
- Generar y guardar 7 sesiones distintas con diferentes parámetros (variar `durationMinutes`, `wodFormat`, `focusMovement`).

### Steps

1. **Lista completa.**
   - Navegar a `/sessions` (link desde `/classes` o URL directa).
   - Expect: las 7 sesiones aparecen, ordenadas por `createdAt` desc.

2. **Search.**
   - Escribir en el search: una palabra que esté en el `title` de 2 sesiones.
   - Expect: la lista se filtra a esas 2 en tiempo real, sin debounce visible.
   - Borrar el search.
   - Expect: vuelven a aparecer las 7.

3. **Modality filter.**
   - Click en la chip "crossfit" (la única por ahora).
   - Expect: filtra a las 7 (todas son crossfit).
   - Click "Todas".
   - Expect: vuelven las 7.

4. **Sort.**
   - Cambiar sort a "Más antiguos". Expect: orden ascendente.
   - Cambiar a "Título A-Z". Expect: orden alfabético.
   - Cambiar a "Título Z-A". Expect: orden inverso.
   - Volver a "Más recientes".

5. **Cargar desde la lista.**
   - Click `Cargar` en una sesión. Expect: redirige a `/generate/crossfit?fromSession={id}`.
   - Tras el paint, la card muestra esa sesión. El form está poblado con sus inputs.
   - El indicador `SIN GUARDAR` no aparece.

6. **Copiar desde la lista.**
   - Volver a `/sessions`. Click `Copiar` en otra sesión.
   - Expect: toast "Copiado al portapapeles".

7. **Exportar desde la lista.**
   - Click `Exportar`. Expect: descarga `.md` con filename correcto.

8. **Eliminar con undo.**
   - Click `Eliminar` en una sesión. `window.confirm` aparece. Aceptar.
   - Expect: la sesión desaparece de la lista, toast con botón `Deshacer` aparece (5s).
   - Click `Deshacer` antes de los 5s.
   - Expect: la sesión vuelve a aparecer en su posición original.
   - Repetir el `Eliminar`, NO clickear `Deshacer`, esperar 5s.
   - Expect: el toast desaparece, la sesión queda eliminada definitivamente.

9. **Empty state (clean slate).**
   - Limpiar `pd:sessions` desde DevTools. Refrescar `/sessions`.
   - Expect: chalk-card con label `Vacío` + descripción + link a `/classes`.

10. **Empty state (filter sin matches).**
    - Con sesiones cargadas, escribir en search algo que no matchee ninguna.
    - Expect: mensaje inline "No hay sesiones que coincidan con tu búsqueda." (mute, sin chalk-card de empty).

11. **Cross-tab sync.**
    - Abrir `/sessions` en dos tabs. En tab A, eliminar una sesión.
    - En tab B (sin refresh).
    - Expect: la sesión desaparece automáticamente.

12. **Mobile responsive.**
    - DevTools → Toggle device toolbar → iPhone 12 viewport.
    - Expect: la lista es legible, los tap targets son ≥ 44x44px, no hay overflow horizontal.
