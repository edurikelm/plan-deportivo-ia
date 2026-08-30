---
label: feature
status: open
parent: 0018-ui-ux-polish
depends_on:
  - "0020"
blocks: []
---

# 0021 — Load action in mini-history

## Parent

[0018 — UI/UX polish: guards, history completeness, design tokens](../0018-ui-ux-polish.md)

## What to build

Una acción nueva en cada item del mini-historial de `/generate/[modalityId]` que rehidrata el `active result` con una `SavedSession` guardada. Hoy el mini-historial es read-only (solo `Copiar` y `Exportar`). Esto cierra el loop "guardé una sesión → la quiero iterar".

1. **Botón `Cargar` en el footer del mini-historial item**, junto a `Copiar` y `Exportar`. Mismo visual: `font-mono tabular text-[0.6875rem] tracking-[0.04em] text-mute hover:text-bone transition-colors flex items-center gap-1`. Ícono `FolderOpen` de lucide (verificar disponibilidad; fallback `FileInput` si no está).

2. **Handler `handleLoadFromHistory(session: SavedSession)`** en `GenerateClient` que:
   - Llama a `loadSessionInto(session)` (helper de 0020).
   - `setResult(loaded)`, `setEditedMarkdown(null)`, `setMode("view")`, `setPersisted(true)`.
   - Toast: `"Sesión cargada — listo para regenerar o editar"`.

3. **`persisted: true`** al cargar. Razón: la sesión viene del storage, no es nueva. El indicador `SIN GUARDAR` del status strip no aparece. Si el usuario toca `Guardar`, debe hacer `updateSession` (no `addSession`) por la preservación del `id`. El `loadSessionInto` ya preserva el `id`.

4. **El form de generación** debe poblarse con los parámetros del `session.input`. Si el `input` está disponible, hidratar `durationMinutes`, `strengthSkill`, `wodFormat`, `focusMovement`, `considerations` desde él. Esto habilita el flow "Cargar → Regenerar con un tweak" del user story #5.

5. **Sin scroll automático al top.** La card de resultado ya está visible en pantalla. Cargar no debe interrumpir el flow visual.

Sin cambios de schema, sin nuevas keys de storage, sin nuevas rutas. La única key tocada es `pd:sessions` (lectura via `getRecentSessions` existente).

## Blocked by

- **0020** — Necesita `loadSessionInto` helper y el patrón de `copyToClipboard`/`downloadAsMarkdown` para mantener consistencia con el resto del mini-historial.

## Acceptance criteria

- [ ] Cada item del mini-historial tiene un tercer botón `Cargar` con ícono y label.
- [ ] Click `Cargar` reemplaza el `active result` con el snapshot de la sesión guardada.
- [ ] El `id` se preserva: un `Guardar` posterior hace `updateSession`, no `addSession` (verificable en DevTools → Application → Local Storage).
- [ ] El form de generación se hidrata con los `input` de la sesión cargada (los 5 campos: `durationMinutes`, `strengthSkill`, `wodFormat`, `focusMovement`, `considerations`).
- [ ] El toast `"Sesión cargada — listo para regenerar o editar"` aparece tras el load.
- [ ] El indicador `SIN GUARDAR` del status strip NO aparece tras el load (porque `persisted === true`).
- [ ] `Copiar` y `Exportar` en el mismo item siguen funcionando idéntico (verificar tras el refactor de 0020).
- [ ] Click `Regenerar` en el strip tras un load usa los parámetros recién cargados, no los del form anterior.
- [ ] El botón `Editar` tras un load entra en edit mode con el `markdown` de la sesión guardada.
- [ ] Si el item del mini-historial es la sesión actualmente activa, el botón `Cargar` sigue funcionando (es idempotente).

## Manual end-to-end test

### Setup

- `npm run dev` y abrir `http://localhost:3000/classes`.
- DevTools → Application → Local Storage → delete `pd:sessions` (clean slate).

### Steps

1. **Generar y guardar sesión A.**
   - En `/generate/crossfit`, completar `Strength / Skill = "Back Squat 5x5"`, `WOD Format = AMRAP`, `Foco = "Pull-ups"`. Generar.
   - Click `Guardar`. Toast "Sesión guardada". Aparece en el mini-historial.

2. **Generar sesión B distinta (no guardar).**
   - Cambiar `Strength / Skill = "Snatch technique"`, `WOD Format = EMOM`. Generar.
   - Esperá el resultado. NO guardes. Aparece `SIN GUARDAR` en el strip.

3. **Cargar sesión A desde el mini-historial.**
   - En el item del mini-historial que representa sesión A, click `Cargar`.
   - Expect:
     - Toast "Sesión cargada — listo para regenerar o editar".
     - La card de resultado ahora muestra la sesión A (su título, sus 4 fases).
     - El form se pobló con los inputs de A: `Strength / Skill = "Back Squat 5x5"`, `WOD Format = AMRAP`, `Foco = "Pull-ups"`.
     - El indicador `SIN GUARDAR` desapareció del strip.

4. **Regenerar tras load con un tweak.**
   - En el form, cambiá `Foco = "Double Unders"`. Click `Regenerar` en el strip.
   - Expect: nuevo resultado llega con los parámetros de A + el tweak (DUs en foco, EMOM mantenido, etc.).
   - El `id` del active result sigue siendo el de sesión A.

5. **Guardar tras regenerar.**
   - Click `Guardar`.
   - Expect: hace `updateSession` sobre sesión A (mismo `id` en storage). El mini-historial muestra la versión actualizada.

6. **Copiar y Exportar siguen funcionando.**
   - En el mismo item del mini-historial (sesión A actualizada), click `Copiar`. Toast. Click `Exportar`. Descarga.
   - Expect: ambos funcionan idéntico al pre-load.

7. **Editar tras load.**
   - Click `Editar` en el footer de la card.
   - Expect: el editor muestra el `markdown` de la sesión A cargada. Editar + `Guardar` persiste los cambios.
