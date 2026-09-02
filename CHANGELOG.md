# Changelog

Todos los cambios notables de **plan-deportivo-ia** (v1, Next.js) se documentan acá.
Formato: [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).
Versionado: [SemVer](https://semver.org/lang/es/) (MAJOR.MINOR.PATCH).

> v2 (Flutter) tiene su propio versionado independiente en `v2/pubspec.yaml`.

## Política de bumps

| Bump | Cuándo | Ejemplos |
|---|---|---|
| **PATCH** (`0.1.x`) | Invisible para el usuario | bugfix, refactor interno, chore (deps, lint), tests, docs |
| **MINOR** (`0.x.0`) | Features visibles o cambios de UX | cada umbrella cerrada (0018 → 0.2.0), nueva página, nuevo flujo |
| **MAJOR** (`x.0.0`) | Breaking o rediseño grande | cambio incompatible en storage schema, cambio en contrato del prompt IA, rediseño de modelo de datos, lanzamiento 1.0 |

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

[Unreleased]: https://github.com/edurikelm/plan-deportivo-ia/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/edurikelm/plan-deportivo-ia/releases/tag/v0.2.0
[0.1.0]: https://github.com/edurikelm/plan-deportivo-ia/releases/tag/v0.1.0
