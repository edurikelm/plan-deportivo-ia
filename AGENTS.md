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
