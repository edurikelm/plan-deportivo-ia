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

### En curso al cierre de la última sesión

- **Umbrella activo**: `0012-saved-weight-records` (issue en `docs/agents/issues/0012-saved-weight-records.md`).
  - ADR de soporte: `docs/adr/0009-saved-weight-records.md`.
  - Hijos: 5 vertical slices (0013-0017) en `docs/agents/issues/`. El plan original de 7 horizontal layers está archivado en `docs/agents/issues/.archive/`.
- **Implementado** (código + verifier pass): 0013 (save labeled), 0014 (auto-log), 0015 (mini-panel).
- **Pendiente**: 0016 (página completa de historial en `/tools/weight-calculator/history`), 0017 (polish + verify end-to-end).

### Patrones establecidos en el código (consultar antes de introducir variantes)

- **Storage namespace**: keys `pd:*` — `pd:sessions`, `pd:calculator-state`, `pd:calculator-records`. Helpers en `src/lib/storage.ts` con el patrón `dispatchStorage` para que los `storage` events sintéticos refresquen same-tab consumers.
- **Storage reactivo en componentes**: `useSyncExternalStore` con la string cruda como snapshot. **No** `useState` + `useEffect` con `setRecords(...)` adentro — falla la regla de React 19 `react-hooks/set-state-in-effect`. El snapshot es la string JSON, el consumer lo parsea con `parseRecordsFromRaw` / `getRecentRecordsFromRaw` (los helpers que aceptan raw existen precisamente para que el `useMemo` con dep `[raw]` sea genuino).
- **Helpers puros de dominio**: `src/lib/calculator/history.ts` con `computeTotals`, `hashState`, `normalizeExerciseName`, `dedupeExercises`. Importar desde `@/lib/calculator` (el barrel) — no reimplementar localmente.
- **IDs**: `crypto.randomUUID()` (no `Date.now() + Math.random()`).

### Cómo retomar 0016

1. Leé `0012-saved-weight-records.md` (umbrella spec).
2. Leé `0016-history-page.md` (ticket a implementar).
3. Leé `0009-saved-weight-records.md` (decisión arquitectónica).
4. Leé `src/app/tools/weight-calculator/_components/calculator-client.tsx` y `saved-records-panel.tsx` para ver los patrones que se deben mantener.
5. Implementá siguiendo la forma vertical-slice (no layer-by-layer). Aceptación: 14 criterios en el issue, todos verificables.
