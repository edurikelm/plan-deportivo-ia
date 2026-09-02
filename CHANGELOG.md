# Changelog

Todos los cambios notables de **plan-deportivo-ia** (v1, Next.js) se documentan acá.
Formato: [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).
Versionado: [SemVer](https://semver.org/lang/es/) (MAJOR.MINOR.PATCH).

> v2 (Flutter) tiene su propio versionado independiente en `v2/pubspec.yaml`.

## Política de bumps

| Bump | Cuándo | Ejemplos |
|---|---|---|
| **PATCH** (`0.1.x`) | Invisible al usuario: bugfix, refactor, **umbrella de infra** (tests, deps, tooling) | umbrella 0026 (test infra) → 0.2.1 |
| **MINOR** (`0.x.0`) | **Umbrella con feature visible al usuario** (nueva página, nuevo flujo, cambio de UX) | umbrella 0018 (UI/UX polish) → 0.2.0 |
| **MAJOR** (`x.0.0`) | Breaking o rediseño grande | cambio incompatible en storage schema, cambio en contrato del prompt IA, rediseño de modelo de datos, lanzamiento 1.0 |

> **Refinamiento (post-0.2.0):** la política original decía "cada umbrella cerrada = MINOR".
> Se ajusta porque las umbrellas de infra (tests, tooling) no entregan features visibles al usuario
> y bumpear minor por ellas engaña al consumidor del versionado. Las umbrellas de infra van como
> PATCH acumulado; las umbrellas con feature visible van como MINOR.

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
