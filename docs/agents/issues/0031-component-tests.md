---
label: chore
status: open
parent: 0026-test-infra
depends_on: [0030]
blocks: []
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
