---
label: chore
status: open
parent: 0018-ui-ux-polish
depends_on: []
blocks:
  - "0021"
  - "0022"
---

# 0020 — DRY utilities: clipboard + sessions helpers

## Parent

[0018 — UI/UX polish: guards, history completeness, design tokens](../0018-ui-ux-polish.md)

## What to build

Refactor puro. Extraer dos helpers que hoy están duplicados o inline, y consolidar el `Regenerar` duplicado. No cambia comportamiento de usuario; reduce superficie de drift.

1. **`src/lib/clipboard.ts`** (nuevo). Dos funciones puras:
   - `copyToClipboard(text: string): Promise<{ ok: boolean; error?: string }>` que wrappea `navigator.clipboard.writeText` y resuelve con el resultado.
   - `downloadAsMarkdown(filename: string, text: string): void` que arma el `Blob` con `type: "text/markdown"`, crea `<a download>`, dispara `click()`, libera la URL. Fire-and-forget.

2. **`src/lib/sessions.ts`** (nuevo). Helper puro:
   - `loadSessionInto(source: SavedSession): SavedSession` que retorna el `source` tal cual (la función existe para dar nombre a la transición de estado y permitir test unitario futuro). Preserva `id`, `createdAt`, `model`, `structured`, `markdown`, `input`, `title`.

3. **Reemplazar handlers inline** en `generate-client.tsx:949-953, 962-975` (mini-historial) y consolidar `handleCopy`/`handleExport` (`:253-275`) para que usen los nuevos helpers. Mismos toasts (`"Copiado al portapapeles"`, `"No se pudo copiar"`), mismo filename pattern (`{slug}-{YYYY-MM-DD}.md`).

4. **Sacar `Regenerar` del footer de la chalk card** (`generate-client.tsx:794-803`). Mantener solo en el status strip (`:511-517`). Justificación documentada en el PRD §M4: la card es para acciones de resultado, no para acciones sobre el LLM. El status strip ya carga la acción primaria de la pantalla.

5. **No tocar** la barra del strip de footer que dice `Generar`/`Regenerar` — sigue siendo la acción primaria.

Sin cambios de schema, sin nuevas keys de storage, sin cambios de UI más allá de quitar un botón. Patrón existente: helpers puros en `src/lib/calculator/history.ts` con barrel `@/lib/calculator` (per `AGENTS.md:94`); replicar para `@/lib/clipboard` y `@/lib/sessions`.

## Blocked by

None — can start immediately.

## Acceptance criteria

- [ ] `src/lib/clipboard.ts` exporta `copyToClipboard` y `downloadAsMarkdown` con tipos exactos del PRD §M4.
- [ ] `src/lib/sessions.ts` exporta `loadSessionInto` como función pura.
- [ ] `handleCopy` y `handleExport` en `generate-client.tsx` usan los nuevos helpers; los toasts son idénticos a los anteriores.
- [ ] Los handlers inline del mini-historial (`:949-953, 962-975`) usan los mismos helpers.
- [ ] El footer de la chalk card ya no muestra el botón `Regenerar` (`:794-803` eliminado o comentado).
- [ ] El botón `Regenerar` del status strip sigue funcionando idéntico.
- [ ] `npm run build` pasa sin errores de TypeScript.
- [ ] `npm run lint` pasa sin nuevos warnings.
- [ ] El patrón de barrel `import { ... } from "@/lib/..."` se respeta; no se importa el archivo interno directo.

## Manual end-to-end test

### Setup

- `npm run dev` y abrir `http://localhost:3000/classes`.
- DevTools → Application → Local Storage → delete `pd:sessions` (clean slate).

### Steps

1. **Copiar desde el resultado activo.**
   - En `/generate/crossfit`, completá `Strength / Skill = "Back Squat 5x5"`, `WOD Format = AMRAP`. Tocar `Generar`.
   - Click `Copiar` en el footer de la card.
   - Expect: toast "Copiado al portapapeles".
   - Pegar en otra app.
   - Expect: aparece el markdown completo de la sesión.

2. **Exportar desde el resultado activo.**
   - Con la misma sesión generada, click `Exportar`.
   - Expect: descarga `{crossfit}-2026-08-29.md` (fecha de hoy).
   - Abrir el `.md` descargado.
   - Expect: contenido idéntico al markdown renderizado en la card.

3. **Copiar desde el mini-historial.**
   - Tocar `Guardar` para persistir la sesión.
   - En el mini-historial (panel derecho en `lg+` o abajo en mobile), click `Copiar` en el item recién creado.
   - Expect: mismo toast y mismo comportamiento que el `Copiar` de la card.

4. **Exportar desde el mini-historial.**
   - En el mismo item del mini-historial, click `Exportar`.
   - Expect: descarga `.md` con filename `{crossfit}-2026-08-29.md`.

5. **Regenerar solo en el strip.**
   - Con la sesión activa en la card, mirá el footer de la card.
   - Expect: NO aparece el botón `Regenerar` (solo `Guardar`, `Copiar`, `Exportar`, `Editar`).
   - Mirá el status strip arriba.
   - Expect: aparece el botón `Regenerar` a la derecha.
   - Tocar `Regenerar`.
   - Expect: invoca la API como antes; el footer de la card no es la fuente de la acción.

6. **Visual continuity.**
   - No debe haber regresiones de estilo: todos los botones ghost mantienen `font-mono tabular text-xs text-mute hover:text-bone hover:bg-muted rounded-sm h-8 px-2.5 gap-1.5`.
