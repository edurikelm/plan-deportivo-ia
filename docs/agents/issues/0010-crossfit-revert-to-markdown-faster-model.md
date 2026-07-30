---
label: bug
status: closed
closed_at: 2026-07-30
---

## Resultado

Revert del flujo de generación a **markdown directo** (sin JSON/Zod/retry) y switch del modelo a **`MiniMax-M2.7-highspeed`** (más rápido). El enfoque "prompt-based JSON + Zod validation + retry" resultó inestable en práctica: el extractor `extractPlanJson()` retornaba string vacío en ambos intentos porque el LLM no emitía un `{` válido.

### Cambios

- `src/lib/modalities/crossfit-schemas.ts` — reescrito:
  - Drop `CrossFitPlanSchema`, `CrossFitPlan`, `crossfitPlanToMarkdown`, `extractPlanJson`, retry loop, `loadCrossFitContext`.
  - `generateCrossFitSession()` ahora retorna `{ content, structured: null, model }` con markdown crudo.
  - Modelo: `MiniMax-M2.7-highspeed` (antes `MiniMax-M3`).
  - System prompt inline (ya no carga `docs/instrucciones-crossfit.md`). Énfasis en output: jerarquía exacta de headers markdown.
  - `stripThinkBlocks()` ampliado para 6 delimitadores de reasoning (`<!-- raw omitted -->`, `<thinking>`, `<|thinking|>`, `<reasoning>`, `<|reasoning|>`, `<reflection>`).
  - Removido `thinking: { type: "disabled" }` (modelo highspeed no lo requiere).
- `src/lib/modalities/crossfit.tsx` — `CrossFitPlanView` eliminado. Queda como módulo stub con re-export de tipos.
- `src/lib/modalities/index.ts` — exports limpios (sin `CrossFitPlanSchema`).
- `src/lib/types.ts` — `SavedSession.structured: unknown` (antes `CrossFitPlan | null`). `EMPTY_SAVED_SESSION.model = "MiniMax-M2.7-highspeed"`.
- `src/app/generate/[modalityId]/_components/generate-client.tsx`:
  - Drop import de `CrossFitPlanView`.
  - Render siempre via `ReactMarkdown` (sin branching por `structured`).
  - `extractTitle()` helper: extrae el primer `# Título` del markdown; fallback a `CrossFit {fecha}`.
  - Default `model` fallback actualizado a `MiniMax-M2.7-highspeed`.
- `next.config.ts` — `outputFileTracingIncludes` removido (el archivo ya no se carga).
- `docs/instrucciones-crossfit.md` queda como referencia canónica (no se borra) pero no se carga al provider.
- `CONTEXT.md` actualizado:
  - § Generación: miniMax-M2.7-highspeed, markdown puro, sin retry, sin JSON.
  - § Modelo de Datos: `structured: unknown`, null para sesiones nuevas.
  - § API Routes: retorno `{ content, structured: null, model }`.
  - § Construcción del Prompt: nuevo template inline.
- `docs/adr/0003-system-modalities.md` actualizado:
  - § Output format: cambia de "JSON via prompt + Zod + retry" a "markdown directo".
  - `SavedSession.structured` documentado como `unknown` (compat hacia atrás).

### Verificación

- ✅ `npm run lint` — 0 errores, 0 warnings.
- ✅ `npm run build` — TypeScript OK, 4 rutas detectadas: `/`, `/api/generate`, `/classes`, `/generate/[modalityId]`.
- ✅ Smoke test manual pendiente (requiere `MINIMAX_API_KEY` en `.env.local`):
  - `POST /api/generate` con `{ modalityId: "crossfit", input: { durationMinutes: "60", strengthSkill: "Back Squat 5x5", wodFormat: "AMRAP" } }` → esperado: HTTP 200, `model: "MiniMax-M2.7-highspeed"`, `markdown` con 4 headers (`## Warm-Up`, `## Strength / Skill`, `## WOD — AMRAP`, `## Cool Down`). Latencia esperada < 30s.
  - Repetir con `(EMOM, Snatch)`, `(For Time, Deadlift)`, `(Tabata, Gymnastics)`, `(Aleatorio, Thruster)`, `(Intervalos, Muscle-up)`.
  - `model: "MiniMax-M2.7-highspeed"` debe aparecer en `savedSession.model` y propagarse al UI.

### Decisiones durables

- **Markdown es la fuente de verdad** para el render, Copiar y Exportar. `structured` existe solo para compat hacia atrás.
- **`MiniMax-M2.7-highspeed`** es el modelo por defecto. Costo/baja latencia sobre profundidad — la complejidad planificada (estructura CrossFit con 4 fases) no necesita M3.
- **No retry**: si la respuesta viene vacía o malformada, error genérico 502. El stripper de thinking blocks es la única defensa contra respuestas con reasoning.
- **Aleatorio**: sigue ofreciéndose al Entrenador y se resuelve determinísticamente a un formato concreto antes de llamar al LLM. No hay cambio en este contrato.

### Follow-ups explícitos (no en este PR)

- Smokes automatizados del flujo de generación (no forman parte del MVP; necesarios si queremos detectar regresiones del provider).
- Si en el futuro queremos structured output para una nueva modalidad (Bodybuild, Gymnastics), evaluar `MiniMax-Text-01` (único que soporta `response_format: { type: "json_object" }` de forma estable, per ADR-0003).
- Decidir si `docs/instrucciones-crossfit.md` sigue siendo útil como referencia o se elimina (ahora vive inline en `crossfit-schemas.ts`).
- Decidir si `docs/instrucciones-crossfit.txt` (duplicado del .md) se elimina.

### Out of scope explícito

- Streaming de la respuesta del LLM.
- Cambios de modelo por sesión (no hay UX para seleccionar modelo).
- Re-introducir `CrossFitPlanView` (no aporta si la fuente es markdown).
