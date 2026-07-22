# Plan Deportivo IA

App minimalista para generar planes de ejercicio deportivo con IA (MiniMax-M3). Sin DB, sin auth: toda la persistencia es local del navegador.

## Stack

- **Next.js 16.2** + React 19.2 + TypeScript 5 (App Router, Turbopack)
- **Tailwind CSS v4** + **shadcn/ui** (New York / base-nova, neutral)
- **OpenAI SDK** (compatible con `https://api.minimax.io/v1`) → modelo `MiniMax-M3`
- **react-markdown** + **remark-gfm** para render del plan
- Persistencia 100% local (`localStorage`)
- Lint: `eslint-config-next` (incluye reglas del React Compiler)

## Setup

```bash
# 1. Instalar deps
npm install

# 2. Configurar API key
# Editá .env.local y poné tu key real:
#   MINIMAX_API_KEY=tu-key-real-de-platform.minimax.io

# 3. Correr en dev
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

> Tip: `npm run dev -- --port 3737` para usar otro puerto.

## Estructura

```
src/
├── app/
│   ├── api/generate/route.ts          # Proxy → MiniMax (oculta API key)
│   ├── generate/_components/          # Form + result client-side
│   ├── history/page.tsx
│   ├── layout.tsx
│   ├── page.tsx                       # Editor de estructura
│   └── globals.css
├── components/
│   ├── ui/                            # shadcn (11 componentes)
│   ├── nav.tsx
│   ├── structure-editor.tsx           # Editor markdown + tabs editor/preview
│   ├── plan-form.tsx                  # Form de PlanInput
│   ├── plan-result.tsx                # Render markdown + acciones
│   └── history-list.tsx
├── hooks/use-local-storage.ts         # Wrapper con useSyncExternalStore
└── lib/
    ├── types.ts                       # PlanInput, GeneratedPlan, etc.
    ├── minimax.ts                     # Cliente OpenAI SDK → MiniMax
    ├── build-prompt.ts                # System + user prompt
    └── storage.ts                     # Helpers localStorage tipados

.agents/skills/      ← 28 skills Matt Pocock + vercel + pproenca
.opencode/agent/     ← 7 subagentes (orchestrator + 6 subagentes)
AGENTS.md            ← Protocolo de sesión + routing de delegación
CONTEXT.md           ← Lenguaje compartido del dominio
DESIGN.md            ← Sistema de diseño (tokens, paleta, componentes)
```

## Flujo

1. **Estructura** (`/`): el usuario define (una sola vez) la estructura markdown que la IA debe respetar. Se persiste en `localStorage["pd:structure"]`.
2. **Generar** (`/generate`): form con deporte, nivel, días/sem, duración, objetivos (chips), equipo, notas. Se llama a `/api/generate` que proxea a MiniMax-M3.
3. **Historial** (`/history`): últimos 20 planes guardados manualmente.

## Subagentes opencode

```
plan-orchestrator  (primary, MiniMax-M3)
├─ implementer     (MiniMax-M2.7-highspeed, edit+bash)
├─ architect       (MiniMax-M3, edit deny)
├─ reviewer        (MiniMax-M3, edit deny)
├─ tester          (MiniMax-M2.7-highspeed, edit deny)
├─ explorer        (MiniMax-M2.7-highspeed, edit deny)
└─ docs-writer     (MiniMax-M2.7-highspeed, edit md only)
```

Routing de delegación en `AGENTS.md` (3 niveles según criticidad).

## Scripts

```bash
npm run dev              # Dev con Turbopack
npm run build            # Build + typecheck (Next.js 16)
npm run lint             # ESLint (Next + React Compiler rules)
npm start                # Production server
```

## Despliegue

```bash
# Deploy a Vercel (recomendado)
vercel deploy

# Recordá setear MINIMAX_API_KEY en Environment Variables del proyecto.
```

## Licencia

MIT.
