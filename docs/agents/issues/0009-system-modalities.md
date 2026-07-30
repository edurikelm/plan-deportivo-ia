---
label: feature
status: closed
closed_at: 2026-07-30
---

## Resultado

MVP reescrito a la arquitectura de **modalidades** del sistema, con CrossFit como primera y única modalidad.

### Cambios

- Eliminada la entidad `Clase` y su editor (`ClaseForm`, `/classes/new`, `/classes/[id]`, `/classes/[id]/generate`, `edit-class-page-client.tsx`, `generate-client.tsx` legacy).
- Eliminados `src/lib/build-prompt.ts` y `src/lib/minimax.ts` (su lógica vive ahora en `src/lib/modalities/crossfit-schemas.ts`).
- Storage migrado de `pd:classes`/`pd:ideas` a `pd:sessions` (`SavedSession`). Migración silenciosa descarta las claves legacy al primer read.
- `src/lib/modalities/crossfit-schemas.ts` (server-only): contexto canónico desde `docs/instrucciones-crossfit.md`, schemas Zod (`CrossFitSessionInputSchema`, `CrossFitPlanSchema`), conversor `crossfitPlanToMarkdown`, resolución determinística de `Aleatorio`, y `generateCrossFitSession` con retry.
- `src/lib/modalities/crossfit.tsx` (`"use client"`): componente `CrossFitPlanView` con 4 fases (Warm-Up, Strength/Skill, WOD, Cool Down).
- `src/lib/modalities/modalities.ts`: catálogo `MODALITIES` y `getModality(id)` compartidos.
- `src/app/classes/page.tsx`: reescrito como catálogo de modalidades del sistema, sin `localStorage` del usuario.
- `src/app/generate/[modalityId]/page.tsx` + `_components/generate-client.tsx`: nueva ruta, formulario por modalidad, mini-historial (5 sesiones), edit-then-save, AbortController con timeout 60s, `CrossFitPlanView` como render principal.
- `src/app/api/generate/route.ts`: valida `modalityId`+`input`, delega a `generateCrossFitSession`, retorna `{ content, structured, model }`. Cap server 90s.
- `next.config.ts`: `outputFileTracingIncludes` para incluir `docs/instrucciones-crossfit.md` en el bundle del route.
- `package.json`: agregada dependencia `zod@^3.23.8`.
- Documentación: `CONTEXT.md`, `PRODUCT.md`, `docs/adr/0003-system-modalities.md` (sustituye `0003-crossfit-four-phase-generation.md`), `docs/instrucciones-crossfit.md`, `.impeccable/surface-briefs/classes.md` (reescrito) y nuevo `generate-modality.md`.

### Verificación

- ✅ `npm run lint` — 0 errores, 0 warnings.
- ✅ `npm run build` — TypeScript OK, 4 rutas detectadas: `/`, `/api/generate`, `/classes`, `/generate/[modalityId]`.
- ✅ `docs/instrucciones-crossfit.md` aparece en `.next/server/app/api/generate/route.js.nft.json`.
- ✅ Smoke real (producción, `npx next start --port 3737`):
  - `POST /api/generate` con input `AMRAP` + Back Squat: HTTP 200, `model: "MiniMax-M3"`, `structured.sections.wod.format: "AMRAP"`, contenido 4 fases legible.
  - `POST /api/generate` con input `Aleatorio` + Snatch: HTTP 200, `structured.sections.wod.format: "Tabata"` (resolución determinística OK), contenido 4 fases.
  - `POST /api/generate` con `strengthSkill` vacío: HTTP 400 (validación Zod).
  - `POST /api/generate` con `modalityId` desconocido: HTTP 400.

### Decisiones durables (resumidas)

- `SavedSession` reemplaza a `Idea`. `Modality` (registry) reemplaza a `Clase`.
- MiniMax-M3 no recibe `response_format` (sólo `MiniMax-Text-01` lo soporta). JSON se pide en prompt, se valida con Zod, se reintenta una vez.
- `Aleatorio` sí se ofrece al Entrenador como opción seleccionable; la salida `sections.wod.format` nunca es "Aleatorio".
- CrossFit es la primera y única modalidad del MVP; el registry está preparado para Bodybuild, Gymnastics, etc.
- `CrossFitPlanView` es la fuente de verdad de render para CrossFit. El markdown sigue siendo la fuente de verdad para Copiar/Exportar.

### Follow-ups

- Considerar cleanup de surface briefs legacy (`classes-new.md`, `classes-id.md`, `classes-id-generate.md`) en otra iteración.
- Smoke tests automatizados (no forman parte del MVP).
- Aislar `View`/`Edit`/`MiniHistory` en subcomponentes si la pantalla sigue creciendo.
- Cuando aparezca la segunda modalidad, extraer un `<ModalityForm>` genérico.
