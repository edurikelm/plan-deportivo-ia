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

### Cerrado en esta sesión (umbrella 0018 — UI/UX polish)

- **0019-0025 todos `status: closed` con `closed_at: 2026-09-02`.** 21 commits en `0018-ui-ux-polish`. Mergeado a `master` con `--no-ff`. Branch local eliminado, branch remoto opcionalmente conservado.
- **Tickets** (en orden de cierre):
  - `0019` — bug: navigation guard + form validation (back-button guard con `hasUnpersistedWork` sentinel)
  - `0020` — chore: DRY utilities (`copyToClipboard`, `downloadAsMarkdown`, `markdownFilename`, `loadSessionInto`)
  - `0021` — feature: Cargar in mini-history + Eliminar symmetry + SSR hydration race fix
  - `0022` — feature: `/sessions` page (browse, search, filter, sort, delete with undo)
  - `0023` — feature: `pd:last-input-{modalityId}` form persistence + `<RecentActivityBanner>` en `/classes`
  - `0024` — chore: design tokens (`.numeric` / `.numeric-label` / `.numeric-display` / `.prose-chalk`) + cronómetro `text-2xl` → `text-xl` + DESIGN.md update
  - `0025` — feature: `/settings` page con export/import/clear, `BackupShape` + `exportAllData` / `importAllData` / `clearAllData`, Zod validation, doble `window.confirm` para destructive actions
- **Bug encontrado y fixeado en mid-umbrella**: el mini-history tenía un SSR hydration race (`useState(() => hydrated ? ... : [])` corría con `hydrated=false` en SSR y nunca se actualizaba). Migrado a `useSyncExternalStore` + `useMemo` sobre la string cruda, fijando el patrón storage-reactivo para `pd:sessions` (que ya estaba documentado para `pd:calculator-records`).
- **Patrón nuevo establecido en 0023**: form state como objeto único (`useState<FormState>`) con per-field setter wrappers. Razón: el lint rule `react-hooks/set-state-in-effect` se quejaba de 5 setStates en el effect de hidratación. El refactor baja el count a 1 y preserva la API de los setters individuales (JSX sin cambios). Ver post-mortem 0023 para la justificación completa.
- **Decisión deliberada en 0024**: cronómetro de `calculator-client.tsx` (analyze foto state) recibió el mismo `text-2xl` → `text-xl` que el de `generate-client.tsx` por consistencia de sistema, aunque no estaba explícito en el ticket original.
- **Out of scope del umbrella, candidatos a futuro** (de los post-mortems 0012 + 0018):
  - test infra (seam natural: `src/lib/calculator/history.ts`)
  - bulk delete / multi-select en `/sessions`
  - edit inline de `SavedWeightRecord` (el `updateRecord` ya está exportado)
  - sync entre devices (explícitamente out-of-scope por ADR-0001)
  - registry de movimientos tipado para la calculadora
  - Per-modalidad isolation test (0023 está implementado por diseño, no testeable hasta que haya 2da modalidad)
  - Test e2e manual de 0025 (correglo con `npm run dev` antes de release)
  - Forward-compat warning como `toast.warning` post-import en `/settings` (hoy es solo un `window.confirm` extra)

### Patrones establecidos en el código (consultar antes de introducir variantes)

- **Storage namespace**: keys `pd:*` — `pd:sessions`, `pd:calculator-state`, `pd:calculator-records`, `pd:last-input-{modalityId}`. Helpers en `src/lib/storage.ts` con el patrón `dispatchStorage` para que los `storage` events sintéticos refresquen same-tab consumers.
- **Storage reactivo en componentes**: `useSyncExternalStore` con la string cruda como snapshot. **No** `useState` + `useEffect` con `setRecords(...)` adentro — falla la regla de React 19 `react-hooks/set-state-in-effect`. El snapshot es la string JSON, el consumer lo parsea con `parseXFromRaw` / `getXFromRaw` (los helpers que aceptan raw existen precisamente para que el `useMemo` con dep `[raw]` sea genuino). Aplica a `pd:sessions` (0018) y `pd:calculator-records` (0012).
- **Position-preserving undo** (0018): antes de `removeSession`, snapshot con `[...getSessions()]`. El toast con "Deshacer" hace `setSessions(snapshot)` para restaurar la posición original del item, no appendear al final. Mismo patrón en `/sessions` y mini-history.
- **loadSessionInto** (`src/lib/sessions.ts`, 0018): helper puro que da nombre a "load a previously-saved session into the active result". Preserva `id`/`createdAt`/`model` para que un `Guardar` posterior haga `updateSession` (idempotente) en lugar de `addSession`. Usado por Cargar del mini-history y por el `?fromSession={id}` de `/generate/[modalityId]`.
- **Storage helpers en `src/lib/clipboard.ts`** (0018): `copyToClipboard` (Promise con `{ ok, error? }`), `downloadAsMarkdown(filename, text)` (sync fire-and-forget), `markdownFilename(modalityLabel, date)`. Reusados por `generate-client.tsx`, mini-history, y `/sessions`. Garantizan toasts idénticos y filename convention consistente.
- **Inline empty state vs auto-fallback** (0018): cuando un filtro no tiene matches, mostrar empty state inline ("no hay sesiones de X"). NO forzar fallback a "Todas" automáticamente — el chip refleja la elección del usuario, la lista muestra el resultado efectivo. Forzar el fallback hace sentir al usuario que su click fue ignorado.
- **Simetría entre surfaces** (0018): las acciones de mini-history y `/sessions` son idénticas (Cargar / Copiar / Exportar / Eliminar). El boton `Regenerar` solo en status strip (acción sobre el LLM, no sobre el resultado). El card footer mantiene solo acciones de resultado.
- **Quota errors**: `isQuotaError(err)` en `src/lib/storage.ts` distingue `QuotaExceededError` / `NS_ERROR_DOM_QUOTA_REACHED` de otros IO errors. Todos los call sites de `addRecord` / `removeRecord` / `setCalculatorState` están wrapeados en try/catch con toasts accionables ("Almacenamiento lleno. Borrá registros antiguos desde el historial.").
- **Helpers puros de dominio**: `src/lib/calculator/history.ts` con `computeTotals`, `hashState`, `normalizeExerciseName`, `dedupeExercises`. `src/lib/sessions.ts` con `loadSessionInto`. `src/lib/clipboard.ts` con `copyToClipboard` / `downloadAsFile` / `markdownFilename`. Importar desde los barrels (`@/lib/...`) — no reimplementar localmente.
- **IDs**: `crypto.randomUUID()` (no `Date.now() + Math.random()`).
- **Focus management en formularios inline**: al cerrar, focus vuelve al trigger button (ver patrón en `closeSaveForm` de `calculator-client.tsx`).
- **Form state como objeto único con per-field setters** (0023): si un form tiene ≥ 3 fields que se hidratan juntos (mount + load-from-history), usá `useState<FormState>` con `setForm(f => ({ ...f, field: v }))` para cada field. Razón: el lint rule `react-hooks/set-state-in-effect` se queja de múltiples setStates en effects de hidratación. El refactor baja a 1 setState y preserva la API de los setters para los `onChange`/`onClick`. Los per-field setters son function references que se re-crean por render — aceptable porque se pasan a native HTML elements, no a memoized children.
- **useRef gate para one-shot effects de hidratación** (0018 → 0023): `formHydratedRef.current = true` ANTES del setState. Marca el effect como "done" antes del re-render, así deps changes subsecuentes hacen early return sin re-hidratar. Patrón standard también usado en `calculator-client.tsx` con `hasSyncedRef`.
- **persistenceSkipRef para evitar re-write post-hidratación** (0023): el effect de persistencia skipea su PRIMERA corrida post-hidratación. Sin esto, el setForm del hydration effect triggerea el persistence effect, que ve los valores recién hidratados y los escribe inmediatamente (waste of a write cycle).
- **PersistedLastInput type separado** (0023): el type de `CrossFitSessionInput` (Zod schema del LLM) NO incluye `"Aleatorio"`, pero el form del user SÍ lo permite. El storage helper usa un type aparte `PersistedLastInput` que refleja la forma "user-facing" del draft. El sistema resuelve `"Aleatorio"` antes de mandar al LLM, así que el storage type es independiente del LLM schema.
- **Doble `window.confirm` para destructive actions** (0025): redundante por diseño (impulso → convicción). NO compartir con el back-button guard de 0019 — semánticas distintas (0019 es "tenés cambios sin guardar", 0025 es "estás por borrar todo").
- **Storage "deleted" event con `newValue: ""`** (0025): cuando un helper borra una key, dispatcha el synthetic `storage` event con string vacío. Los consumers que ya manejan "raw string vacío = sin data" no requieren cambio. Patrón consistente con el resto del storage helpers.
- **Validación en 2 capas (Zod outer + parseadores defensivos inner)** (0025): Zod gatea el outer shape ("¿es un backup?"), los parseadores existentes (`parseSessionsFromRaw`, `parseRecordsFromRaw`) filtran entries corruptas silenciosamente. Un backup con 1 session corrupto importa los otros 9, no se rechaza entero.

### Cómo retomar trabajo nuevo

1. Buscá un umbrella open en `docs/agents/issues/` (filtrá por `status: open`).
2. Si no hay ninguno, considerá candidatos del PRODUCT.md roadmap o de los "out of scope" arriba (incluyendo los de 0012 y 0018).
3. Si retomás un ticket, usá el patrón vertical-slice (no horizontal-layer) — la metodología probada de 0013-0017.
