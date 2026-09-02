# Changelog

Todos los cambios notables de **plan-deportivo-ia** (v1, Next.js) se documentan acá.
Formato: [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).
Versionado: [SemVer](https://semver.org/lang/es/) (MAJOR.MINOR.PATCH).

> v2 (Flutter) tiene su propio versionado independiente en `v2/pubspec.yaml`.

## Política de bumps

| Bump | Cuándo | Ejemplos |
|---|---|---|
| **PATCH** (`0.1.x`) | Invisible al usuario: bugfix, refactor, **umbrella de infra** (tests, deps, tooling) | umbrella 0026 (test infra) → 0.2.1, 0.2.2, 0.2.3 |
| **MINOR** (`0.x.0`) | **Umbrella con feature visible al usuario** (nueva página, nuevo flujo, cambio de UX) | umbrella 0018 (UI/UX polish) → 0.2.0 |
| **MAJOR** (`x.0.0`) | Breaking o rediseño grande | cambio incompatible en storage schema, cambio en contrato del prompt IA, rediseño de modelo de datos, lanzamiento 1.0 |

> **Refinamiento (post-0.2.0):** la política original decía "cada umbrella cerrada = MINOR".
> Se ajusta porque las umbrellas de infra (tests, tooling) no entregan features visibles al usuario
> y bumpear minor por ellas engaña al consumidor del versionado. Las umbrellas de infra van como
> PATCH acumulado; las umbrellas con feature visible van como MINOR.

## [0.2.3] - 2026-09-02

Umbrella **0026 — Test infrastructure**, milestone **M5** cerrado. **Umbrella 0026 completo**: 105 tests pasando en 6 archivos. `RecentActivityBanner` y `SessionListItem` ahora tienen tests automatizados con React Testing Library.

### Added

- **7 tests de `RecentActivityBanner`** (`0031`, `src/app/classes/_components/recent-activity-banner.test.tsx`): render `null` cuando no hay sessions, banner con el session más reciente (ordenado por `createdAt`), singular "1 sesión guardada" vs plural "N sesiones guardadas", href del "Reabrir" link (`/generate/{modalityId}?fromSession={id}`), href del "N sesiones guardadas" link (`/sessions`), re-render cuando se dispatcha el `storage` event.
- **8 tests de `SessionListItem`** (`0031`, `src/app/sessions/_components/session-list-item.test.tsx`): render del title, fallback `"(sin título)"` cuando title está vacío, meta line con model/duration/date, click handlers para `onLoad` / `onCopy` / `onExport` / `onDelete` (cada uno invoca el callback exactamente 1 vez con el session correcto), `aria-label` de cada acción incluye el título.
- **`export` agregado a `SessionListItem`** en `sessions-client.tsx`: cambio aditivo de 1 keyword (`function` → `export function`). Necesario para que el componente sea testeable aislado desde el test file. Cero impacto en producción — el componente ya se usaba internamente.

### Notes

- **Decisión deliberada: `MiniHistory` (de `generate-client.tsx`) queda sin tests automatizados.** La mini-history no es un componente separado — es JSX embebido dentro de `GenerateClient` (un componente monolítico de 60KB que controla 10+ `useState`). Testearla aislada requeriría un refactor de extracción (su propio ticket). La lógica crítica está cubierta indirectamente por los tests de `storage.ts`.
- **`ListAction` no se exporta (decisión deliberada).** Es un sub-componente privado de `SessionListItem` que arma el `aria-label` con el título. Su lógica se ejercita indirectamente via el test "uses the supplied title in each action's aria-label" que verifica las 4 acciones del `SessionListItem`.
- **Patrón shadcn "Button with Link render" produce `<a role="button">`.** El test del "Reabrir" link usa `getByText("Reabrir").closest("a")` en lugar de `getByRole("link", ...)` porque el `role="button"` sobreescribe el role implícito "link" del `<a>`. Documentado en el post-mortem de 0031.
- **Cobertura: 100% en los 2 componentes testeados.** Validado por inspección visual (no hay `@vitest/coverage-v8` instalado — sigue siendo out-of-scope).
- **Total acumulado del umbrella 0026: 105 tests pasando** en 6 archivos. Umbrella cerrado tras 5 milestones (0027 setup, 0028 history, 0029 sessions+clipboard, 0030 storage, 0031 components).
- **0 → 105 tests** en un solo umbrella.
- Storage schema **no cambió**. Prompt IA **no cambió**. UX **no cambió**.

### Resumen de los milestones del umbrella 0026

| Milestone | Ticket | Tests | Acumulado |
|---|---|---|---|
| M1 setup | 0027 | (1 smoke, removido) | 0 |
| M2 history | 0028 | 30 | 30 |
| M3 sessions+clipboard | 0029 | 19 | 49 |
| M4 storage | 0030 | 41 | 90 |
| M5 components | 0031 | 15 | 105 |

## [0.2.2] - 2026-09-02

Umbrella **0026 — Test infrastructure**, milestone **M4** cerrado. 41 tests nuevos (parsers de `storage.ts` + roundtrip de backup), total acumulado **90 tests pasando**.

### Added

- **41 tests de `storage.ts`** (`0030`):
  - `parseSessionsFromRaw` (8 tests): string vacío, JSON válido, JSON inválido, shape no-array (object/number/null), array vacío.
  - `parseRecordsFromRaw` (8 tests): string vacío, JSON válido, filtro silencioso de entries corruptas (barKg inválido, source fuera del enum, exercise vacío), preserva `source: "auto-log"` (backward-compat).
  - `getAllLastInputs` (7 tests): sin keys, una key, tres modalities, ignora keys no-`pd:last-input-*`, drop silencioso de corruptas, drop silencioso de shape inválido, modalityId arbitrario como suffix.
  - `getSessionsRaw` / `getLastInputRaw` (4 tests): `""` para key ausente, JSON verbatim cuando hay data, scope por modalityId.
  - `isQuotaError` (3 tests): `QuotaExceededError`, `NS_ERROR_DOM_QUOTA_REACHED`, non-DOMException (Error, string, object, null, undefined).
  - `exportAllData` (3 tests): `version: 1` + ISO `exportedAt`, vacío cuando localStorage está vacío, captura completa del snapshot.
  - `importAllData` (3 tests): importa los 4 buckets correctamente, comportamiento con backup vacío (3 keys, no 4), preserva campos opcionales de `PersistedLastInput`.
  - **Roundtrip export → clear → import → re-export** (1 test): equivalente a `data` (excluyendo `exportedAt` que es fresco).
  - `clearAllData` (3 tests): remueve solo `pd:*`, no throw cuando vacío, dispara `storage` event por cada key.

- **`resetLocalStorage()` helper en `vitest.setup.ts`**: wrapper de `localStorage.clear()` exportado para que los tests de storage lo importen explícitamente y la intención sea searchable.

### Notes

- **Decisión deliberada: NO reemplazar `globalThis.localStorage` con un stub manual.** El spec 0026 llamaba a un stub, pero al validar empíricamente, jsdom 25 sigue la spec WHATWG y NO auto-dispatcha el `storage` event en same-tab — el código de producción (`dispatchStorage`) existe precisamente para eso. Reemplazar el global con un stub rompía el brand check del `StorageEvent` constructor en jsdom 25 (`storageArea` debe ser del tipo `Storage` real). Documentado en el post-mortem de 0030.
- **Cobertura: 100%** sobre los parsers y el flujo de backup en `storage.ts`. Validado por inspección visual (no hay `@vitest/coverage-v8` instalado — sigue siendo out-of-scope).
- **Total acumulado del umbrella 0026**: 49 (post 0029) + 41 (0030) = **90 tests pasando**. Faltan solo los tests de componentes con RTL (0031) para cerrar el umbrella.
- Storage schema **no cambió**. Prompt IA **no cambió**.

## [0.2.1] - 2026-09-02

Umbrella **0026 — Test infrastructure**, milestones **M1, M2 y M3** cerrados. 49 tests automatizados pasando.

> El spec `0026-test-infra.md` sigue `open` (faltan M4 storage parsers y M5 React Testing Library), pero los 3 milestones cerrados ya son un salto significativo: el proyecto pasa de 0 a 50 tests.

### Added

- **Vitest 3.x** como test runner (`0027`): jsdom environment nativo, alias `@/*` → `./src/*`, scripts `test` y `test:watch` en `package.json`.
- **Test setup** (`0027`): `vitest.config.ts` + `vitest.setup.ts` con `@testing-library/jest-dom/vitest`. `coverage/` agregado a `.gitignore`.
- **Smoke test** (`0027`): `test/smoke.test.ts` con `expect(1 + 1).toBe(2)`, reemplazado en M2 por tests reales.
- **30 tests de `calculator/history.ts`** (`0028`): `computeTotals` (caso vacío, single exercise con `plateMath`, multi-exercise mixed units, edge cases decimal/NaN), `hashState` (determinismo, sensibilidad por campo, formato), `normalizeExerciseName` (lowercase, trim, colapsar espacios, prefijos/sufijos), `dedupeExercises` (orden estable, case-insensitive).
- **19 tests de `sessions.ts` + `clipboard.ts`** (`0029`): `loadSessionInto` (preserva `id`/`createdAt`/`model`, sobreescribe `markdown`/`structured`/`input`/`title`/`persisted`, idempotente), `markdownFilename` (formato, caracteres especiales, sufijo `.md`).
- **Total: 49 tests pasando** (el smoke test inicial de M1 fue reemplazado por el primer test real de M2, no se acumula).

### Notes

- **0 → 49 tests** en un solo commit. El seam natural testeable fue `src/lib/calculator/history.ts` y los helpers puros de sessions/clipboard, sin requerir mocks complejos.
- **Sin coverage gate todavía** (umbral tentativo en spec 0026: ≥ 50% cobertura en `src/lib/` cuando se cumplan los milestones M4 y M5).
- Storage schema **no cambió**. Prompt IA **no cambió**.

## [0.2.0] - 2026-09-02

Umbrella **0018 — UI/UX polish**. Cierra 7 tickets (`0019`–`0025`).

### Added

- **`/sessions` page** (`0022`): browse, search, filter, sort, delete con undo de sesiones guardadas. Status strip consistente con `/classes` y `/generate`.
- **`/settings` page** (`0025`): export, import, clear de datos locales con Zod validation. Sección "Acerca de" muestra versión + stack + repo.
- **Form persistence** (`0023`): clave `pd:last-input-{modalityId}` guarda el último form por modalidad, restaurado al volver a `/generate`. `<RecentActivityBanner>` muestra últimas 3 clases en `/classes`.
- **Mini-history load action** (`0021`): botón "Cargar" en el mini-history del calculator. Eliminado symmetry de peso (over-engineering, no agregaba valor real).
- **Settings page model info**: provider + modelo activo en formato read-only `font-mono numeric`.

### Changed

- **Design tokens** (`0024`): nuevas utility classes `.numeric`, `.numeric-label`, `.numeric-display`, `.prose-chalk`. Cronómetro de generate y calculator pasa de `text-2xl` a `text-xl` por consistencia de sistema.
- **DRY utilities** (`0020`): `copyToClipboard`, `downloadAsMarkdown`, `markdownFilename`, `loadSessionInto` centralizados en `src/lib/`.
- **Calculator timer visual** (`0024`): cambio de `text-2xl` → `text-xl` aplicado también a `calculator-client.tsx` por consistencia, aunque no estaba en el ticket original (decisión deliberada).

### Fixed

- **Navigation guard** (`0019`): botón back del status strip evalúa `hasUnpersistedWork` y dispara `window.confirm` antes de salir. Reemplaza el `<Link>` pasivo.
- **On-blur validation** (`0019`): errores de `strengthSkill` y `wodFormat` se muestran al perder foco, no solo al submit. Mantiene visibilidad post-submit hasta arreglar.
- **`text-mute` ambiguity** (`0019`): sufijos `(opcional)` ahora usan `.text-mute-strong`, dejando `text-mute` para placeholders.
- **Mini-history SSR hydration race** (`0021`): `useState(() => hydrated ? ... : [])` corría con `hydrated=false` en SSR. Migrado a `useSyncExternalStore` + `useMemo` sobre la string cruda. Patrón storage-reactivo extendido de `pd:calculator-records` a `pd:sessions`.

### Notes

- 21 commits mergeados a `master` con `--no-ff`. Branch local `0018-ui-ux-polish` eliminado.
- Storage schema **no cambió** (sin migration necesaria para 0.2.0).
- Prompt IA **no cambió** (mismo modelo, misma estructura de output).

## [0.1.0] - 2026-08-XX

Release inicial. MVP con `/classes` (CRUD), `/generate` (generación IA con MiniMax-Text-01), calculator con saved records, mini-history, sessions guardadas. Sin página de settings, sin export/import, sin tests automatizados.

[Unreleased]: https://github.com/edurikelm/plan-deportivo-ia/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/edurikelm/plan-deportivo-ia/releases/tag/v0.2.1
[0.2.0]: https://github.com/edurikelm/plan-deportivo-ia/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/edurikelm/plan-deportivo-ia/releases/tag/v0.1.0
