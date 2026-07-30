# Plan Deportivo IA - Context

App minimalista para que un **Entrenador** genere sesiones de entrenamiento con IA. Sin DB, sin auth, sin multi-tenant. Todo el estado vive en `localStorage` del navegador.

## Concepto

- El sistema ofrece **modalidades** (CrossFit primero) como módulos registrados en código. El Entrenador no crea ni configura plantillas.
- El catálogo `/classes` lista las modalidades disponibles; no hay creación de Clase por el usuario.
- Cada generación produce una **sesión** puntual: input del Entrenador → IA → sesión validada → guardar, copiar o exportar.
- CrossFit valida exactamente 4 fases: Warm-Up, Strength / Skill, WOD, Cool-Down. Input obligatorio: `strengthSkill` y `wodFormat`; opcional: `focusMovement` y `considerations`.
- `Aleatorio` se ofrece al Entrenador como opción seleccionable en el formulario (junto a AMRAP, EMOM, For Time, Tabata, Intervalos). Cuando se elige, el sistema lo resuelve internamente a un formato concreto antes de invocar el LLM. La salida `sections.wod.format` será siempre un formato concreto (nunca "Aleatorio").
- No se usa `response_format` en MiniMax-M3; JSON se pide en prompt y se valida con Zod server-side; reintento una vez antes de fallar.
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
- `model: string` — `MiniMax-M3` u otro.
- `title: string` — título generado para la sesión.
- `markdown: string` — contenido en markdown (para copiar/exportar).
- `structured: object` — objeto validado tal como lo devolvió el LLM (para re-render).
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
{contexto canónico de docs/instrucciones-crossfit.md}

## Parámetros de esta sesión
- Strength/Skill: {input.strengthSkill}
- Formato WOD: {resolvedFormat}
- Movimiento foco: {input.focusMovement}   (si existe)
- Consideraciones: {input.considerations}  (si existe)
- Duración total objetivo: {input.durationMinutes} min

[USER]
Generá la estructura de la clase de CrossFit para esta sesión.

Parámetros:
- Strength/Skill: {input.strengthSkill}
- Formato WOD: {resolvedFormat}
... (mismos parámetros sin las consideraciones extra)
```

### Generación
- **Modelo**: `MiniMax-M3` (hardcodeado en `src/lib/modalities/crossfit-schemas.ts` línea 192). No existe archivo `lib/minimax.ts`.
- **Thinking**: explícitamente `disabled`. Prioriza latencia y costo. `stripThinkBlocks()` queda como defensa ante defaults del proveedor.
- **Sin `response_format`**: MiniMax-M3 no soporta `response_format: { type: "json_object" }` de forma estable. JSON se solicita en prompt y se valida server-side con Zod.
- **Reintento**: una vez en caso de JSON inválido; luego error genérico.
- **temperature**: `0.7`.
- **max_tokens**: `4096`.

### Almacenamiento
- Persistencia 100% local del navegador.
- `pd:sessions` — array de `SavedSession`.
- `pd:classes` y `pd:ideas` se descartan silenciosamente al primer read (migración transparente).
- Cambiar de navegador = empezar de cero (privacidad por diseño).

### Errores
- API falla → toast con mensaje genérico, no exponer detalles internos.
- Response vacío o JSON inválido → reintentar una vez, luego mostrar error.

### Acciones sobre el Resultado

| Acción | Comportamiento | Persistencia |
|---|---|---|
| **Copiar** | Copia el `markdown` al portapapeles vía `navigator.clipboard.writeText`. | No escribe storage. |
| **Exportar `.md`** | Genera `Blob` del `markdown`, crea `<a download>` con filename `{modalityId}-{YYYY-MM-DD}.md` y dispara click. | No escribe storage. |
| **Regenerar** | Llama de nuevo al LLM con el mismo input (descarta la edición actual, con confirmación si hay cambios sin guardar). | No persiste. |
| **Guardar** | Persiste la sesión en `pd:sessions`. | `SavedSession` queda en storage. |

## Roles

Esta app **no tiene auth ni roles**. Es single-user local (el Entrenador).

## Storage Schema

- `pd:sessions` — `SavedSession[]`
- `pd:classes` — eliminado (migración silenciosa)
- `pd:ideas` — eliminado (migración silenciosa)

## Tech Stack

- **Next.js 16.2** App Router + React 19.2 + TypeScript 5
- **Tailwind CSS v4** + **shadcn/ui** (New York / base-nova, neutral)
- **OpenAI SDK** → `MiniMax-M3` (`https://api.minimax.io/v1`)
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
- Retorna `{ content: string, structured: object, model: string }` o error.

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
- **input** — parámetros que el Entrenador completó en el formulario de generación.
- **structured** — output validado del LLM en su forma estructurada (object).
- **markdown** — versión legible del `structured`, usada para copiar y exportar.
- **Generar** — invocar la IA con el contexto de la modalidad y el input del Entrenador.
- **Regenerar** — invocar la IA con el mismo input (descarta resultado pendiente).
- **Copiar** — acción que pone el `markdown` en el portapapeles.
- **Exportar `.md`** — acción que descarga el `markdown` como archivo.
- **MiniMax-M3** — modelo por defecto.
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
