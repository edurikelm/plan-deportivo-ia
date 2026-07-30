---
label: feature
status: closed
closed_at: 2026-07-30
---

## Resultado

Switch del modelo de generación de `MiniMax-M2.7-highspeed` (markdown) a `MiniMax-Text-01` (JSON nativo), con re-introducción del `CrossFitPlanView` para render estructurado. Decisión basada en evaluación comparativa contra 4 configuraciones (issue 0011 + `docs/agents/eval/eval-models-report.md`).

### Evaluación previa (6 inputs CrossFit × 4 configuraciones = 24 calls)

| Configuración | Success | Format-valid | Avg Latency |
|---|---|---|---|
| `MiniMax-M2.7-highspeed` (markdown, default) | 6/6 | 5/6 | 30.8s |
| `M2.7-highspeed + thinking:off` | 6/6 | 6/6 | 23.7s |
| `MiniMax-Text-01` (JSON prompt, sin `response_format`) | 6/6 | **6/6** | **13.1s** |
| `MiniMax-Text-01` (con `response_format: json_object`) | 0/6 | 0/6 | 0.3s (rejected) |

**Verdict**: ADOPT `MiniMax-Text-01` sin `response_format`. **57% reducción de latencia** (13.1s vs 30.8s), 100% JSON válido, structured output recuperable.

> **Hallazgo crítico**: ADR-0003 afirmaba que `MiniMax-Text-01` soporta `response_format: { type: "json_object" }`. **Era incorrecto** — la API devuelve `400 invalid params, unknown response_format type 'json_object'`. El modelo devuelve JSON nativo cuando se le pide en el prompt, sin necesidad de `response_format`.

### Cambios

- `src/lib/modalities/crossfit-schemas.ts`:
  - Re-añadido `CrossFitPlanSchema` (todos los campos con `.default(...)` para ser lenient con respuestas parciales).
  - Re-añadido `CrossFitPlan` (type Zod).
  - Re-añadido `crossfitPlanToMarkdown()`.
  - Modelo: `MiniMax-Text-01` (antes `MiniMax-M2.7-highspeed`).
  - `generateCrossFitSession()` ahora retorna `{ content, structured: CrossFitPlan, model }`. Parsea JSON, valida con Zod, deriva markdown.
  - Sin `response_format` (la API lo rechaza).
- `src/lib/modalities/crossfit.tsx` — re-introducido `CrossFitPlanView` con 4 fases (Warm-Up, Strength/Skill, WOD, Cool Down).
- `src/lib/modalities/index.ts` — re-export de `CrossFitPlanSchema` y `CrossFitPlan`.
- `src/lib/types.ts` — `SavedSession.structured: CrossFitPlan | null` (antes `unknown`). `EMPTY_SAVED_SESSION.model = "MiniMax-Text-01"`.
- `src/app/generate/[modalityId]/_components/generate-client.tsx`:
  - Re-import `CrossFitPlanView`.
  - Render condicional: `CrossFitPlanView` cuando hay `structured`, `ReactMarkdown` fallback.
  - Title se extrae de `structured.class_title` (más robusto que regex sobre markdown).
- `scripts/eval-models.ts` — script de evaluación comparativa (24 calls con 4 configuraciones). Output: `docs/agents/eval/eval-models-report.md`.
- `package.json` — agregado `tsx` (devDependency) + `npm run eval:models`.
- `docs/agents/eval/eval-models-report.md` — reporte de la evaluación.
- `docs/adr/0003-system-modalities.md` — corregida la suposición errónea: Text-01 NO soporta `response_format`, devuelve JSON nativo vía prompt.
- `CONTEXT.md` — actualizado: modelo, output, generación, API.
- `tsconfig.json` sin cambios (TS strict OK).

### Verificación

- ✅ `npm run lint` — 0 errors, 0 warnings.
- ✅ `npm run build` — TypeScript OK, 4 rutas detectadas.
- ✅ `npm run eval:models` — 24 calls, results saved to `docs/agents/eval/eval-models-report.md`.
- ✅ **Smoke real (producción, `next start --port 3737`)**:
  - `POST /api/generate` con `{ modalityId: "crossfit", input: { durationMinutes: "60", strengthSkill: "Back Squat 5x5 @ 70% 1RM", wodFormat: "AMRAP" } }` → HTTP 200, `model: "MiniMax-Text-01"`, `structured.class_title: "Potencia y Resistencia: Domina tu Back Squat…"`, `structured.sections.wod.format: "AMRAP"`, latencia **13.94s**.
  - `POST /api/generate` con `wodFormat: "Aleatorio"` + `strengthSkill: "Thruster 5x5 strict"` → HTTP 200, `structured.sections.wod.format: "Intervalos"` (resolver determinístico OK), latencia **13.23s**.

### Decisiones durables

- **`MiniMax-Text-01`** es el modelo por defecto. El ADR-0003 original (que asumía `response_format` soporte) fue revisado: la API rechaza `response_format`. JSON se pide vía prompt.
- **`CrossFitPlanSchema` con defaults** — si el modelo omite un campo, Zod aplica el default en vez de fallar. Esto cubre la varianza natural del LLM sin necesidad de retry.
- **`CrossFitPlanView` re-introducido** — es la fuente de verdad de render para sesiones nuevas (issue 0011 en adelante). `ReactMarkdown` es fallback para sesiones pre-0011 que no tienen `structured`.
- **`crossfitPlanToMarkdown()`** sigue siendo la fuente del `markdown` guardado (para Copiar / Exportar). Se deriva del JSON validado, no de la respuesta cruda del LLM.
- **`docs/instrucciones-crossfit.md`** ya no se carga al provider. El contexto canónico vive inline en `crossfit-schemas.ts` (`JSON_SYSTEM_PROMPT`). El `.md` se conserva como referencia documental.

### Follow-ups explícitos (no en este PR)

- Evaluar latencia y costo bajo carga concurrente (sólo se probaron requests secuenciales).
- Evaluar la calidad de las sesiones generadas por Text-01 vs M2.7-highspeed (sample de 10 outputs side-by-side, blinded review).
- Si surge una nueva modalidad (Bodybuild, Gymnastics), evaluar si `MiniMax-Text-01` sigue siendo el modelo correcto o si necesitamos uno especializado en técnicas específicas.
- `docs/instrucciones-crossfit.txt` (duplicado del .md) — ¿borrar?
- `docs/instrucciones-crossfit.md` — ya no se carga. ¿mover a `docs/reference/` o archivar?

### Out of scope explícito

- Streaming de la respuesta del LLM.
- Selección de modelo por sesión (no hay UX para eso).
- Cambio de modelo para inputs específicos (no hay diferenciación por input).
