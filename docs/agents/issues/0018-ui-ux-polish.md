---
label: feature
status: closed
parent: null
closed_at: 2026-09-02
---

# 0018 — UI/UX polish: guards, history completeness, design tokens

## Problem Statement

El Entrenador usa Plan Deportivo IA como herramienta cotidiana de planificación. La base es sólida — un design system disciplinado (`DESIGN.md`), un patrón de `active result` efímero bien protegido, y la calculadora ya cuenta con un historial completo (`/tools/weight-calculator/history`, umbrella 0012). Pero la superficie de `/generate/[modalityId]` y la home `/classes` arrastran fricciones reales que el coach encuentra desde la primera sesión:

- **Pérdida accidental de trabajo.** El botón `back` del status strip en `/generate/[modalityId]` navega sin chequear `hasUnpersistedWork`; el `beforeunload` guard solo dispara en refresh/close. Una sesión de 13s de generación + edición de markdown se puede perder por un back distraído.
- **Validación ciega.** Los errores de campos obligatorios (`strengthSkill`, `wodFormat`) solo aparecen después de tocar `Generar`. El coach que tabula entre campos no recibe feedback hasta el submit.
- **Mini-historial read-only.** Las últimas 5 `SavedSession` en `/generate/[modalityId]` solo permiten `Copiar` y `Exportar`. No hay forma de **re-abrir una sesión guardada** para iterar sobre ella (regenerar con un tweak, editar markdown, mover a otro día). Si guardaste 12 sesiones, las 7 que no entran al mini-historial son inaccesibles sin una página dedicada.
- **No hay browse de sesiones.** La simetría con la calculadora pide una ruta `/sessions` con búsqueda + filtros + sort. Hoy el coach no puede responder "¿cuál fue la sesión de snatch que generé la semana pasada?" sin scroll infinito en el mini-historial.
- **Form vacío en cada visita.** `/generate/crossfit` arranca con defaults hardcodeados. Un coach que planifica siempre sesiones de 60 min AMRAP re-ingresa los mismos parámetros cada vez.
- **Home estática.** `/classes` no muestra rastro de actividad reciente. No hay "última sesión: *Snatch & Burpees* — hace 2 días" ni "12 sesiones guardadas en CrossFit este mes".
- **No hay export/import.** Sin settings page, el coach no puede: exportar todas sus `pd:*` keys como backup, importar de un backup anterior, ni ver la versión de la app o el modelo activo. Cambiar de navegador o perder localStorage significa empezar de cero.
- **Inconsistencias de DRY.** El botón `Regenerar` aparece duplicado (status strip + footer de card). La lógica de `Copiar` y `Exportar` está re-implementada inline en el mini-historial. Cualquier cambio futuro debe sincronizarse en múltiples lugares.
- **Inconsistencias visuales.** `text-mute` se usa para dos roles distintos (placeholder + label secundario). El cronómetro en `text-2xl` compite con el título de la sesión en `text-2xl` cuando el status strip está en estado activo. La prop `prose prose-invert` se aplica con overrides distintos en `CrossFitPlanView` vs fallback `ReactMarkdown`, dando aspect ratios diferentes entre sesiones pre-0011 y nuevas.

Para un single-user app donde el coach vive adentro todos los días, estas fricciones se acumulan. El polish es operacional: cada punto arreglado reduce el costo cognitivo de planificar.

## Solution

Un umbrella de polish dividido en **7 módulos verticales**, cada uno entregable de forma independiente y testeable. Los módulos respetan los patrones establecidos en `AGENTS.md` (storage con `pd:*`, `useSyncExternalStore`, `crypto.randomUUID()` para IDs, helpers puros en `src/lib/...`, `isQuotaError` en todo write).

**M1 — Guards de navegación y validación de forms.**
- `onClick` handler en el back del status strip que evalúa `hasUnpersistedWork` y dispara `window.confirm` antes de navegar. Mismo umbral que `handleRegenerate`.
- Validación on-blur por campo en el form de generación. Estado `touched` por campo que se setea en el primer blur o submit, y dispara validación reactiva.

**M2 — Cargar en mini-historial.**
- Acción `Cargar` en cada item del mini-historial (`:929-987`) que reemplaza el `active result` con el snapshot de la sesión guardada: `markdown`, `structured`, `input`, `title`, `model`, `id`, `createdAt`.
- El flow "guardada → Cargar → Regenerar" da iteración de 1-click sobre WODs pasados.
- Toast `Sesión cargada — listo para regenerar o editar`.

**M3 — Ruta `/sessions` con browse completo.**
- Nueva ruta server-shell + client-component, simétrica con `/tools/weight-calculator/history` (precedente de 0016).
- Lista todas las `SavedSession` de `pd:sessions` con búsqueda por título/descripción (case-insensitive), filtro por `modalityId`, sort por `createdAt` desc/asc o título.
- Acciones por fila: `Cargar` (mismo comportamiento que M2), `Copiar`, `Exportar`, `Eliminar` con `window.confirm` y undo snackbar.
- Empty state honesto si no hay sesiones.
- Mobile-first: lista apilada en mobile, dos columnas en `lg+` (igual que calculator history).
- Patrón reactivo: `useSyncExternalStore` con raw JSON snapshot (no `useState + useEffect`).

**M4 — DRY utilities y consolidación de Regenerar.**
- Crear `src/lib/clipboard.ts` con `copyToClipboard(text): Promise<void>` y `downloadAsMarkdown(filename, text): void`. Usar en `handleCopy`/`handleExport` de `generate-client.tsx` y en los handlers inline del mini-historial.
- Crear `src/lib/sessions.ts` (barrel) con `loadSessionInto(state, savedSession): void` (helper puro que arma la transición de estado).
- Decisión arquitectónica: **sacar `Regenerar` del footer de la card**, dejarlo solo en el status strip. La card mantiene solo acciones de resultado (`Guardar`, `Copiar`, `Exportar`, `Editar`). Alinea con `DESIGN.md:267` (acciones son anotaciones al pie, no toolbar encima).

**M5 — Persistencia de input + mini-status en `/classes`.**
- Auto-guardar el form de generación en `pd:last-input-{modalityId}` con debounce 500ms en cada cambio. Hidratar al mount del `GenerateClient`. Sin impacto en el active result efímero.
- Nueva sección arriba de la lista de modalidades en `/classes`: si hay sesiones guardadas, mostrar la más reciente con `Reabrir` (link a `/generate/{modalityId}` con `?fromSession={id}`) y un contador `N sesiones guardadas`. Empty state honesto si el `pd:sessions` está vacío (reemplaza el estado actual de "siempre hay 1 modalidad").

**M6 — Design tokens y jerarquía visual.**
- Agregar `.numeric` utility class en `globals.css:203` con `font-family: var(--font-mono)` + `font-variant-numeric: tabular-nums`. Reemplazar `font-mono tabular` instances (~30 ocurrencias) por `numeric`.
- Agregar `.prose-chalk` utility que centraliza todos los `prose prose-invert` overrides del sistema. Aplicar en `CrossFitPlanView` (`crossfit.tsx:54-68`) y fallback `ReactMarkdown` (`generate-client.tsx:752-757`).
- Cronómetro en status strip: bajar de `text-2xl` a `text-xl` para establecer jerarquía "label > time" en estado activo (`generate-client.tsx:502-508`).
- Documentar los nuevos tokens en `DESIGN.md` typography y components sections.

**M7 — Ruta `/settings` con export/import.**
- Ruta client-only con secciones colapsables:
  - **Modelo** — nombre del provider/model activo (read-only, derivado de la constante).
  - **Datos** — botón `Exportar todo` que descarga `{ pd:sessions, pd:calculator-state, pd:calculator-records, pd:last-input-* }` como JSON timestamped. Botón `Importar backup` con file input + `window.confirm` antes de pisar.
  - **Acerca de** — versión de la app (de `package.json`), link a `docs/`, link al repo.
- Patrón storage: `isQuotaError` en write; `parseJsonOrNull` tolerante en read.
- Si los datos importados son corruptos, mostrar error accionable (no crashear).

## User Stories

1. As an Entrenador, I want to be warned before navigating away from `/generate/[modalityId]` with unsaved work, so that I don't lose a 60s generation or pending edit.
2. As an Entrenador, I want field-level validation to surface on blur (not on submit), so that I see what's missing as I tab between fields.
3. As an Entrenador, I want the `strengthSkill` and `wodFormat` errors to remain visible after first submit until the field is fixed, so that I don't have to re-trigger the error.
4. As an Entrenador, I want a `Cargar` action on each mini-history item, so that I can re-open a saved session in the editor and iterate.
5. As an Entrenador, I want the loaded session to populate the form inputs with the original parameters, so that `Regenerar` after `Cargar` uses the same brief.
6. As an Entrenador, I want a `/sessions` page where I can browse all my saved sessions, so that I can find one older than the last 5.
7. As an Entrenador, I want to search the sessions list by title, so that I can find "the snatch WOD from last week" without scrolling.
8. As an Entrenador, I want to filter the sessions list by modality, so that I can focus on CrossFit sessions (or any future modality).
9. As an Entrenador, I want to sort the sessions list by `createdAt` ascending, so that I can walk through my history chronologically.
10. As an Entrenador, I want a `Eliminar` action on each session in `/sessions` with confirmation, so that I can prune stale or test sessions.
11. As an Entrenador, I want an undo snackbar after deleting a session, so that I can recover if I clicked by accident.
12. As an Entrenador, I want the `/sessions` page to work the same on mobile and desktop, so that I can browse from my phone in the gym.
13. As an Entrenador, I want a single source of truth for `Copiar` and `Exportar` logic, so that the toast and error handling are consistent across the app.
14. As an Entrenador, I want the `Regenerar` button to live only in the status strip, so that the chalk card stays focused on the result's actions (`Guardar`, `Copiar`, `Exportar`, `Editar`).
15. As an Entrenador, I want my form input to be remembered between visits, so that I don't retype the same parameters every time.
16. As an Entrenador, I want the form input to be remembered per-modality, so that CrossFit brief doesn't pollute a future Powerlifting brief.
17. As an Entrenador, I want `/classes` to show my most recent saved session, so that I have a quick "Reabrir" path back to my work.
18. As an Entrenador, I want `/classes` to show the total count of saved sessions, so that I have a sense of how much I've accumulated.
19. As an Entrenador, I want `/settings` to expose an `Exportar todo` action, so that I can back up my data before changing browsers or clearing localStorage.
20. As an Entrenador, I want `/settings` to expose an `Importar backup` action, so that I can restore from a previous backup.
21. As an Entrenador, I want the import flow to confirm before overwriting existing data, so that I don't blow away my history by accident.
22. As an Entrenador, I want `/settings` to show the active model name, so that I know what's generating my sessions.
23. As an Entrenador, I want a `.numeric` utility class for tabular-nums monospace text, so that the design system enforces number rendering consistently.
24. As an Entrenador, I want a `.prose-chalk` utility that unifies prose styling, so that the `CrossFitPlanView` and fallback `ReactMarkdown` render with the same line-height and spacing.
25. As an Entrenador, I want the cronómetro digits in the status strip to be smaller than the section label, so that the visual hierarchy reads `Generando > 00:13` instead of competing.
26. As an Entrenador, I want `text-mute` to be reserved for muted metadata, not for `(opcional)` label suffixes, so that I can distinguish a label from a placeholder at a glance.

## Implementation Decisions

### M1 — Guards y validación
- Back button: convertir de `<Link>` pasivo a `<Button onClick={handleBack}>` que evalúa `hasUnpersistedWork`. Si true, `window.confirm("Tenés cambios sin guardar. ¿Salir?")` antes de `router.push("/classes")`. False → navega directo.
- Validación: introducir `touched: { strengthSkill: boolean, wodFormat: boolean }` en state. `handleBlur(field)` lo setea. La prop `aria-invalid` y el mensaje de error se muestran solo si `touched[field] && errors[field]`. Submit marca todos como `touched` para mostrar todos los errores a la vez. Mismo threshold que ya existe para `handleRegenerate`.

### M2 — Cargar en mini-historial
- Botón nuevo `Cargar` en el footer del mini-historial item, junto a `Copiar` y `Exportar`. Mismo visual: `font-mono tabular text-[0.6875rem] tracking-[0.04em] text-mute hover:text-bone` con ícono `FolderOpen` de lucide.
- Handler: `handleLoadFromHistory(session)` que llama a un nuevo helper puro `loadSessionInto(session)` y luego `setResult(loaded)`, `setEditedMarkdown(null)`, `setMode("view")`, `setPersisted(true)`. Toast: "Sesión cargada — listo para regenerar o editar".
- `persisted: true` porque la sesión ya estaba guardada; refleja que el active result viene del storage, no es nuevo.
- `id` se preserva para que un futuro `Guardar` haga `updateSession` en lugar de `addSession` (idempotencia).

### M3 — Ruta `/sessions`
- Estructura de archivos: `src/app/sessions/page.tsx` (server) + `src/app/sessions/_components/sessions-client.tsx` (client). Mismo patrón que `/tools/weight-calculator/history`.
- Layout: `max-w-5xl mx-auto px-5 md:px-8 py-10` para coincidir con `/generate/[modalityId]`. Status strip con back a `/classes` y label "Sesiones guardadas".
- Componentes:
  - `<SearchInput>` — `<input type="search">` con `font-mono` y placeholder `Buscar por título…`. Sin debounce (búsqueda local sobre listas < 100 items es instantánea).
  - `<ModalityFilter>` — chip group con "Todas" + una chip por `modalityId` conocido. Single-select.
  - `<SortSelector>` — `<Select>` con opciones: `Más recientes`, `Más antiguos`, `Título A-Z`, `Título Z-A`. Default `Más recientes`.
  - `<SessionList>` — `ul` con `space-y-px bg-hairline`. Cada item es un `<li>` con `chalk-card border-0 px-4 py-3` (mismo patrón que mini-history).
  - `<SessionListItem>` — title + createdAt + duration + model en una línea. Footer con acciones `Cargar`, `Copiar`, `Exportar`, `Eliminar`.
- Data: `useSyncExternalStore` con `getRawSessions()` / `subscribeToSessions()` de `src/lib/storage.ts`. Helper `parseSessionsFromRaw(raw: string | null): SavedSession[]` (paralelo al `parseRecordsFromRaw` de 0012).
- Empty state: chalk-card con label `Vacío` + descripción `"Generá una sesión y guardala. Todas las que persistas aparecen acá."` + link a `/classes`.

### M4 — DRY utilities
- `src/lib/clipboard.ts`:
  - `copyToClipboard(text: string): Promise<{ ok: boolean; error?: string }>` que wrappea `navigator.clipboard.writeText` y retorna el resultado. El caller dispara el toast.
  - `downloadAsMarkdown(filename: string, text: string): void` que arma el Blob, `<a download>`, click, `URL.revokeObjectURL`. Sin retorno (fire-and-forget).
- `src/lib/sessions.ts`:
  - `loadSessionInto(current: SavedSession | null, source: SavedSession): SavedSession` — pure function que retorna `source` con `id` preservado (para idempotencia en `updateSession`).
- Eliminar `Regenerar` del footer de la card en `generate-client.tsx:794-803`. Mantener solo en status strip `:511-517`. Actualizar `DESIGN.md:267` si menciona la acción como parte de la card.
- Reemplazar handlers inline del mini-historial (`:949-953, 962-975`) por `copyToClipboard` y `downloadAsMarkdown` con filename `{slug}-{date}.md`.

### M5 — Persistencia de input + mini-status
- `pd:last-input-{modalityId}` — JSON con `CrossFitSessionInput`. Write con debounce 500ms en cada `onChange` del form. Read en `useEffect` de mount.
- Mini-status en `/classes`: client component (la home es server shell, agregar `<RecentActivityBanner>` en `classes/page.tsx`). Lee `pd:sessions` via `useSyncExternalStore`. Si vacío, no renderiza nada (no empty state — el catálogo de modalidades ya existe).
- Link `Reabrir` apunta a `/generate/{modalityId}?fromSession={sessionId}`. El `GenerateClient` lee el query param en mount y si está presente, hace `loadSessionInto` después del primer paint.

### M6 — Design tokens
- `.numeric` en `globals.css:203` (capa `@layer utilities`):
  ```css
  .numeric {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
  ```
- `.numeric-label` (con tracking `0.04em`) y `.numeric-display` (sin tracking, para IDs y montos) como variantes.
- `.prose-chalk` centraliza los overrides de `prose prose-invert` que hoy están inline en 2 lugares. Definir en `globals.css:203`. Aplicar donde hoy va `prose prose-invert prose-headings:font-display...`.
- Cronómetro: cambiar `text-2xl` por `text-xl` en `generate-client.tsx:502, 506`. Label "Generando" ya está en `text-[0.6875rem]`; asegurar que se mantiene la jerarquía visual.
- Documentar en `DESIGN.md:15-50` (typography section): agregar `.numeric` y `.prose-chalk` como utilities oficiales.
- Resolver `text-mute` ambiguity: introducir `--color-mute-strong: oklch(0.78 0.005 80)` para los sufijos `(opcional)` inline. Aplicar con nueva utility `.text-mute-strong` o `text-mute-strong/80` directo.

### M7 — Settings page
- Estructura: `src/app/settings/page.tsx` (server) + `src/app/settings/_components/settings-client.tsx` (client).
- Status strip con back a `/classes` y label "Configuración".
- Secciones colapsables (`<details>` con `<summary>` estilizado, sin animación). Default open en la sección `Datos`.
- **Modelo** — read-only display del provider/model. Read de una constante exportada desde `src/lib/modalities/crossfit-schemas.ts` (donde hoy está hardcodeado). No requiere cambio de schema, solo exportar el nombre.
- **Datos**:
  - `Exportar todo`: arma objeto `{ exportedAt, sessions, calculatorState, calculatorRecords, lastInputs }`, lo serializa, dispara download como `plan-deportivo-backup-{YYYY-MM-DD}.json`.
  - `Importar backup`: `<input type="file" accept="application/json">`. Al select, lee el file, valida shape mínimo (`{ sessions?: SavedSession[] }`), `window.confirm("Esto sobrescribirá tus datos actuales. ¿Continuar?")`, escribe cada key con manejo de `isQuotaError`.
  - `Limpiar todos los datos`: botón destructive con doble confirm. Útil para empezar de cero o regalar el navegador a otro coach.
- **Acerca de**: versión de `package.json` (read via fetch en build? no — client fetch está bien para MVP). Link a `docs/` (server route handler que devuelve el markdown? no — link externo al repo o página estática).

## Testing Decisions

- **Comportamiento a testear** (no implementación): interacciones de usuario y efectos en storage, no llamadas internas a funciones puras.
- **Módulos a testear con tests automatizados:**
  - `src/lib/clipboard.ts` — `downloadAsMarkdown` se puede testear mockeando `URL.createObjectURL` y capturando el `Blob` (ver precedent en `src/lib/calculator/history.test.ts` si existe, o crear).
  - `src/lib/sessions.ts` — `loadSessionInto` es pure, test unitario directo. Verifica que preserva `id`, `createdAt`, `model`.
  - `parseSessionsFromRaw` (en `src/lib/storage.ts` o nuevo helper) — test con JSON válido, JSON inválido, JSON con shape viejo (pre-0010), array vacío.
  - `isQuotaError` ya está testeado en 0012; no duplicar.
- **Módulos a verificar manualmente con script** (per precedent 0017):
  - M1 — back con guard, validación on-blur.
  - M2 — cargar desde mini-historial, regenerar post-load.
  - M3 — browse, search, filter, sort, eliminar + undo.
  - M5 — pre-fill del form, mini-status.
  - M7 — export/import roundtrip, limpiar datos.
- **No testear** (UI pura, cambios de estilo): M4 (DRY refactor) más allá de los helpers extraídos, M6 (design tokens) más allá de smoke test visual.
- **Visual verification**: screenshot del status strip en estado activo (cronómetro jerarquía), screenshot del form con error on-blur, screenshot de `/sessions` con datos seed.

## Out of Scope

- **Resolver la disonancia "Modalidades del sistema" con un solo item** (`/classes` hoy). Esto requiere una decisión de producto (¿rename a "Modalidad activa" o agregar más modalidades?). El mini-status de M5 mitiga la fricción visual pero no resuelve el problema semántico. Decidir en un ADR futuro o como follow-up de scope separado.
- **Comparar dos sesiones side-by-side** (item #23 del review). Feature con modelo de datos propio (selección dual, diff). Candidato para umbrella futuro.
- **Onboarding de primera vez** (item #24). Merece su propio spec con research de UX, no se mete en un umbrella de polish.
- **Cross-tab sync** (item #13). Útil pero edge case; el caso de uso primario (cambiar de tab mientras se trabaja) no es bloqueante. Diferir.
- **Renombrar `text-mute` para los label suffixes inline** (item #11): parte de M6 vía `.text-mute-strong`, pero el refactor de los 30+ call sites está fuera del scope. Solo aplicamos en los 2 lugares críticos del form de generate.
- **Búsqueda fuzzy en `/sessions`** (Levenshtein o similar). Búsqueda `includes` case-insensitive es suficiente para el volumen esperado.
- **Settings adicionales** (tema claro, idioma, atajos de teclado). El scope de M7 es solo export/import/modelo/about. Cualquier preferencia de UI es un ADR propio.
- **Aria-labelledby consistency** (item #18) y **`bg-popover` hierarchy doc** (item #21). Mejoras de a11y/docs valiosas pero no parte del polish prioritario. Backlog.

## Further Notes

- **Priorización sugerida para child tickets** (orden de `depends_on`):
  1. **0019** — M1 (guards + validación): bugs puros, baja dependencia.
  2. **0020** — M4 (DRY utilities): refactor sin el cual M2 y M3 se duplican trabajo.
  3. **0021** — M2 (Cargar en mini-historial): depende de M4.
  4. **0022** — M3 (`/sessions` page): depende de M4.
  5. **0023** — M5 (persistencia de input + mini-status en `/classes`).
  6. **0024** — M6 (design tokens: `.numeric`, `.prose-chalk`, cronómetro).
  7. **0025** — M7 (`/settings` con export/import).
- **Sigue el patrón vertical slice** establecido en umbrella 0012 → 0013-0017. Cada child ticket es entregable y cerrable de forma independiente, con su propio script de manual end-to-end test per el precedent de 0017.
- **Sin ADR nuevo.** Las decisiones son tácticas (qué utilities extraer, dónde poner la ruta, qué keys de storage usar). Duran lo que dura el código; no son principios arquitectónicos. Si el equipo decide luego formalizar (ej. "DRY utilities en `src/lib/clipboard.ts` es el patrón canónico para acciones de portapapeles"), ahí se escribe un ADR.
- **Documentación sincronizada al cerrar.** `AGENTS.md:103` menciona patrones establecidos. Al cerrar M6, agregar el pattern de `.numeric` y `.prose-chalk` a la lista. Al cerrar M7, agregar el pattern de export/import.
- **No actualizar `CONTEXT.md` por ahora.** El modelo de datos no cambia (no se agrega campo a `SavedSession` ni a `SavedWeightRecord`). `CONTEXT.md:33-44` queda intacto.
- **Verificación final**: `npm run build` (incluye typecheck vía Next.js), `npm run lint`, dev server + screenshot del estado activo del status strip (jerarquía cronómetro) y de `/sessions` con datos seed.
