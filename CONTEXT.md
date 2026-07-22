# Plan Deportivo IA - Context

App minimalista para que un **Entrenador** genere **Ideas de Clase** con IA. Sin DB, sin auth, sin multi-tenant. Todo el estado vive en `localStorage` del navegador.

## Concepto

- Un **Entrenador** (single-user local) define **Clases** una vez (p.ej. "Crossfit", "Bodybuild", "Gymnastics").
- Cada **Clase** tiene: `name`, `structure` (markdown libre que define el formato de respuesta), `exercises` (text pool — lista de movimientos disponibles), `durationMinutes`.
- Para una Clase puntual, el Entrenador genera **Ideas** con la IA y las usa con sus alumnos.
- La estructura y los ejercicios de una Clase se persisten y se reusan para todas sus Ideas.

## Modelo de Datos

### Clase
- `id: string` — uuid.
- `name: string` — "Crossfit", "Bodybuild", "Gymnastics", etc.
- `structure: string` — markdown libre que define el formato de respuesta.
- `exercises: string[]` — text pool de movimientos disponibles para esta Clase.
- `durationMinutes: number` — duración típica objetivo.
- `createdAt: string` — ISO timestamp.
- Persistido como elemento de `pd:classes: Clase[]` en localStorage.

### Idea
- `id: string` — uuid.
- `classId: string` — referencia a la Clase origen.
- `content: string` — markdown devuelto por la IA (la versión editada por el Entrenador, si editó).
- `model: string` — `MiniMax-M3` (u otro).
- `focus?: string` — foco de la sesión que el Entrenador escribió al generar (si escribió).
- `createdAt: string` — ISO timestamp.
- Persistido como `pd:ideas: Idea[]` en localStorage.

> Antes de guardar, la Idea pasa por el editor (Q5 = edit-then-save). El `content` persistido refleja la versión final editada por el Entrenador, no la salida cruda del LLM.

### Historial
- Por ahora: array plano de `Idea`. Filtrable por `classId`. Sin límite duro — se ajustará con uso.

## Reglas del Negocio

### Construcción del Prompt
El system prompt se arma **derivado de la Clase**:

```
[SYSTEM]
Sos un coach deportivo. Trabajás exclusivamente dentro del marco de la clase
"{class.name}". Reglas:

- Estructura obligatoria (respetá este orden y estos títulos):
  {class.structure}

- Ejercicios disponibles (preferí estos salvo que el usuario pida otro):
  {class.exercises.join(", ")}

- Duración objetivo: {class.durationMinutes} min.

[USER]
Generá una idea de sesión para esta clase.
Foco de hoy (opcional): {session.focus ?? "ninguno"}.
```

- El foco es opt-in. Si está vacío, queda literal `Foco de hoy (opcional): ninguno.` y la IA ignora el énfasis.
- La estructura de la Clase manda. Si la IA quiere agregar bloques fuera, no puede.
- Si el response viene con `…` u `…`, se filtran antes de guardar.

### Generación
- **Modelo**: `MiniMax-M3` (default). Configurable vía constante en `lib/minimax.ts`.
- **temperature**: `0.7`.
- **max_tokens**: `4096`.

### Almacenamiento
- Persistencia 100% local del navegador.
- Nada se guarda en servidor (más allá de la llamada a MiniMax).
- Cambiar de navegador = empezar de cero (privacidad por diseño).

### Errores
- API falla → toast con mensaje genérico, no exponer detalles internos.
- Response vacío → reintentar una vez, luego mostrar error.

### Acciones sobre una Idea

Una vez generada y opcionalmente editada, la Idea soporta estas acciones (todas en el card de resultado):

| Acción | Comportamiento | Persistencia |
|---|---|---|
| **Copiar** | Copia el `content` (markdown) al portapapeles vía `navigator.clipboard.writeText`. | No escribe storage. |
| **Exportar `.md`** | Genera `Blob` del `content`, crea `<a download>` con filename `{className}-{YYYY-MM-DD}.md` y dispara click. | No escribe storage. |
| **Regenerar** | Llama de nuevo al LLM con la misma Clase (descarta la edición actual, con confirmación si hay cambios sin guardar). | Reemplaza el `content` actual (NO persistido todavía). |
| **Guardar** | Persiste la Idea editada en `pd:ideas`. | `Idea.content` queda en storage. |
| **Editar** (toggle) | Cambia el card entre vista markdown renderizado ↔ textarea con preview. | Ninguna hasta que se persista. |

## Roles

Esta app **no tiene auth ni roles**. Es single-user local (el Entrenador).

## Storage Schema (final v1)

- `pd:classes` — `Clase[]`
- `pd:ideas` — `Idea[]`

## Tech Stack

- **Next.js 16.2** App Router + React 19.2 + TypeScript 5
- **Tailwind CSS v4** + **shadcn/ui** (New York / base-nova, neutral)
- **OpenAI SDK** → `MiniMax-M3` (`https://api.minimax.io/v1`)
- **react-markdown** + **remark-gfm** para render del markdown de la estructura y de las Ideas
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
- POST recibe `{ classContext: ClaseResumen }`.
- Retorna `{ content: string, model: string }`.

### Rutas de la App (decisión Q6 = dos flows separados)
| Ruta | Función | Server / Client |
|---|---|---|
| `/` | Redirige a `/classes` | Server |
| `/classes` | Lista de Clases del Entrenador + botón "Nueva Clase". Empty state si no hay. | Server shell + Client list |
| `/classes/new` | Form de creación de Clase (name, structure markdown, exercises, duration) | Server shell + Client form |
| `/classes/[id]` | Ver/Editar Clase existente (mismo form, precargado) | Server shell + Client form |
| `/classes/[id]/generate` | Form de generación (focus opcional) + display de Idea en markdown + acciones (regenerar, editar, guardar, copiar, descargar .md) | Client-only (mucha interactividad) |
| `/ideas` | **Fuera de MVP.** Lista de Ideas agrupadas por Clase. Se hará si el volumen lo justifica. | — |

### Proxy de API Key
- `MINIMAX_API_KEY` solo en `.env.local` (jamás expuesto al cliente).
- El cliente llama a `/api/generate`, el server compone el prompt y llama a MiniMax.

### Metadata
- Cada layout exporta `metadata`.

## Términos del Dominio

- **Entrenador** — usuario único de la app; dueño de todas las Clases e Ideas.
- **Clase** — categoría predefinida de entrenamiento (crossfit, bodybuild…). Tiene estructura, ejercicios, duración.
- **Estructura de Clase** — markdown libre con la forma que la IA debe dar a las Ideas.
- **Ejercicios** — text pool de movimientos disponibles para esa Clase.
- **Idea (de Clase)** — instancia generada por la IA para una Clase puntual; persistida después de pasar por el editor.
- **Generar** — invocar la IA con el system prompt derivado de la Clase.
- **Regenerar** — invocar la IA con la misma Clase (descarta edición pendiente).
- **Copiar** — acción que pone el `content` de la Idea en el portapapeles.
- **Exportar `.md`** — acción que descarga el `content` como archivo markdown con nombre `{className}-{YYYY-MM-DD}.md`.
- **MiniMax-M3** — modelo por defecto.
- **OpenAI-compatible** — MiniMax expone el mismo contrato que OpenAI Chat Completions.

## Estructura de Clase CrossFit (canónica, ya escrita por el Entrenador)

Una Clase Crossfit válida tiene **tres bloques clásicos**, en este orden:

### 1. Skill (Specific Warm-up + Técnica)
- Preparación específica del movimiento del día.
- Trabajo con barra vacía, bandas o cargas livianas.
- Bajo volumen, foco en patrón motor.

### 2. Strength (Fuerza)
- Levantamiento principal con carga prescripta (típicamente 70-75% 1RM).
- Pocas reps por set (3-7).
- Objetivo: técnica bajo carga + reclutamiento de fuerza.

### 3. WOD — Workout of the Day (Conditioning)
Formato de alta intensidad. Valores válidos:
- `amrap` — As Many Rounds As Possible en N minutos
- `for_time` — Completar el trabajo lo más rápido posible
- `emom` — Every Minute On the Minute (una ronda por minuto)
- `tabata` — 8 rounds de 20" work / 10" rest

**Movimiento técnico del día:** cada Idea referencia un movimiento clave (The Wall Ball, The Front Squat, etc.) con video demostrativo.

> Esta estructura es el contenido semilla del campo `structure` de la Clase "Crossfit". Otras Clases (bodybuild, gymnastics) usan otra estructura.

## Ver también

- `DESIGN.md` — sistema de diseño.
- `AGENTS.md` — protocolo de sesión y routing de delegación.
