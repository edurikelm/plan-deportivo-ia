---
label: chore
status: closed
closed_at: 2026-09-04
parent: null
---

# 0026 — Test infrastructure

## Problem Statement

El proyecto tiene **0 tests automatizados**. El dominio es cada vez más crítico (cálculo de peso, persistencia de inputs, parsers de storage defensivos, export/import roundtrip) y la regresión silenciosa es un riesgo real. Hasta ahora la verificación ha sido manual end-to-end por ticket (precedent 0017, 0025), pero el costo cognitivo de mantener disciplina manual crece con cada módulo nuevo.

Tres factores hacen que el momento sea el correcto para invertir en infra:

1. **Funciones puras consolidadas** post-0012 y 0018: `src/lib/calculator/history.ts` (4 funciones puras), `src/lib/sessions.ts` (`loadSessionInto`), `src/lib/clipboard.ts` (`markdownFilename`), `src/lib/storage.ts` (parsers defensivos). Cada uno es un "seam" testeable sin DOM, sin mocks complejos, sin React.
2. **Roundtrip safety** (0025): `exportAllData` / `importAllData` / `clearAllData` introdujeron contrato de backup. Un test automatizado de roundtrip detecta regresiones del estilo "agregué un campo nuevo al `SavedSession` pero olvidé actualizar `BackupShape`".
3. **Lint de patrones implícitos**: muchos patrones (storage reactivo, per-field setters, `useRef` gate) son disciplinados por convención del `AGENTS.md`. Tests automatizados pueden codificar algunos de esos invariantes (e.g. "`loadSessionInto` preserva `id`") para que un refactor futuro no rompa el contrato silenciosamente.

## Solution

Un umbrella de **5 tickets verticales**, cada uno entregable de forma independiente, siguiendo el patrón de 0018. La pila tecnológica:

- **Vitest 3.x** como test runner (TS sin config, jsdom nativo, alineado con el ecosistema Next.js / Vite, ~10x más rápido que Jest).
- **`@testing-library/react` + `@testing-library/jest-dom` + `@testing-library/user-event`** para componentes (ticket 0031).
- **jsdom** como environment por default (permite que componentes React y helpers con `localStorage` se testeen sin levantar un browser real).
- **Sin coverage gate todavía** — se introduce cuando haya suficientes tests para que la métrica sea significativa (umbral tentativo: cuando el codebase tenga ≥ 50% cobertura en `src/lib/`).

### M1 — Setup de infra (0027)
- `vitest.config.ts` con jsdom environment, alias `@/*` → `./src/*`, exclude `node_modules`/`.next`/`.opencode`/`dist`/`.agents`.
- `vitest.setup.ts` con `import "@testing-library/jest-dom/vitest"`. Vacío por ahora; se extiende en 0030 con mocks de `localStorage` / `navigator.clipboard`.
- Scripts en `package.json`: `test` (single run, exit 0 con success), `test:watch` (watch mode para dev).
- `coverage/` agregado a `.gitignore`.
- **Smoke test** en `test/smoke.test.ts` con un único `expect(1 + 1).toBe(2)` que se reemplaza en 0028 con el primer test real de `computeTotals`.

### M2 — Tests de funciones puras de `calculator/history.ts` (0028)
- `computeTotals(state) → { totalKg, totalLb, breakdownLine }` — caso vacío, single exercise con `plateMath`, multi-exercise mixed units, edge cases (decimal truncation, NaN guard).
- `hashState(state) → string` — determinismo, sensibilidad a cada campo, formato esperado.
- `normalizeExerciseName(s) → string` — lowercase, trim, colapsar espacios, prefijos/sufijos comunes.
- `dedupeExercises(records) → string[]` — orden estable, case-insensitive dedup, preserva el primero.

### M3 — Tests de helpers de sesiones y clipboard (0029)
- `loadSessionInto(current, source) → SavedSession` — preserva `id`/`createdAt`/`model`, sobreescribe `markdown`/`structured`/`input`/`title`/`persisted`, idempotente.
- `markdownFilename(modalityLabel, date) → string` — formato consistente, caracteres especiales normalizados, sufijo `.md`.

### M4 — Tests de parsers de storage (0030)
- `parseSessionsFromRaw(raw) → SavedSession[]` — JSON válido, JSON inválido, JSON con shape viejo, array vacío, filtro silencioso de entries corruptas.
- `parseRecordsFromRaw(raw) → SavedWeightRecord[]` — análogo.
- `getAllLastInputs() → Record<modalityId, PersistedLastInput>` — con `localStorage` mockeado.
- Mocks de `localStorage` (manual) en `vitest.setup.ts` (sin `happy-dom`, evita dep extra).

### M5 — Tests de componentes con React Testing Library (0031)
- `MiniHistory` (de `generate-client.tsx`) — render con `pd:sessions` vacío (empty state), render con 3 items (3 cards + "Cargar" funciona).
- `RecentActivityBanner` (de `/classes`) — render con `pd:sessions` vacío (no renderiza), render con 1+ items (muestra el más reciente + contador).
- `SessionListItem` (de `/sessions`) — click en `Cargar` invoca `loadSessionInto`, click en `Eliminar` abre `window.confirm`.

## User Stories

1. As a maintainer, I want a `npm test` command that exits 0 on success, so that I can add it to CI later.
2. As a maintainer, I want Vitest configured with the project's path alias (`@/*`), so that tests can import from `@/lib/...` without rewrites.
3. As a maintainer, I want the test infra to use jsdom, so that helpers that touch `localStorage` and `navigator` can be tested without manual mocks from day 0.
4. As a maintainer, I want `computeTotals`, `hashState`, `normalizeExerciseName`, `dedupeExercises` to have unit tests with 100% coverage, so that regressions in the core calculation domain are caught.
5. As a maintainer, I want `loadSessionInto` to have a test that proves it preserves `id`/`createdAt`/`model`, so that the "Cargar" flow keeps being idempotent.
6. As a maintainer, I want `exportAllData` / `importAllData` / `clearAllData` to have a roundtrip test, so that backup format regressions are caught.
7. As a maintainer, I want `parseSessionsFromRaw` / `parseRecordsFromRaw` to have tests for valid JSON, invalid JSON, and old-shape JSON, so that the defensive parsers don't accidentally throw on weird data.

## Implementation Decisions

### M1 — Setup
- Vitest version: latest stable (3.x al momento de 0027).
- El alias `@/*` se resuelve manualmente en `vitest.config.ts` con `resolve.alias`. No uso `vite-tsconfig-paths` porque son 4 líneas y evita una dep extra.
- El smoke test vive en `test/smoke.test.ts` (carpeta `test/` nueva, no en `src/`). Se reemplaza por los tests reales de M2 en 0028 — Vitest re-descubre automáticamente por convención de nombre.

### M2 — Funciones puras
- Estructura: `src/lib/calculator/history.test.ts` (co-located con la impl). El alias de Vitest coincide con el de TS, así que los imports son `@/lib/calculator/history`.
- Convenciones: `describe("computeTotals", () => { it("handles empty state", ...) })`. Sin `it.each` salvo donde ahorre > 5 líneas.

### M3 — Sesiones y clipboard
- Co-located: `src/lib/sessions.test.ts` y `src/lib/clipboard.test.ts`.

### M4 — Storage parsers
- Co-located: `src/lib/storage.test.ts`.
- Mock manual de `localStorage` con `Object.defineProperty(globalThis, "localStorage", { value: stub })`. El stub implementa `getItem`, `setItem`, `removeItem`, `key`, `length`, `clear`.

### M5 — Componentes
- Tests en `src/**/_components/**/*.test.tsx` (co-located con cada componente).
- `render(<Component />)` desde `@testing-library/react`, queries por role/text.
- No se mockea `useRouter` ni `useSyncExternalStore` — se renderiza con `pd:*` pre-poblado en `localStorage`.

## Testing Decisions

- Cada child ticket es auto-contenido: sus tests + su impl (cuando hay cambio) están en el mismo commit o en commits consecutivos.
- El close de cada ticket requiere `npm test` exit 0 + `npm run build` exit 0 + `npm run lint` exit 0.
- El smoke test se **remueve** en M2 (0028) — su existencia tiene sentido solo entre el setup y el primer test real.

## Out of Scope

- **Coverage gate** (umbral mínimo de líneas/branch). Se introduce cuando haya ≥ 50% cobertura en `src/lib/`. Hoy es ruido sin datos.
- **E2E tests con Playwright**. El dev manual end-to-end por ticket (precedent 0017, 0025) sigue siendo el camino. Playwright agregaría una capa de infra pesada para una app single-user.
- **CI pipeline** (GitHub Actions). Fuera de scope de infra de tests; requiere decisiones de secrets y deployment. ADR futuro.
- **Mutation testing** (Stryker). Overkill para el tamaño del proyecto.
- **Visual regression tests** (Chromatic / Percy). El design system está en `DESIGN.md` y se valida con screenshots manuales.

## Further Notes

- **Orden sugerido** (sigue el patrón vertical-slice de 0018):
  1. `0027` — M1: setup
  2. `0028` — M2: tests de `history.ts` (puramente funciones, máximo ROI)
  3. `0029` — M3: tests de `sessions.ts` y `clipboard.ts`
  4. `0030` — M4: tests de `storage.ts` parsers
  5. `0031` — M5: tests de componentes
- **Riesgo principal**: Vitest en Next.js 16 + Turbopack. Vitest es independiente de Turbopack (Vite-based, no Next), así que no hay conflicto, pero si aparecen peer dep warnings en Windows, fixear con `npm install --legacy-peer-deps` o pinning.

## Post-mortem (closed 2026-09-04)

### Lo que realmente se entregó (8 children, no 5)

El spec original listaba 5 milestones (M1–M5 → 0027–0031). La entrega real creció a **8 children** porque tres cosas que el spec marcaba como "out of scope" terminaron siendo obvias durante la implementación:

- `0032` — coverage gate (umbral mínimo en CI)
- `0033` — raise coverage threshold una vez que el primer gate ya tenía datos
- `0034` — GitHub Actions CI workflow (lint + build + test:coverage)

Las tres eran trabajo que surgía de tener tests reales. La alternativa era dejar el umbrella "casi cerrado" hasta que apareciera demanda explícita; optamos por cerrarlo en una sola ola porque cada una costaba < 1 día y juntas completaban la promesa del spec ("`npm test` exit 0 en CI").

### Estado final (medido al cierre)

- **8/8 children cerrados** (0027 → 0034, ver `git log` y los 8 archivos `00{27..34}-*.md`).
- **262/262 tests verde** (de 0 al inicio del umbrella).
- **Coverage gate activo en CI**: `vitest run --coverage` falla el build si `src/lib/**` baja del threshold.
- **CI GitHub Actions institucionalizado** desde `530492e` (lint + build + test:coverage en cada push/PR).
- **Versión bumped a v0.2.6** en `8c436b3` para marcar el corte.

### Lecciones (lo que repetiría / lo que no)

**Repetiría:**

1. **Co-localizar tests con la impl** (`*.test.ts` al lado de `*.ts`). El alias `@/*` en `vitest.config.ts` lo hace indoloro, y cuando un dev abre un archivo ve su test al lado. Redujo el costo de mantener tests actualizados.
2. **Mocks manuales de `localStorage` con `Object.defineProperty`**, sin `happy-dom`. 15 líneas en `vitest.setup.ts` y cero deps extra. El primer PR con `happy-dom` habría agregado una dep y un risk surface sin ganancia.
3. **Smoke test `1 + 1 === 2`** en M1. Suena trivial, pero fue el "puede correr CI" definitivo y se reemplazó limpiamente en M2.

**No repetiría:**

1. **Marcar CI como "out of scope" en el spec original.** Es tentador diferirlo para no inflar el ticket, pero el costo real de GitHub Actions es ~1 hora y el costo de no tenerlo es la duda de "esto pasa en mi máquina pero ¿en CI?". Mejor CI desde el día 1.
2. **Coverage gate con threshold adivinando.** Empezamos con un número tentativo (50% en `src/lib/`) y lo subimos 2 veces (0033). La próxima umbrella equivalente debería empezar midiendo 1 semana sin gate, calcular el baseline real, y entonces setear el floor al baseline − 5%.
3. **Tests que solo verifican implementación interna** (e.g. "este useRef se llama con X"). El sweet spot que encontramos fue: tests de comportamiento en funciones puras + tests de render con `getByRole/text` en componentes. Los tests de "este mock se llamó" envejecen mal y rompieron en refactors.

### Patrones que dejó el umbrella (reutilizables)

- **Vertical-slice por módulo** (M2 → M3 → M4 → M5), no horizontal por tipo. Cada milestone entregaba una unidad testeable end-to-end, no "todos los tests de mocks juntos".
- **El close de cada child exige `npm test` + `npm run build` + `npm run lint` verde.** Se institucionalizó en la issue template de M1 en adelante. Sin esto, un test podría "verdear" pero romper el build silenciosamente.
- **Commits atómicos por child** (un commit por ticket, mensaje que cita el número del issue). `git log --grep` se volvió una herramienta de navegación real.

### Lo que NO se hizo (todavía no, no "out of scope para siempre")

- **Visual regression tests** (0041 lo dejó explícito): el gap actual entre tests verdes y "se ve bien en el browser" es real. Lo más probable es que esto se solucione con un smoke browser-side en la issue template, no con Chromatic.
- **Mutation testing** (Stryker): sigue siendo overkill. Si en 1 año el codebase crece 5x, revisar.
- **E2E con Playwright**: sigue sin aplicar (single-user, localStorage-backed).
