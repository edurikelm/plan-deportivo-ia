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
- Sección **siempre visible** en `/generate/[modalityId]`, incluso con cero sesiones guardadas. Cuando el array está vacío, muestra el empty state `"Aún no guardaste ninguna sesión."` (mute, label uppercase tracking-plus). Nunca se oculta por condición de longitud.
- En desktop (`lg+`), vive en una columna lateral de 18rem con `sticky top-4` y `max-h-[calc(100vh-2rem)] overflow-auto`. En mobile/tablet, stack vertical debajo del `result card`. Ver `docs/adr/0005-responsive-content-sidebar.md` para el rationale del layout.

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
- **Reintento**: **uno**, sólo si el strip de fences falla. El parser intenta primero `JSON.parse` crudo; si falla, strip de fences markdown (`` ``` `` con o sin language tag) y reintenta parse. Si ambos fallan, retry de la API una vez con system prompt reforzado. Si el retry también falla, error genérico (502). Ver `docs/adr/0006-robust-json-parsing-strip-and-retry.md`.
- **temperature**: `0.7`.
- **max_tokens**: `4096`.

> **Histórico**: el modelo `MiniMax-M2.7-highspeed` (usado en 0010) emitía markdown con `thinking` por defecto (~30s avg) y no era capaz de emitir JSON consistente. El eval humano de la batería (0011) demostró que `MiniMax-Text-01` resuelve ambos problemas a costa de un modelo más "pesado". Ver `docs/agents/eval/eval-models-report.md`.

### Almacenamiento
- Persistencia 100% local del navegador.
- `pd:sessions` — array de `SavedSession`.
- `pd:classes` y `pd:ideas` se descartan silenciosamente al primer read (migración transparente).
- Cambiar de navegador = empezar de cero (privacidad por diseño).

### SavedWeightRecord
- `id: string` — uuid.
- `createdAt: string` — ISO timestamp.
- `exercise: string | null` — nombre del ejercicio. **Obligatorio** en registros `manual` y `foto`; **null** sólo en el legacy `auto-log` (ya no se generan nuevos; ver "Cambios" abajo).
- `barKg: number` — snapshot en kg.
- `discs: DiscRow[]` — **snapshot** del desglose al momento de registrar. No es referencia viva al estado actual de la calculadora.
- `totalKg: number` y `totalLb: number` — totales pre-calculados al persistir.
- `breakdownLine: string` — pre-formateado vía `formatBreakdownLine` para mostrar en listas.
- `source: "auto-log" | "manual" | "foto"` — cómo se capturó. **Sólo `manual` y `foto` se generan desde 0017.** `auto-log` queda en el enum para que entries stale escritos por builds anteriores sigan validando; Zod los descarta silenciosamente si fallan el enum.
- Persistido en `pd:calculator-records`. **Sin cap** (la feature que justificaba el cap — auto-log — fue removida). Los registros `manual` y `foto` **nunca** se descartan automáticamente.

## Reglas del Negocio

### Auto-log de la calculadora
- Watcher con **debounce 1500ms** (más largo que el draft-save de 250ms). Dispara cuando `barKg` o `discs` cambian y se llega a un estado estable.
- Skip si `discs.length === 0 && barKg === 20` (estado inicial puro, sin carga real).
- Pausa mientras `fotoState.kind === "analyzing"`. Se reanuda al volver a idle.
- Cuando el Foto tab se aplica, persiste un registro `source: "foto"` **inmediato** (no espera el debounce).

### Guardar con etiqueta (manual)
- Botón `Guardar` en el footer sticky de la calculadora (a la izquierda de `Copiar`).
- Abre un **form inline** (no modal, no drawer) con input `Ejercicio` + datalist de `getUniqueExercises()`.
- Submit deshabilitado si `exercise.trim() === ""`. Sin carga real (`discs.length === 0 && barKg === 20`), el botón Guardar está disabled.
- Persiste con `source: "manual"`, `id: crypto.randomUUID()`, `createdAt: new Date().toISOString()`.

### Cargar un registro
- Acción `Cargar` desde el mini-panel o desde `/tools/weight-calculator/history`.
- Reemplaza `barKg` y `discs` en el estado de la calculadora con el snapshot del registro.
- Si el draft actual difiere del registro a cargar, `window.confirm("Reemplazar la carga actual?")` antes de aplicar.
- Desde la página de historial: `setCalculatorState` antes de navegar, así la calculadora abre ya con la carga correcta.

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
- `pd:calculator-state` — `CalculatorState` (auto-save del draft actual, debounce 250ms)
- `pd:calculator-records` — `SavedWeightRecord[]` (historial durable; sólo `manual` y `foto` desde 0017, sin cap)
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
| `/classes` | Catálogo unificado: secciones `MODALIDADES DEL SISTEMA` y `HERRAMIENTAS` (CrossFit primero, Calculadora de Pesos como primera herramienta) | Server shell + Client list |
| `/generate/[modalityId]` | Form de sesión + resultado + mini-historial | Client-only |
| `/tools/weight-calculator` | Calculadora de pesos (Manual + Foto tabs, sticky bottom total, mini-panel de registros etiquetados) | Client-only |
| `/tools/weight-calculator/history` | Historial completo de cargas: lista, búsqueda, filtros por source, sort | Client-only |
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
- **Calculadora de Pesos** — surface nueva (`/tools/weight-calculator`) para calcular el peso total de una sesión de levantamiento. No es una modalidad: no genera con IA; es un utility manual. Convive con `/classes` como herramienta operativa.
- **Barra** — campo separado de los discos en la calculadora. Shape: `{ weightKg: number }`, siempre en kg. UI expone dos chips preset (`15`, `20`) más una opción "Otro" para cualquier otro valor. Por default `weightKg = 20`.
- **Disco por lado** — primitiva de carga en la calculadora. Una fila representa N placas del mismo peso en un solo lado de la barra. Shape: `{ weight: number, unit: "kg" | "lb", count: integer }`. `unit` es por fila (mezcla kg/lb permitida). `count` default `1`. El peso total por lado es `Σ(weight_kg × count)`.
- **Peso total** — suma `bar_kg + 2 × Σ(weight_kg × count)`, mostrada siempre en kg y lb en la calculadora. Resultado de la IA en el Foto tab retorna además `totalKg` y `totalLb` explícitos para cross-check; el sistema valida que coincidan con los totales derivados del desglose antes de habilitar el botón **Aplicar al cálculo**.
- **Estado compartido de la calculadora** — único objeto `{ barKg, discs }` que ambos tabs leen y escriben. El Foto tab **no** escribe directamente: propone un desglose en su propio preview y sólo aplica al estado al confirmar el usuario.
- **Total sticky** — el peso total se muestra en una franja `sticky bottom-0` siempre visible: `TOTAL · {totalKg} KG · {totalLb} LB` en Geist Mono tabular grande, debajo el breakdown en mute (`20kg + (55lb + 2.5kg)×2`). Border-left `1px solid signal` ("regla de tiza") indica que es el resultado activo.
- **Persistencia de la calculadora** — el estado `{ barKg, discs }` se auto-guarda en `localStorage` key `pd:calculator-state` con debounce en cada cambio. Al cerrar y volver, la calculadora abre con la última carga. Sin `beforeunload` guard (nada se pierde nunca). Sin mini-historial. Botón ghost `Limpiar` arriba a la derecha resetea a defaults (`{ barKg: 20, discs: [] }`) con `window.confirm`.
- **SavedWeightRecord** — unidad durable de un cálculo de peso persistido en `pd:calculator-records`. Snapshot de `{ barKg, discs, totalKg, totalLb, breakdownLine, exercise, source }`. Se crea por dos caminos: (a) **Guardar con etiqueta** explícito (`exercise` obligatorio, `source: "manual"`), (b) **Foto attribution** cuando el coach acepta una foto (`exercise: null`, `source: "foto"`, persistido inmediatamente).
- **Guardar con etiqueta** — acción explícita del coach. Abre un form inline con campo `Ejercicio` (obligatorio) y persiste un `SavedWeightRecord` con `source: "manual"`.
- **Cargar (en historial)** — acción que rehidrata el estado de la calculadora con el snapshot de un registro guardado. Sobrescribe el draft actual; pide `window.confirm` si el draft difiere.
- **Mini-panel de registros** — sección en `/tools/weight-calculator` debajo del bar visualization. Lista las últimas 5 `SavedWeightRecord` **etiquetadas** (no auto-log). Cada fila tiene `Cargar`. Footer: link a la página completa de historial.
- **Página de historial** — `/tools/weight-calculator/history`. Vista completa, buscable, filtrable (Todos / Manual / Foto), ordenable de todos los registros.
- **Foto tab UX** — un solo botón "Elegir foto" (`<input type="file" accept="image/*">` sin `capture`, mobile chooser nativo muestra cámara/galería/archivos). Cuatro estados: (a) vacío con copy + botón + privacy disclosure inline, (b) foto cargada con thumbnail + botones `Elegir otra` / `Analizar`, (c) analizando con status strip signal-fill + label `Analizando…` (sin spinner en el botón), (d) preview del desglose. Constraints client-side: max 5MB, JPEG/PNG/WebP, min 200×200px.
- **Endpoint `/api/calculate-weight`** — endpoint dedicado (no extiende `/api/generate`) que recibe `multipart/form-data` con campo `image: File`. Server valida tamaño/formato, codifica a base64, llama a un modelo vision-capable, devuelve `{ ok, breakdown, model }` o error. Las herramientas no son modalidades; no se reutiliza el registry.
- **Model split por capability** — `MiniMax-Text-01` se mantiene para CrossFit (no se toca lo que funciona, JSON valid 100%, ~13s avg). Para visión se usa `MiniMax-M3` (único modelo documentado con soporte `image_url` / `video_url`). Cada endpoint instancia su propio `OpenAI` client contra `https://api.minimax.io/v1`. No se migra CrossFit a M3 (riesgo de romper JSON output estable).
- **Status strip de la calculadora** — lado izquierdo: `← Volver` + título display italic `Calculadora de Pesos`. Lado derecho: indicador de estado sin acción. Tres estados: `LISTO` (mute, pasivo), `ANALIZANDO…` (signal-fill, en transición coreografiada del design system), `REVISAR PREVIEW` (mute con dot signal, cuando hay preview del Foto tab sin aplicar). Sin botones en el strip — la acción `Aplicar al cálculo` vive dentro del Foto tab chalk card; el botón `Limpiar` vive arriba a la derecha del form.

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
- `docs/adr/0005-responsive-content-sidebar.md` — excepción responsive de dos columnas para el mini-historial en `/generate/[modalityId]`.
- `docs/adr/0006-robust-json-parsing-strip-and-retry.md` — strip de fences markdown + retry una vez en `generateCrossFitSession`.
- `docs/adr/0009-saved-weight-records.md` — historial durable de pesos en la calculadora (auto-log + guardar con etiqueta, mini-panel + página completa).
