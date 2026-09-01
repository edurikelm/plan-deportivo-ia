---
label: feature
status: open
parent: 0018-ui-ux-polish
depends_on: []
blocks: []
---

# 0023 — Input persistence + /classes activity banner

## Parent

[0018 — UI/UX polish: guards, history completeness, design tokens](../0018-ui-ux-polish.md)

## What to build

Dos features que reducen la fricción de "planificar recurrentemente". Una del lado del form (recordar input), otra del lado de la home (mostrar actividad reciente).

1. **Persistencia del input de generación en `pd:last-input-{modalityId}`.**
   - Nueva key por modalidad. JSON con shape `CrossFitSessionInput` (mismo tipo que `SavedSession.input`).
   - Write con debounce 500ms en cada `onChange` de los 5 campos del form (`durationMinutes`, `strengthSkill`, `wodFormat`, `focusMovement`, `considerations`).
   - Read en `useEffect` de mount del `GenerateClient`. Si hay valor persistido, hidrata el state del form.
   - El active result efímero no se ve afectado — solo el form.
   - Sin impacto en `pd:sessions` (esa key sigue siendo solo para sesiones guardadas).
   - Patrón: `useSyncExternalStore` para subscribe, helper `setLastInput(modalityId, input)` y `getLastInput(modalityId)` en `src/lib/storage.ts`. `isQuotaError` en write.

2. **Mini-status "actividad reciente" en `/classes`.**
   - Nuevo client component `<RecentActivityBanner>` insertado arriba de la lista de modalidades en `classes/page.tsx` (entre el intro y el `<ul>` de `MODALITIES`).
   - Lee `pd:sessions` con `useSyncExternalStore`. Si está vacío, retorna `null` (no empty state — el catálogo de modalidades ya existe).
   - Si hay sesiones, renderiza un `<article class="chalk-card">` con:
     - Label `Última actividad` en `font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute`.
     - Title de la sesión más reciente en `font-display italic font-semibold text-base text-bone truncate`.
     - Meta line: `createdAt` formateado (e.g. "hace 2 días" vía `Intl.RelativeTimeFormat` con `es` locale) + `duration` + `model` en mono tabular.
     - Botón primary `Reabrir` que linkea a `/generate/{modalityId}?fromSession={id}` (mismo patrón que 0022).
     - Counter secondary: `N sesiones guardadas` en mute, link a `/sessions`.

3. **Read latest session sin re-render del catálogo**: el banner es client component, aislado. La `classes/page.tsx` sigue siendo server shell.

Patrones: `useSyncExternalStore` + `dispatchStorage` (per `AGENTS.md:91`). Storage keys con namespace `pd:*`. `crypto.randomUUID()` para IDs (no aplica acá, son lecturas). Sin cambios al modelo de datos.

## Blocked by

None — can start immediately. (El `?fromSession` redirect de 0022 también aplica acá; si 0023 se implementa antes que 0022, el query param se ignora silenciosamente hasta que 0022 esté listo. Es comportamiento aceptable.)

## Acceptance criteria

- [ ] `pd:last-input-{modalityId}` se persiste con debounce 500ms tras cada cambio en el form.
- [ ] Al mount de `GenerateClient`, el form se hidrata desde `pd:last-input-{modalityId}` si existe.
- [ ] El input `focusMovement` vacío se persiste como `undefined` (no string vacío).
- [ ] El input `considerations` vacío se persiste como `undefined` (no string vacío).
- [ ] La persistencia es per-modality: el form de `crossfit` no contamina el de futuras modalidades.
- [ ] El active result efímero no se ve afectado por la persistencia del input.
- [ ] El `<RecentActivityBanner>` aparece en `/classes` solo si `pd:sessions` tiene ≥ 1 entry.
- [ ] El banner muestra: label, title de la última sesión, meta con `createdAt` relativo, botón `Reabrir`, counter total.
- [ ] El botón `Reabrir` linkea a `/generate/{modalityId}?fromSession={id}`.
- [ ] El counter `N sesiones guardadas` linkea a `/sessions`.
- [ ] Si no hay sesiones, el banner no se renderiza (cero impacto visual).
- [ ] Cross-tab sync: cambios en `pd:sessions` desde otra tab refrescan el banner sin reload.
- [ ] `npm run build` y `npm run lint` pasan.

## Manual end-to-end test

### Setup

- `npm run dev` y abrir `http://localhost:3000/classes`.
- DevTools → Application → Local Storage → delete `pd:sessions`, `pd:last-input-crossfit` (clean slate).

### Steps

1. **Persistencia del input.**
   - En `/generate/crossfit`, completar `Strength / Skill = "Back Squat 5x5"`, `WOD Format = EMOM`, `Foco = "Pull-ups"`, `Consideraciones = "Nivel intermedio"`.
   - Esperar 600ms (debounce).
   - DevTools → Application → Local Storage → `pd:last-input-crossfit`.
   - Expect: el JSON contiene los 4 campos con los valores correctos.

2. **Hidratación al volver.**
   - Refrescar la página (o navegar a `/classes` y volver).
   - Expect: el form aparece con `Strength / Skill = "Back Squat 5x5"`, `WOD Format = EMOM`, etc. pre-poblados.

3. **Per-modalidad isolation.**
   - Solo hay `crossfit` por ahora, así que este test aplica cuando haya otra modalidad. Skipear por ahora y documentar en post-mortem.

4. **Empty inputs se persisten como undefined.**
   - Vaciar todos los campos. Esperar 600ms.
   - DevTools → `pd:last-input-crossfit`.
   - Expect: `focusMovement` y `considerations` son `undefined` o están omitidos, NO string vacío.

5. **Banner en /classes con sesiones.**
   - Generar y guardar 2 sesiones distintas.
   - Volver a `/classes`.
   - Expect: aparece el `<RecentActivityBanner>` arriba de la lista de modalidades, mostrando la sesión más reciente y `2 sesiones guardadas`.

6. **Banner Reabrir.**
   - Click `Reabrir` en el banner.
   - Expect: navega a `/generate/crossfit?fromSession={id}`. Si 0022 está implementado, el form se hidrata con la sesión; si no, el query param se ignora y el form queda con defaults.

7. **Banner sin sesiones.**
   - Limpiar `pd:sessions` desde DevTools. Refrescar `/classes`.
   - Expect: el banner no aparece. La página se ve como antes (solo el catálogo de modalidades + sección de herramientas).

8. **Cross-tab sync del banner.**
   - Abrir `/classes` en tab A. Abrir `/classes` en tab B.
   - En tab A, ir a `/generate/crossfit`, generar y guardar una sesión. Volver a `/classes`.
   - En tab B (sin refresh), el banner aparece automáticamente.

9. **Meta relative time.**
   - El banner muestra `createdAt` con formato relativo (e.g. "hace 2 minutos", "hace 3 días"). Verificar que el locale es `es` y que valores < 1 minuto muestran "ahora" o "hace menos de un minuto".
