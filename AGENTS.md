# Plan Deportivo IA - Agents

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Session Protocol

Antes de cualquier trabajo:

1. Leer `CONTEXT.md` (lenguaje del dominio, modelos, reglas, stack, patrones).
2. Si la tarea toca UI, styling, layout, componentes, Tailwind, shadcn/ui, responsive, dark mode o consistencia visual, leer también `DESIGN.md` (sistema de diseño source of truth).
3. Respetar los patrones ya documentados.

## Domain Documentation

Single-context layout (Matt Pocock pattern):

- `CONTEXT.md` en la raíz — lenguaje del dominio, modelo de datos, reglas, stack, patrones Next.js, términos.
- `DESIGN.md` en la raíz — design system (tokens, paleta, tipografía, componentes, responsive, dark mode).
- `docs/adr/` — decisiones arquitectónicas durables (crear carpeta al primer ADR).

Cuando se descubre o se toma una decisión durable de dominio o arquitectura → actualizar `CONTEXT.md` o agregar un ADR.

## Workflow Skills

Usar el skill apropiado según la tarea:

- `diagnose` — bugs, regresiones, fallos, performance.
- `tdd` — cambios de comportamiento que necesitan red-green-refactor.
- `to-prd` — idea ambigua a PRD.
- `to-issues` — partir un plan/PRD en tickets.
- `triage` — issues entrantes, solicitudes poco claras.
- `zoom-out` — cuando se necesita contexto amplio antes de decidir.
- `grill-with-docs` — terminología, naming, decisiones de dominio.
- `improve-codebase-architecture` — refactors, análisis arquitectónico.
- `setup-matt-pocock-skills` — configurar este repo para las engineering skills.

Skills de stack (cargar antes de editar):

- `next-best-practices` — cualquier código Next.js (pages, layouts, API routes, server actions, routing, metadata, caching).
- `tailwind-v4-shadcn` — setup de Tailwind v4 + shadcn/ui (config `@theme`, dark mode, components.json).
- `shadcn` — instalación y customización de componentes shadcn/ui (reglas de composition, forms, icons, styling).
- `tailwind-css-patterns` — patrones de utilidad, performance, responsive.
- `frontend-design` — diseño frontend distintivo y de alta calidad.
- `react-best-practices`, `composition-patterns` — patrones React.
- `react-hook-form`, `zod` — formularios tipados.
- `accessibility` — a11y.
- `seo` — SEO técnico.
- `typescript-advanced-types` — tipos avanzados.

## Issue Tracker

Issues locales en `docs/agents/issues/` (un markdown por issue). Triage labels: `bug`, `feature`, `chore`, `question`, `blocked`.

## Delegation Routing

Antes de empezar, clasificar en uno de tres niveles:

- **Nivel 1 (cosmético)**: copy, estilos puntuales, dark mode tweaks. → Orchestrator ejecuta directo, verifica con typecheck + lint + screenshot visual.
- **Nivel 2 (comportamiento / dominio no crítico)**: features, refactors de componentes, cambios de UI, prompt tweaks. → `implementer` ejecuta, `reviewer` revisa.
- **Nivel 3 (dominio crítico)**: cambios en el prompt IA, schema de storage, modelo MiniMax, validación del response, auth/secretos. → `architect` + `implementer` + `tester` + `reviewer`.

Si hay duda entre 1 y 2 → escalar hacia arriba.

## Verificación

- Typecheck: `npm run build` (incluye typecheck vía Next.js).
- Lint: `npm run lint`.
- Build: `npm run build`.
- Visual: abrir dev server y capturar.

## Artefactos de verificación

Screenshots, traces, snapshots y archivos generados durante verificación **no son parte del producto**. Después de usarlos, eliminarlos del worktree o moverlos a `C:\Users\eduri\AppData\Local\Temp\opencode` (tmp pre-aprobado). Nunca dejarlos en la raíz ni en `src/`.

## Active work

Esta sección existe para que una sesión nueva sepa qué hay en curso sin tener que descubrirlo desde cero. Cuando retomes trabajo, mirá primero `docs/agents/issues/`, leé el umbrella open que esté activo, y seguí el ticket hijo que esté en `ready-for-agent` o `in_progress`.

### Cerrado en esta sesión (umbrella 0012 — Saved Weight Records)

- **0012 + 0013-0017 todos `status: closed` con `closed_at: 2026-08-29`.** 7 commits: `5a11c43` (0013-0015) → `c1cedd9` (close housekeeping) → `fbb9887` (0016) → `ae48fe6` (0017 polish) → `39a7afe` (0017 pivot, ver abajo) → `cd88ad7` (umbrella close). `master` @ `cd88ad7` en sync con `origin/master`.
- **Pivot documentado**: el **auto-log pasivo** (debounce 1500ms, watcher de "estados estables") fue removido durante el polish de 0017. En uso real creaba más ruido que valor. Ahora sólo se persisten `source: "manual"` (del form Guardar) y `source: "foto"` (del Foto accept). El variant `"auto-log"` se mantiene en el `RecordSource` enum por backward compat con `localStorage` viejo; Zod los descarta silenciosamente en read. Si querés formalizar el pivot, escribí un ADR nuevo (0009 queda como historical record).
- **Out of scope del umbrella, candidatos a futuro**: test infra (seam natural: `src/lib/calculator/history.ts`), bulk delete / multi-select, edit inline (`updateRecord` ya está exportado), export CSV/JSON, sync entre devices, registry de movimientos tipado.

### En curso (umbrella 0018 — UI/UX polish)

- **Branch**: `0018-ui-ux-polish` trackeando `origin/0018-ui-ux-polish`. **No mergear a master hasta cerrar el umbrella.**
- **Tickets cerrados**: 0019 (bug, navigation guard + form validation), 0020 (chore, DRY utilities), 0021 (feature, Cargar in mini-history), 0022 (feature, /sessions page). Cada ticket con impl + close ceremony + post-mortem en `docs/agents/issues/00XX-*.md`.
- **Tickets pendientes**: 0023 (input persistence + activity banner), 0024 (design tokens: `.numeric` / `.prose-chalk` / cronómetro hierarchy), 0025 (/settings con export/import). 10 commits en el branch al momento del handoff.
- **Bug encontrado y fixeado en mid-umbrella**: el mini-history tenía un SSR hydration race (`useState(() => hydrated ? ... : [])` corría con `hydrated=false` en SSR y nunca se actualizaba). Migrado a `useSyncExternalStore` + `useMemo` sobre la string cruda, fijando el patrón storage-reactivo para `pd:sessions` (que ya estaba documentado para `pd:calculator-records`).
- **Follow-up post-0021**: agregada acción `Eliminar` al mini-history (estaba sólo en `/sessions`). Cierra la simetría. El wrap del footer usa `flex flex-wrap items-center gap-x-3 gap-y-1` para que 4 botones no se corten con títulos largos.
- **Cierre del umbrella (pendiente)**: `chore(0018): close umbrella + post-mortem` con `git checkout master && git merge --no-ff 0018-ui-ux-polish` + cleanup de branch local y remoto. Actualizar esta sección con el resumen de cierre.

### Patrones establecidos en el código (consultar antes de introducir variantes)

- **Storage namespace**: keys `pd:*` — `pd:sessions`, `pd:calculator-state`, `pd:calculator-records`, `pd:last-input-{modalityId}`. Helpers en `src/lib/storage.ts` con el patrón `dispatchStorage` para que los `storage` events sintéticos refresquen same-tab consumers.
- **Storage reactivo en componentes**: `useSyncExternalStore` con la string cruda como snapshot. **No** `useState` + `useEffect` con `setRecords(...)` adentro — falla la regla de React 19 `react-hooks/set-state-in-effect`. El snapshot es la string JSON, el consumer lo parsea con `parseXFromRaw` / `getXFromRaw` (los helpers que aceptan raw existen precisamente para que el `useMemo` con dep `[raw]` sea genuino). Aplica a `pd:sessions` (0018) y `pd:calculator-records` (0012).
- **Position-preserving undo** (0018): antes de `removeSession`, snapshot con `[...getSessions()]`. El toast con "Deshacer" hace `setSessions(snapshot)` para restaurar la posición original del item, no appendear al final. Mismo patrón en `/sessions` y mini-history.
- **loadSessionInto** (`src/lib/sessions.ts`, 0018): helper puro que da nombre a "load a previously-saved session into the active result". Preserva `id`/`createdAt`/`model` para que un `Guardar` posterior haga `updateSession` (idempotente) en lugar de `addSession`. Usado por Cargar del mini-history y por el `?fromSession={id}` de `/generate/[modalityId]`.
- **Storage helpers en `src/lib/clipboard.ts`** (0018): `copyToClipboard` (Promise con `{ ok, error? }`), `downloadAsMarkdown(filename, text)` (sync fire-and-forget), `markdownFilename(modalityLabel, date)`. Reusados por `generate-client.tsx`, mini-history, y `/sessions`. Garantizan toasts idénticos y filename convention consistente.
- **Inline empty state vs auto-fallback** (0018): cuando un filtro no tiene matches, mostrar empty state inline ("no hay sesiones de X"). NO forzar fallback a "Todas" automáticamente — el chip refleja la elección del usuario, la lista muestra el resultado efectivo. Forzar el fallback hace sentir al usuario que su click fue ignorado.
- **Simetría entre surfaces** (0018): las acciones de mini-history y `/sessions` son idénticas (Cargar / Copiar / Exportar / Eliminar). El boton `Regenerar` solo en status strip (acción sobre el LLM, no sobre el resultado). El card footer mantiene solo acciones de resultado.
- **Quota errors**: `isQuotaError(err)` en `src/lib/storage.ts` distingue `QuotaExceededError` / `NS_ERROR_DOM_QUOTA_REACHED` de otros IO errors. Todos los call sites de `addRecord` / `removeRecord` / `setCalculatorState` están wrapeados en try/catch con toasts accionables ("Almacenamiento lleno. Borrá registros antiguos desde el historial.").
- **Helpers puros de dominio**: `src/lib/calculator/history.ts` con `computeTotals`, `hashState`, `normalizeExerciseName`, `dedupeExercises`. `src/lib/sessions.ts` con `loadSessionInto`. `src/lib/clipboard.ts` con `copyToClipboard` / `downloadAsMarkdown` / `markdownFilename`. Importar desde los barrels (`@/lib/...`) — no reimplementar localmente.
- **IDs**: `crypto.randomUUID()` (no `Date.now() + Math.random()`).
- **Focus management en formularios inline**: al cerrar, focus vuelve al trigger button (ver patrón en `closeSaveForm` de `calculator-client.tsx`).

### Cómo retomar trabajo nuevo

1. Buscá un umbrella open en `docs/agents/issues/` (filtrá por `status: open`).
2. Si no hay ninguno, considerá candidatos del PRODUCT.md roadmap o de los "out of scope" arriba.
3. Si retomás un ticket, usá el patrón vertical-slice (no horizontal-layer) — la metodología probada de 0013-0017.
