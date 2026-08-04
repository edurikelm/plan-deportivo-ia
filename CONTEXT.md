# Plan Deportivo IA - Context

App minimalista para que un **Entrenador** genere sesiones de entrenamiento con IA. Sin DB, sin auth, sin multi-tenant. Todo el estado vive en `localStorage` del navegador.

## Concepto

- El sistema ofrece **modalidades** (CrossFit primero) como módulos registrados en código. El Entrenador no crea ni configura plantillas.
- El catálogo `/classes` lista las modalidades disponibles; no hay creación de Clase por el usuario.
- Cada generación produce una **sesión** puntual: input del Entrenador → IA → sesión validada → guardar, copiar o exportar.
- CrossFit valida exactamente 4 fases: Warm-Up, Strength / Skill, WOD, Cool-Down. Input obligatorio: `strengthSkill` y `wodFormat`; opcional: `focusMovement` y `considerations`.
- `Aleatorio` se ofrece al Entrenador como opción seleccionable en el formulario (junto a AMRAP, EMOM, For Time, Tabata, Intervalos). Cuando se elige, el sistema lo resuelve internamente a un formato concreto antes de invocar el LLM. La salida `sections.wod.format` será siempre un formato concreto (nunca "Aleatorio").
- Se pide JSON al LLM (vía prompt) y el cliente valida con Zod. `MiniMax-Text-01` devuelve JSON nativo de forma confiable (issue 0011). El markdown que se guarda en `SavedSession.markdown` se deriva del JSON validado vía `crossfitPlanToMarkdown()`. La render principal es `CrossFitPlanView` (consume `structured`); `ReactMarkdown` es fallback.
- Agregar futuras modalidades (Bodybuild, Gymnastics, etc.) no requiere tocar el resto del sistema — cada modalidad encapsula su propio contexto canónico, schema de input, schema de output, conversor a markdown y render component.

## Modelo de Datos

### Modality
- `id: string` — identificador único (`"crossfit"`).
- `label: string` — nombre para mostrar ("CrossFit").
- `description: string` — descripción corta.
- `accent: string` — color de acento en hex (para la tarjeta del catálogo).
- `iconKey: string` — clave de icono lucide.

### ModalityDefinition
Registro por código en `src/lib/modalities/`. La implementación está separada en tres archivos:

- **`crossfit-schemas.ts`** (server-only): carga el `context` desde `docs/instrucciones-crossfit.md`, define `inputSchema` (`CrossFitSessionInputSchema`), `outputSchema` (`CrossFitPlanSchema`), y la función `toMarkdown`. También exporta `generateCrossFitSession()` que arma el prompt y llama al LLM.
- **`modalities.ts`** (server + client, sin Node.js built-ins): array `MODALITIES` con los objetos `Modality` (`id`, `label`, `description`, `accent`, `iconKey`). Lo importa el catálogo en `/classes`.
- **`crossfit.tsx`** (`'use client'`): componente `CrossFitPlanView` que renderiza el resultado estructurado. Importa `Modality` desde `modalities.ts`.

No existe un objeto literal `ModalityDefinition` como singletón; cada campo está disperso en los tres archivos según el contexto de uso (server vs. client).

### SavedSession
- `id: string` — uuid.
- `modalityId: string` — referencia a la modalidad origen.
- `createdAt: string` — ISO timestamp.
- `model: string` — `MiniMax-Text-01` u otro.
- `title: string` — título generado para la sesión.
- `markdown: string` — contenido en markdown (para copiar/exportar).
- `structured: CrossFitPlan | null` — output JSON validado con Zod. Es la fuente de verdad para re-render (`CrossFitPlanView`). El `markdown` se deriva de este para Copiar / Exportar.
- `input: object` — input que el Entrenador completó (serializable).

> `Guardar` persiste siempre con la Idea presente; `Copiar` y `Exportar .md` siempre disponibles; `Regenerar` reemplaza la Idea activa sin guardarla.

### Mini-historial
- Array de las últimas 5 `SavedSession` ordenadas por `createdAt` desc.
- Mostrado debajo del resultado de generación.

## Reglas del Negocio

### Construcción del Prompt
El system prompt se arma en `generateCrossFitSession()` (`crossfit-schemas.ts`):

```
[SYSTEM]
Sos un coach deportivo especializado en CrossFit (CF-L3/L4). Tu única tarea es
generar la estructura completa de una clase de CrossFit para los parámetros
provistos.

## Estructura obligatoria
Toda clase debe tener exactamente 4 secciones en este orden:
1. Warm-Up (Calentamiento)
2. Strength / Skill (Técnica o Fuerza)
3. WOD (Workout of the Day)
4. Cool Down (Vuelta a la calma)

## Formatos WOD permitidos
AMRAP, EMOM, For Time, Tabata, Intervalos.

## Nomenclatura
Usá terminología técnica oficial de CrossFit en inglés/español estándar
(Thrusters, Snatch, Double Unders, HSPU, RX, Scaled, Time Cap).

## Coherencia anatómica
El Warm-Up y el Cool Down deben estar diseñados directamente para los grupos
musculares y patrones del movimiento principal y del WOD.

## Formato de salida
Respondé ÚNICAMENTE con el markdown de la sesión, con esta jerarquía exacta de
headers:
- `# {Título de la clase}` (en la primera línea)
- `## Warm-Up`
- `## Strength / Skill`
- `## WOD — {formato}`
- `## Cool Down`

Sin prosa antes ni después del markdown. Sin bloques de código ```.

[USER]
Generá la sesión con estos parámetros:
- Duración total objetivo: {input.durationMinutes} min.
- Strength/Skill: {input.strengthSkill}.
- Formato WOD: {resolvedFormat}{si era Aleatorio: " (resuelto de Aleatorio)"}.
- Movimiento foco: {input.focusMovement}     (si existe)
- Consideraciones del entrenador: {input.considerations}  (si existe)
```

> **Nota (issue 0010)**: el system prompt ya no carga `docs/instrucciones-crossfit.md` literal. El contexto canónico vive inline en `crossfit-schemas.ts` y prioriza el formato de salida (markdown con 4 headers) por encima de reglas metodológicas verbosas. La razón: el enfoque JSON + Zod + retry con el archivo completo resultó inestable en práctica. El documento `docs/instrucciones-crossfit.md` se conserva como referencia canónica pero no se carga al provider.

### Generación
- **Modelo**: `MiniMax-Text-01` (hardcodeado en `src/lib/modalities/crossfit-schemas.ts`). Llega a ~13s avg latency con respuesta JSON nativa confiable. No existe archivo `lib/minimax.ts`.
- **Output**: JSON estructurado (`CrossFitPlan`) validado con Zod. El markdown (4 secciones en `SavedSession.markdown`) se **deriva** del JSON validado vía `crossfitPlanToMarkdown()`. `CrossFitPlanView` renderiza el structured output; `ReactMarkdown` es fallback para sesiones pre-0011 sin `structured`.
- **JSON via prompt**: `MiniMax-Text-01` rechaza `response_format: { type: "json_object" }` con HTTP 400 (corregido en ADR-0003 — la suposición original era errónea). El JSON se pide en el system prompt; el schema con defaults absorbe respuestas parciales.
- **Reintento**: ninguno. Si el JSON parse falla o Zod rechaza, error genérico (502). La validación Zod con defaults cubre la mayor parte de los casos.
- **temperature**: `0.7`.
- **max_tokens**: `4096`.

> **Histórico**: el modelo `MiniMax-M2.7-highspeed` (usado en 0010) emitía markdown con `thinking` por defecto (~30s avg) y no era capaz de emitir JSON consistente. El eval humano de la batería (0011) demostró que `MiniMax-Text-01` resuelve ambos problemas a costa de un modelo más "pesado". Ver `docs/agents/eval/eval-models-report.md`.

### Almacenamiento
- Persistencia 100% local del navegador.
- `pd:sessions` — array de `SavedSession`.
- `pd:classes` y `pd:ideas` se descartan silenciosamente al primer read (migración transparente).
- Cambiar de navegador = empezar de cero (privacidad por diseño).

### Errores
- API falla → toast con mensaje genérico, no exponer detalles internos.
- Response vacío o JSON inválido → reintentar una vez, luego mostrar error.

### Acciones sobre el Resultado

| Acción | Disponibilidad | Comportamiento | Persistencia |
|---|---|---|---|
| **Copiar** | View + edit mode. | Copia el `markdown` (o `editedMarkdown` si está en edit) al portapapeles vía `navigator.clipboard.writeText`. | No escribe storage. |
| **Exportar `.md`** | View + edit mode. | Genera `Blob` del `markdown`, crea `<a download>` con filename `{modalityId}-{YYYY-MM-DD}.md` y dispara click. | No escribe storage. |
| **Regenerar** | View + edit mode (con `window.confirm` si hay edición pendiente). | Llama de nuevo al LLM con el mismo input. Resetea `persisted` a `false`. | No persiste. |
| **Editar** | View mode. | Entra a edit mode con editor split + preview. | No escribe storage. |
| **Guardar** | View + edit mode, **siempre disponible**. Disabled con tooltip "Sin cambios" cuando `persisted && !hasPendingEdit`. | Persiste la sesión en `pd:sessions`. Si `!persisted` → `addSession`. Si `persisted` → `updateSession`. | `SavedSession` queda en storage. |

### Active Result Lifecycle

- El `active result` (estado local `result` en `GenerateClient`) es **efímero por diseño**: vive sólo en memoria del componente. Al refresh o cambio de ruta, se pierde.
- No hay rehidratación desde `pd:sessions` al montar. El usuario debe `Guardar` para hacerlo durable.
- `beforeunload` dispara el confirm nativo del navegador cuando `(result !== null && !persisted) || hasPendingEdit`. Mismo umbral que el `window.confirm` que ya existía en `Regenerar`.
- Un indicador `SIN GUARDAR` en la status strip (a la derecha del título, `text-signal`, uppercase tracking-plus) refleja el mismo umbral. Sin equivalente "GUARDADO" pasivo.
- `Guardar` vive como botón signal primario en el footer de la chalk card (antes de las acciones ghost Copiar/Exportar/Regenerar/Editar). La pill de la status strip conserva la semántica de "acción sobre el LLM" (`Generar` / `Regenerar`).
- Ver `docs/adr/0004-ephemeral-active-result.md` para el rationale completo y alternativas consideradas.

## Roles

Esta app **no tiene auth ni roles**. Es single-user local (el Entrenador).

## Storage Schema

- `pd:sessions` — `SavedSession[]`
- `pd:classes` — eliminado (migración silenciosa)
- `pd:ideas` — eliminado (migración silenciosa)

## Tech Stack

- **Next.js 16.2** App Router + React 19.2 + TypeScript 5
- **Tailwind CSS v4** + **shadcn/ui** (New York / base-nova, neutral)
- **OpenAI SDK** → `MiniMax-Text-01` (`https://api.minimax.io/v1`)
- **react-markdown** + **remark-gfm** para render del markdown
- **lucide-react** para iconos
- **Sonner** (shadcn) para toasts
- Sin DB, sin auth, sin React Query, sin Zustand, sin Framer Motion.
- **Deploy**: Vercel.

## Patrones Next.js

### Server vs Client Components
- Pages y layouts → Server Components por defecto.
- Solo `'use client'` cuando hay interactividad (form, tabla, modal).
- Para páginas con mucha interactividad, separar en `page.tsx` (Server) + `_components/*-client.tsx` (Client).

### API Routes
- Una sola: `app/api/generate/route.ts` (proxy a MiniMax para ocultar API key).
- POST recibe `{ modalityId: string, input: object }`.
- Retorna `{ content: string, structured: CrossFitPlan, model: string }` o error.

### Rutas de la App

| Ruta | Función | Server / Client |
|---|---|---|
| `/` | Redirige a `/classes` | Server |
| `/classes` | Catálogo de modalidades del sistema (CrossFit primero) | Server shell + Client list |
| `/generate/[modalityId]` | Form de sesión + resultado + mini-historial | Client-only |
| `/api/generate` | POST → generación validada | Server |

> Eliminadas: `/classes/new`, `/classes/[id]`, `/classes/[id]/generate`, `ClaseForm`.

### Proxy de API Key
- `MINIMAX_API_KEY` solo en `.env.local` (jamás expuesto al cliente).
- El cliente llama a `/api/generate`, el server compose el prompt y llama a MiniMax.

### Metadata
- Cada layout exporta `metadata`.

### Base UI / Button + Link
- El preset `base-nova` de shadcn (Next 16 + Tailwind v4 + React 19) usa **Base UI** internamente, no Radix.
- Componente `Button` con `render={<Link href="..." />}` **debe** incluir `nativeButton={false}`.
- Patrón correcto:
  ```tsx
  <Button nativeButton={false} render={<Link href="/classes">}>Volver</Button>
  ```
- Si el Button ejecuta una **acción** (no navegación), usar `<Button onClick={...}>` directamente.

## Términos del Dominio

- **Entrenador** — usuario único de la app.
- **Modalidad** — módulo de generación registrado en código (ej. CrossFit). Cada modalidad encapsula contexto, schemas, conversor y render.
- **Sesión** — unidad generada por la IA; instancia de una modalidad puntual con input del Entrenador.
- **SavedSession** — sesión persistida en `pd:sessions`.
- **active result** — instancia en memoria de `SavedSession` que vive en el estado local del componente `GenerateClient` desde que aterriza el LLM hasta que se cierra la tab. Es **efímero**: no se rehidrata al montar. Mientras `persisted === false` o hay `hasPendingEdit`, el trabajo es local y puede perderse; el indicador `SIN GUARDAR` y el `beforeunload` guard son la red de seguridad.
- **input** — parámetros que el Entrenador completó en el formulario de generación.
- **structured** — output del LLM en su forma estructurada (object). En sesiones nuevas es siempre `null` (la salida es markdown); el campo se conserva para compatibilidad hacia atrás con sesiones pre-0010.
- **markdown** — contenido de la sesión usado para re-render, copiar y exportar. Es la fuente de verdad visual.
- **Generar** — invocar la IA con el contexto de la modalidad y el input del Entrenador.
- **Regenerar** — invocar la IA con el mismo input (descarta resultado pendiente).
- **Copiar** — acción que pone el `markdown` en el portapapeles.
- **Exportar `.md`** — acción que descarga el `markdown` como archivo.
- **Guardar** — acción que persiste el `active result` en `pd:sessions` (`addSession` la primera vez, `updateSession` las siguientes). Disponible en view y edit mode; disabled cuando no hay diff.
- **MiniMax-Text-01** — modelo por defecto.
- **OpenAI-compatible** — MiniMax expone el mismo contrato que OpenAI Chat Completions.

## Plantilla CrossFit — Detalle

**Cuatro fases obligatorias** (en este orden):
1. **Warm-Up** — Calentamiento específico para el movimiento principal y el WOD.
2. **Strength / Skill** — Técnica o fuerza con series, repeticiones y cargas.
3. **WOD** — Workout of the Day en formato preseleccionado.
4. **Cool Down** — Vuelta a la calma y movilidad final.

**Parámetros por sesión**:
| Campo | Obligatorio | Descripción |
|---|---|---|
| `strengthSkill` | Sí | Esquema de técnica/fuerza del día |
| `wodFormat` | Sí | `AMRAP`, `EMOM`, `For Time`, `Tabata`, `Intervalos` o `Aleatorio` |
| `focusMovement` | No | Movimiento técnico principal (opcional) |
| `considerations` | No | Notas especiales del entrenador (opcional) |
| `duration` | No | 45 / 60 (default) / 75 / 90 minutos |

> **Aleatorio** se resuelve internamente al formato que mejor se adapte al estímulo técnico. La salida `sections.wod.format` será siempre un formato concreto, nunca "Aleatorio".

> **Sin video URL** en este alcance.

## Ver también

- `DESIGN.md` — sistema de diseño.
- `AGENTS.md` — protocolo de sesión y routing de delegación.
- `docs/adr/0001-single-user-local-architecture.md` — decisión local-first.
- `docs/adr/0003-system-modalities.md` — registry de modalidades y decisión de storage.
- `docs/adr/0004-ephemeral-active-result.md` — active result efímero + `beforeunload` guard + indicador `SIN GUARDAR`.
