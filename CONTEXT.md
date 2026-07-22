# Plan Deportivo IA - Context

App minimalista para generar planes de ejercicio deportivo con IA. Sin DB, sin auth, sin multi-tenant. Todo el estado vive en `localStorage` del navegador.

## Concepto

El usuario define **una sola vez** una **Estructura de Respuesta** (markdown libre) que describe cómo quiere que la IA le responda siempre. Luego completa un **Plan Input** con datos del entrenamiento (deporte, nivel, días, etc.) y la IA devuelve el plan siguiendo esa estructura. La estructura es editable en cualquier momento.

## Modelo de Datos

### StructureTemplate (Estructura de Respuesta)
- Texto markdown libre que define el formato de salida deseado.
- Se persiste como `localStorage["pd:structure"]` (string).
- Existe **una sola estructura activa** por navegador.
- Ejemplo:
  ```
  # {deporte} — Semana {n}
  ## Calentamiento (10 min)
  ## Bloque principal (35 min)
  ## Cool-down (10 min)
  ## Notas del coach
  ```

### PlanInput (Datos del Entrenamiento)
- `sport: string` — fútbol, gym, running, yoga, ciclismo, otro (input libre).
- `level: "beginner" | "intermediate" | "advanced"` — nivel del usuario.
- `daysPerWeek: number` (1-7) — frecuencia.
- `sessionMinutes: number` — duración por sesión.
- `goals: string[]` — hipertrofia, fuerza, resistencia, movilidad, pérdida de peso, etc. (chips multiselect).
- `equipment: string` — texto libre con lo que tiene disponible.
- `notes?: string` — lesiones, limitaciones, contexto extra.

### GeneratedPlan (Plan Generado)
- `id: string` — uuid.
- `createdAt: string` — ISO timestamp.
- `input: PlanInput` — los datos con los que se generó.
- `content: string` — markdown crudo devuelto por la IA.
- `model: string` — modelo usado (`MiniMax-M3`).

### Historial
- Array de `GeneratedPlan` guardado en `localStorage["pd:history"]`.
- Límite: últimos 20 planes (FIFO cuando se supera).

## Reglas del Negocio

### Construcción del Prompt
El prompt final que se envía a MiniMax sigue esta plantilla:

```
[SYSTEM]
Sos un entrenador deportivo profesional. Respondé siempre siguiendo EXACTAMENTE
la estructura indicada por el usuario en la sección "ESTRUCTURA". Si la estructura
usa placeholders como {deporte}, {semana}, etc., reemplazalos con valores concretos
derivados de los datos provistos. No agregues secciones extra fuera de la estructura.

[USER]
<ESTRUCTURA DEL USUARIO>
---
DATOS DEL PLAN:
{JSON.stringify(planInput, null, 2)}

Generá el plan siguiendo la estructura indicada.
```

### Almacenamiento
- Toda la persistencia es **local del navegador** (`localStorage`).
- Nada se guarda en servidor (más allá de la llamada a la API de MiniMax).
- Cambiar de navegador = empezar de cero (es la privacidad por diseño).

### Generación
- **Modelo**: `MiniMax-M3` (modelo actual de la API MiniMax).
- **temperature**: `0.7` (balance creatividad/consistencia).
- **max_tokens**: `4096` (suficiente para planes largos).
- **stream**: `false` en MVP; ver Riesgos para futura mejora.

### Errores
- Si la API falla → mostrar toast con mensaje genérico, no exponer detalles internos.
- Si el response viene vacío → reintentar una vez, luego mostrar error.

## Roles

Esta app **no tiene auth ni roles**. Es single-user local.

## Storage

- Toda persistencia → `localStorage` del navegador.
- Claves:
  - `pd:structure` — `string` (markdown de la estructura).
  - `pd:history` — `GeneratedPlan[]` (JSON-serializado).

## Tech Stack

- **Next.js 16.2** App Router + React 19.2 + TypeScript 5
- **Tailwind CSS v4** (config en CSS con `@theme`, no JS)
- **shadcn/ui** (CLI latest) — Button, Card, Input, Textarea, Label, Select, Tabs, Badge, ScrollArea, Separator, Sonner
- **OpenAI SDK** (cliente compatible con MiniMax vía `baseURL` custom)
- **react-markdown** + **remark-gfm** — render del plan generado y del editor de estructura
- **lucide-react** — iconos
- **Sonner** (vía shadcn) — toasts
- Sin DB, sin auth, sin React Query, sin Zustand, sin Framer Motion.
- **Deploy**: Vercel

## Patrones Next.js

### Server vs Client Components
- Pages y layouts → Server Components por defecto.
- Solo `'use client'` cuando hay interactividad (form, textarea live preview, tabs).
- Para páginas con mucha interactividad, separar en `page.tsx` (Server) + `_components/*-client.tsx` (Client).

### API Routes
- Solo una: `app/api/generate/route.ts` (proxy a MiniMax para ocultar API key).
- POST recibe `{ structure: string, planInput: PlanInput }`.
- Retorna `{ content: string, model: string }`.

### Proxy de API Key
- `MINIMAX_API_KEY` solo en `.env.local` (nunca expuesto al cliente).
- El cliente llama a `/api/generate`, el server route llama a MiniMax.

### Metadata
- Cada layout exporta `metadata` (title, description).

## Términos del Dominio

- **Estructura** — template markdown que define el formato de respuesta de la IA.
- **Plan Input** — datos del entrenamiento ingresados en el form.
- **Plan Generado** — respuesta de la IA siguiendo la estructura del usuario.
- **Regenerar** — volver a invocar la IA con el mismo input (mismo `PlanInput`).
- **Historial** — últimos N planes generados, persistidos en local.
- **MiniMax-M3** — modelo de IA usado (de la familia MiniMax, 1M token context).
- **OpenAI-compatible** — la API de MiniMax expone el mismo contrato que OpenAI Chat Completions, por eso usamos el SDK de OpenAI con `baseURL` custom.

## Estructura de Clase CrossFit

Una sesión CrossFit válida se compone de **tres fases clásicas**, en este orden:

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

| Formato | Estructura |
|---|---|
| `amrap` | As Many Rounds As Possible en N minutos |
| `for_time` | Completar el trabajo lo más rápido posible |
| `emom` | Every Minute On the Minute (una ronda por minuto) |
| `tabata` | 8 rounds de 20" work / 10" rest |

**Movimiento técnico del día:** cada sesión referencia un movimiento clave (ej. The Wall Ball, The Front Squat, The Overhead Squat) con video demostrativo.

### Modelo de datos implícito

```ts
type WodFormat = "amrap" | "for_time" | "emom" | "tabata";

interface CrossfitSession {
  fecha: string;
  modalidad: "crossfit";
  bloques: [
    { tipo: "skill" },
    { tipo: "strength"; ejercicio: string; porcentajeRm: number; sets: number; reps: number },
    { tipo: "wod"; formato: WodFormat; duracion?: string; ejercicios: Array<{ nombre: string; reps?: string; carga?: string; notas?: string }> }
  ];
  movimientoClave: string;
  videoUrl?: string;
}
```

## Ver también

- `DESIGN.md` — sistema de diseño.
- `AGENTS.md` — protocolo de sesión y routing de delegación.
