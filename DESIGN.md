# Plan Deportivo IA - Design System

> **Status**: v1 — tema vigente desde el inicial.
> **Source of truth visual**: `src/app/globals.css` (tokens `@theme`).
> **Componentes**: shadcn/ui (New York + Neutral + CSS variables).

## Overview

Minimalismo denso-pero-limpio, B2C. Inspirado en Linear, Vercel y Stripe. Sin decoración, sin ilustraciones, sin gradientes. Una sola acción primaria por pantalla.

## Color Palette

### Light Mode

| Token | Valor oklch | hex | Uso |
|---|---|---|---|
| `--background` | `0.99 0 0` | `#fafafa` | Fondo principal |
| `--foreground` | `0.18 0 0` | `#1f1f1f` | Texto principal |
| `--card` | `1 0 0` | `#ffffff` | Cards y contenedores |
| `--card-foreground` | `0.18 0 0` | `#1f1f1f` | Texto en cards |
| `--primary` | `0.65 0.17 155` | `#16a35f` | Botones primarios (verde "go") |
| `--primary-foreground` | `1 0 0` | `#ffffff` | Texto sobre primary |
| `--secondary` | `0.96 0 0` | `#f5f5f5` | Elementos secundarios |
| `--secondary-foreground` | `0.30 0 0` | `#4a4a4a` | Texto sobre secondary |
| `--muted` | `0.96 0 0` | `#f4f4f4` | Fondos apagados |
| `--muted-foreground` | `0.50 0 0` | `#797979` | Texto apagado |
| `--accent` | `0.95 0.05 155` | `#e0f3e8` | Highlights, hover (pale green) |
| `--accent-foreground` | `0.18 0 0` | `#1f1f1f` | Texto sobre accent |
| `--border` | `0.92 0 0` | `#e8e8e8` | Bordes |
| `--input` | `0.92 0 0` | `#e8e8e8` | Inputs |
| `--ring` | `0.65 0.17 155` | `#16a35f` | Focus rings |

### Dark Mode

| Token | Valor oklch | Uso |
|---|---|---|
| `--background` | `0.15 0 0` | Fondo oscuro |
| `--foreground` | `0.96 0 0` | Texto claro |
| `--card` | `0.20 0 0` | Cards |
| `--card-foreground` | `0.96 0 0` | Texto en cards |
| `--primary` | `0.70 0.18 155` | Verde más claro en dark |
| `--border` | `0.30 0 0` | Bordes sutiles |

## Tipografía

- **Sans (UI)**: Inter Variable via `next/font/google`.
- **Mono (código / markdown raw)**: Geist Mono.
- **Escala**: default de Tailwind v4 (sin customización en MVP).

## Layout

- **Sidebar fija** 200px en desktop + contenido con `max-w-3xl` centrado.
- **Spacing**: generoso, mucho whitespace. Padding base `p-6` en cards.
- **Mobile**: sidebar colapsa en drawer (futuro). Por ahora stack vertical.
- **Breakpoints**: estándar de Tailwind v4 (`sm`, `md`, `lg`).

## Componentes

### Botones
- Primary → acción dominante (1 por pantalla).
- Secondary/outline → acciones de apoyo.
- Ghost → acciones terciarias (regenerar, copiar).
- Icon-only `size="icon"` → acciones de la sidebar.

### Cards
- `rounded-lg border bg-card p-6`.
- **No** envolver tablas en Card (esta app no tiene tablas).

### Inputs / Textarea
- Border sutil + focus ring verde (`--ring`).
- Textarea con altura mínima `min-h-32`.

### Tabs (estructura: editor ↔ preview)
- Sin animación de underline; cambio de panel instantáneo.

### Badges (chips multiselect de objetivos)
- Clickable, toggle on/off. Selected = `bg-primary text-primary-foreground`.

### Sonner (toasts)
- Top-right. Color: success = verde, error = rojo, info = neutral.

## Spacing & Radius

- **Radius base**: `0.5rem` (`rounded-lg`).
- **Espaciado interno de cards**: `p-6`.
- **Gap entre secciones**: `gap-8`.

## Estados

- **Loading** mientras se genera el plan: spinner inline en el botón + Card con 3 dots animados.
- **Empty state** del historial: mensaje centrado con icono.
- **Error**: toast rojo con copy genérico + botón "Reintentar".

## Ver también

- `CONTEXT.md` — modelo de datos, reglas, stack.
- `AGENTS.md` — protocolo de sesión.
