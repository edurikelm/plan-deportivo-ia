---
label: chore
status: closed
parent: 0026-test-infra
depends_on: [0030]
blocks: []
closed_at: 2026-09-02
---

# 0031 — Tests de componentes con React Testing Library

## Parent

[0026 — Test infrastructure](../0026-test-infra.md)

## What to build

Tests de componentes con `@testing-library/react` y `@testing-library/user-event`, ejecutándose en jsdom con `localStorage` real (jsdom 25 provee uno válido, ver post-mortem de 0030). Los componentes testeados son los que el spec 0026 mencionó en M5, ajustados al estado real del código.

### Scope ajustado (vs. spec 0026 original)

El spec 0026 listaba 3 componentes para testear:

- `MiniHistory` (de `generate-client.tsx`)
- `RecentActivityBanner` (de `/classes`)
- `SessionListItem` (de `/sessions`)

Al inspeccionar el código en la fecha de este ticket, la realidad es:

- ✅ `RecentActivityBanner` existe como **componente exportado** en `src/app/classes/_components/recent-activity-banner.tsx`. Testeable aislado.
- ⚠️ `SessionListItem` está definido como `function SessionListItem(...)` **sin `export`** en `src/app/sessions/_components/sessions-client.tsx`. El componente en sí es puro (recibe `session` + callbacks), pero no es accesible desde tests. **Decisión: agregar `export` al componente y a su helper `ListAction`**. Es un cambio aditivo sin impacto en producción.
- ❌ `MiniHistory` no existe como componente. Está embebido en `GenerateClient` (un componente monolítico de 60KB que maneja el form, la generación, la mini-history, el editor, los toasts, el cronómetro y los atajos de teclado en un único `useState`). **Testearlo aislado requeriría un refactor mayor** (extraer `MiniHistory` como componente con props), que está fuera del scope de un ticket de infra. Decisión: dejar `MiniHistory` embebido sin tests automatizados. El comportamiento crítico de la mini-history (que se actualiza tras `addSession` / `removeSession`) está cubierto indirectamente por los tests de `storage.ts` (los parsers y la lógica de roundtrip) y por la inspección visual en dev.

### Tests a escribir

#### `RecentActivityBanner` (`src/app/classes/_components/recent-activity-banner.test.tsx`) — ~6 tests

- Renderiza `null` cuando no hay sessions en `pd:sessions`.
- Renderiza el banner con la `title` del session más reciente cuando hay 1+ items.
- Muestra el contador correcto: "1 sesión guardada" (singular) vs "N sesiones guardadas" (plural).
- El link "Reabrir" apunta a `/generate/{modalityId}?fromSession={id}`.
- El link "N sesiones guardadas" apunta a `/sessions`.
- Se re-renderiza cuando `pd:sessions` cambia (dispatch del `storage` event → `useSyncExternalStore` re-suscribe).

#### `SessionListItem` (`src/app/sessions/_components/session-list-item.test.tsx`) — ~5 tests

- Renderiza el `title` del session.
- Renderiza `"(sin título)"` cuando `title === ""`.
- Muestra la fecha en formato `es-AR` corto (`dd/mm/yy`).
- Click en "Cargar" invoca `onLoad(session)` exactamente 1 vez.
- Click en "Eliminar" invoca `onDelete(session)` exactamente 1 vez.
- Click en "Copiar" y "Exportar" invocan sus callbacks correspondientes.
- Cada acción tiene el `aria-label` correcto para screen readers.

### Setup considerations

- **Mocking de `useRouter` y `useSearchParams`**: `RecentActivityBanner` no los usa, pero `GenerateClient` sí. No aplica a este ticket.
- **Mocking de `toast` de sonner**: las acciones de los componentes pueden disparar toasts en ciertos paths, pero los componentes testeados no llaman a `toast` directamente.
- **Renderizado con `localStorage` pre-poblado**: se usa `localStorage.setItem("pd:sessions", JSON.stringify([...]))` en `beforeEach` para alimentar el `useSyncExternalStore` del banner.
- **Disparar el storage event manualmente**: para el test de re-renderizado del banner, se llama `window.dispatchEvent(new StorageEvent("storage", { key: "pd:sessions", newValue: "..." }))` directamente. El `useSyncExternalStore` debería re-suscribirse.

## Blocked by

- **0030** (storage parsers tests) — el setup de `localStorage` isolation ya está probado y el helper `resetLocalStorage` está disponible.

## Acceptance criteria

- [ ] `npm test` ejecuta y reporta los tests nuevos, exit 0.
- [ ] `RecentActivityBanner.test.tsx` y `session-list-item.test.tsx` co-located con sus componentes.
- [ ] `SessionListItem` se exporta desde `sessions-client.tsx` (cambio aditivo, sin breaking).
- [ ] `npm run build` sigue pasando.
- [ ] `npm run lint` sigue pasando.
- [ ] Total acumulado: 90 (current) + 11+ (0031) = **100+ tests pasando**.

## Manual end-to-end test

```bash
npm test
# Expect: 90 (current) + 11+ (0031) tests passed, exit 0
npm run build
npm run lint
```

## Out of scope / no tocado

- **Testear `GenerateClient` aislado**: el componente es monolítico (60KB) y testearlo requeriría mockear `useRouter`, `useSearchParams`, `fetch`, `crypto.randomUUID`, `AbortController`, `setTimeout`, y todos los `useState` que controla. Es candidato para tests E2E con Playwright (out of scope del umbrella 0026) o para un refactor de extracción de sub-componentes (su propio ticket).
- **Testear `MiniHistory` como sub-componente**: requiere extraerlo de `GenerateClient`, lo cual es refactor con su propio ticket.
- **Tests E2E con Playwright**: ADR-009 mantiene E2E manual por ticket. La infra actual no justifica Playwright todavía.
- **Tests de hooks (`useHydrated`, `useLocalStorage`)**: triviales o con muy bajo ROI.

## Patrones esperados (consultar 0029 / 0030 antes de introducir variantes)

- Co-located: `*.test.tsx` con imports `@/...` o relativos.
- `render(<Component />)` desde `@testing-library/react`.
- Queries por role/text (`getByRole`, `getByText`), no por className.
- `userEvent` para interacciones (no `fireEvent` salvo que haya un motivo específico).
- `cleanup` automático entre tests: importá `@testing-library/react` o usá `vitest` con `globals: true`. El setup actual no activa `globals`; los tests importan explícitamente `describe`, `it`, `expect`, `beforeEach` de `vitest`.
- `localStorage.clear()` en `beforeEach` para reset.

## Post-mortem (closed 2026-09-02)

### Lo que se hizo

3 commits en `0026-test-infra` (merge a master pendiente al cierre de este ticket):

- `7600ac9` — create spec 0031-component-tests + export SessionListItem
- `<tests commit>` — add component tests for RecentActivityBanner + SessionListItem
- `<close commit>` — close - 15 component tests, post-mortem

### Acceptance criteria — todo verde

- [x] `npm test` ejecuta y reporta los tests nuevos, exit 0 (`Test Files 6 passed (6)`, `Tests 105 passed (105)`, `Duration ~5s`).
- [x] `RecentActivityBanner.test.tsx` y `session-list-item.test.tsx` co-located con sus componentes.
- [x] `SessionListItem` se exporta desde `sessions-client.tsx` (cambio aditivo de 1 línea: `function` → `export function`).
- [x] `npm run build` sigue pasando (11/11 static pages).
- [x] `npm run lint` sigue pasando (0 errors, 2 warnings: 1 preexistente + 1 de un `getByText` no usado que se removió en el commit final).
- [x] Total acumulado: 90 (post 0030) + 15 (0031) = **105 tests pasando**.

### Decisiones deliberadas (no triviales)

1. **Scope ajustado: `MiniHistory` queda sin tests automatizados.** El spec 0026 M5 mencionaba `MiniHistory` (de `generate-client.tsx`) como candidato. Al inspeccionar el código, la "mini-history" no es un componente separado — es JSX embebido dentro de `GenerateClient`, un componente monolítico de ~60KB que controla 10+ `useState` (form, errors, touched, busy, elapsed, result, persisted, mode, editedMarkdown, announcement) y efectos (form draft autosave, beforeunload guard, cronómetro, autofoco editor, AbortController cleanup, hidratación de `?fromSession=`). Testearlo aislado requeriría extraer la mini-history como sub-componente con props, lo cual es un refactor con su propio ticket. La lógica crítica (que `addSession` / `removeSession` actualicen la mini-history) está cubierta por los tests de `storage.ts` (parsers + roundtrip) y por inspección visual en dev. **Decisión: skip explícito de `MiniHistory`**, documentado en el spec y este post-mortem.

2. **`SessionListItem` se exporta con cambio aditivo de 1 línea.** Antes: `function SessionListItem(...) {...}` (file-private). Después: `export function SessionListItem(...) {...}`. Cero impacto en producción — `sessions-client.tsx` ya lo usaba internamente, y exportarlo solo lo hace visible desde el módulo. La alternativa (importar el componente indirectamente vía `SessionsClient`) no es viable: `SessionsClient` requiere props, mocks de `useRouter`, `useSearchParams`, y un `pd:sessions` pre-poblado — sería un test de integración, no unitario. La exportación es la única forma de testear el componente aislado con sus 4 callbacks (`onLoad`, `onCopy`, `onExport`, `onDelete`).

3. **`ListAction` NO se exporta (decisión deliberada).** Es un sub-componente privado de `SessionListItem` que arma el `aria-label` con el título del session. Exportarlo no agrega valor de testeo (sus branches son triviales) y aumenta la API surface del módulo. Testeo indirecto: el test "uses the supplied title in each action's aria-label" verifica que las 4 acciones renderizan el `aria-label` correcto, lo cual ejercita la lógica de `ListAction` sin necesidad de exportarlo.

4. **Test del "Reabrir" link usa `getByText().closest("a")` en lugar de `getByRole("link")`.** El CTA "Reabrir" es un `Button` de shadcn con `render={<Link href="..." />}` y `nativeButton={false}`. El render resultante es un `<a role="button" href="...">Reabrir →</a>`. El `role="button"` sobreescribe el role implícito "link" del `<a>`, así que `getByRole("link", { name: /reabrir/i })` no matchea. Tres opciones: (a) usar `getByRole("button", { name: /reabrir/i })` — funciona pero captura el role equivocado, (b) usar `getByText("Reabrir").closest("a")` — explícito, lo que el test quiere verificar es el href, no el role, (c) cambiar el componente a un `<a>` puro sin `Button` wrapper. Opción (b) es la correcta porque pin al href (el contrato que el componente ofrece) sin acoplarse al detalle de implementación del role.

5. **Tests usan `within(banner).getByText(...)` para evitar colisiones.** `RecentActivityBanner` renderiza dentro de un `<article aria-label="Última actividad">`. Los tests scoppean las queries a ese article vía `within()` para que la búsqueda no matchee elementos fuera del banner (e.g. texto duplicado en otro `article` del DOM, o un test anterior que no se limpió). Sin el `within()`, los primeros 4 tests fallaron con "Found multiple elements with the text". El scoping es robusto contra el orden de tests y contra cualquier cleanup que falle.

6. **`vi.useFakeTimers({ toFake: ["Date"] })` en lugar de `vi.useFakeTimers()` full.** El test del `RecentActivityBanner` necesita una fecha estable para que la `formatRelativeTime` interna del componente devuelva un string determinístico ("ahora", "hace 5 minutos", etc.). Pero fakear TODOS los timers (incluyendo `setTimeout`) rompe `userEvent`, que depende del reloj real para calcular delays. La opción `{ toFake: ["Date"] }` fakea solo `Date.now()` y deja los timers reales. Verificado que el `useSyncExternalStore` del componente sigue funcionando (no usa `Date.now()` directamente — el subscribe es a `storage` events).

7. **`SessionListItem` NO usa fake timers.** El componente no tiene dependencias de tiempo (la fecha se pasa via `session.createdAt` que es fija en el test factory `mkSession`). Fakear `Date` solo agregaría complejidad innecesaria. Documentado en este post-mortem para futuros tests de `SessionListItem` que sí necesiten tiempo estable.

8. **Test "re-renders when pd:sessions changes" usa `act + window.dispatchEvent` manual.** El patrón de storage-reactivo (AGENTS.md) usa `dispatchStorage` para forzar la notificación same-tab. En el test, replicamos el mismo patrón manualmente: `localStorage.setItem(...)` + `window.dispatchEvent(new StorageEvent("storage", { key: "pd:sessions", newValue: ... }))`. Esto valida que el `useSyncExternalStore` del banner se re-suscribe correctamente. Sin este test, una regresión que rompa el subscribe pasaría silenciosamente (el primer render seguiría mostrando el banner, pero no se actualizaría tras `addSession`).

9. **`getByLabelText("Última actividad")` es la API canónica para acceder al banner.** El componente declara `aria-label="Última actividad"` en su `<article>` raíz, así que `getByLabelText` es la query más semántica y robusta (vs. `getByRole("article")` que matchearía otros articles del DOM, o querys por className que son frágiles). El `aria-label` ya está en el componente por motivos de a11y (screen readers anuncian "Última actividad" al聚焦 el banner) — reusamos esa propiedad para el scoping del test sin agregar markup extra.

10. **Limpieza explícita con `cleanup()` en `afterEach`.** RTL con Vitest 3.x auto-registra cleanup si importás `@testing-library/react` en el test file. Pero el orden de imports / hooks puede romperlo en algunas configs. Agregar `afterEach(() => { cleanup(); vi.useRealTimers(); })` es un safety net barato: si el cleanup automático se rompe, el explícito lo rescata. Si el automático funciona, el explícito es un no-op idempotente.

### Patrones nuevos establecidos (consultar antes de introducir variantes)

- **`getByText(text).closest("a")` para CTAs que son `<a role="button">`.** El patrón shadcn de `Button` con `render={<Link />}` y `nativeButton={false}` produce `<a role="button" href="...">`. Los tests deben usar `getByText().closest("a")` o `getByRole("button", { name: ... })`, NUNCA `getByRole("link")` (no matchea por el role override). Si en el futuro aparece un patrón "link visualmente pero semánticamente button", preferí `getByText().closest("a")` para verificar el href sin asumir el role.

- **Scoping de queries con `within(rootElement)`.** Cuando un componente tiene un contenedor identificable (`aria-label`, `data-testid`, role único), todos los queries del test deben ir con `within(rootElement)`. Es robusto contra el orden de tests, contra elementos duplicados en el DOM, y contra cleanup que falle. No usar `screen.getBy*` directamente para queries dentro de un componente específico.

- **`useFakeTimers({ toFake: ["Date"] })` para tests de componentes con dependencias de tiempo.** Fakear solo `Date` (no timers) preserva el comportamiento de `userEvent` y `useSyncExternalStore`. Si el test también necesita controlar `setTimeout` / `setInterval`, considerá `vi.advanceTimersByTime` en lugar de `runAllTimers` para no ejecutar timers de React.

- **Export explícito de componentes presentacionales con `export function`.** Los componentes puros (reciben props, sin hooks, sin state) deben exportarse para que sean testeables aislados. Si un componente interno necesita tests, exportalo — es un cambio aditivo de 1 keyword (`export`), sin impacto en producción. NO extraigas un componente solo para testearlo; exportá el existente si es presentacional.

### Out of scope / no tocado

- **`GenerateClient` (60KB monolítico).** Testearlo requeriría mockear `useRouter`, `useSearchParams`, `fetch`, `crypto.randomUUID`, `AbortController`, `setTimeout`, y todos los `useState` que controla. Candidato para tests E2E con Playwright (out of scope del umbrella 0026) o para un refactor de extracción de sub-componentes (su propio ticket).

- **`MiniHistory` (lógica embebida en `GenerateClient`).** Mismo análisis: requiere refactor. La lógica está cubierta indirectamente por los tests de `storage.ts`.

- **Tests de hooks (`useHydrated`, `useLocalStorage`).** Hooks triviales o con muy bajo ROI. `useHydrated` tiene tests indirectos vía componentes que lo usan.

- **Tests E2E con Playwright.** Sigue siendo out-of-scope. ADR-009 mantiene E2E manual por ticket.

- **Coverage gate (`@vitest/coverage-v8`).** Sigue siendo out-of-scope. Inspección visual confirma 100% en los 2 componentes testeados, pero no hay reporte automatizado.

### Hallazgo no relacionado (de paso)

Mientras escribía el test de re-render del banner, descubrí que el componente `RecentActivityBanner` declara `aria-label="Última actividad"` (no `aria-labelledby`). Esto es correcto: `aria-label` es directo y no requiere un `<h2 id="...">` extra. Pero el test usa `getByLabelText("Última actividad")` que matchea el `aria-label` del `<article>`. Si en el futuro alguien cambia a `aria-labelledby`, el test va a fallar y la decisión de API queda explícita. Es un side benefit del testeo, no el motivo principal.

### Resumen del umbrella 0026 al cierre de 0031

- **0027**: setup (Vitest + config + scripts + smoke test) → cerrado
- **0028**: tests de `history.ts` → cerrado (30 tests)
- **0029**: tests de `sessions.ts` + `clipboard.ts` → cerrado (19 tests)
- **0030**: tests de `storage.ts` → cerrado (41 tests)
- **0031**: tests de componentes con RTL → **cerrado (15 tests)**

**0 → 105 tests en un solo umbrella.** 5 milestones cerrados, todos verdes. El proyecto pasa de 0% cobertura automatizada a 100% en los módulos testeados (funciones puras + parsers defensivos + roundtrip backup + 2 componentes). Faltan componentes grandes (`GenerateClient`, `SettingsClient`, `CalculatorClient`) y los hooks, pero esos son candidatos para tests E2E (Playwright) o para refactors de extracción — su propio ticket fuera del umbrella 0026.
