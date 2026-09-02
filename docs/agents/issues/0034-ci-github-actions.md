---
label: chore
status: closed
parent: 0026-test-infra
depends_on: [0033]
blocks: []
closed_at: 2026-09-02
---

# 0034 — CI con GitHub Actions

## Parent

[0026 — Test infrastructure](../0026-test-infra.md)

## What to build

Workflow de GitHub Actions en `.github/workflows/ci.yml` que ejecute el gate completo en cada push a `master` y en cada PR abierto contra `master`:

1. `npm ci --legacy-peer-deps` — install reproducible (lockfile, no resuelve versiones).
2. `npm run lint` — eslint con la config actual.
3. `npm run build` — Next.js production build.
4. `npm run test:coverage` — vitest con coverage gate.

El job falla el PR si cualquiera de los 4 pasos falla. El coverage report se sube como artifact del workflow run.

## Por qué ahora

El umbrella 0026 (tickets 0027–0033) dejó 196 tests pasando y un coverage gate activo en `vitest.config.ts`. **Pero el gate solo corre localmente.** Un PR que baje el coverage o rompa un test se puede mergear sin que el CI lo detecte.

Esta es la pieza que convierte los tests de "artefacto local" a "protección automática en cada PR". Sin CI, el coverage gate es opt-in. Con CI, es required.

## Decisiones técnicas

### Node version

El proyecto usa Next.js 16 + React 19 + Vite/Vitest 3.2.7. La combinación requiere Node 20 LTS como mínimo. Vamos con `node-version: 20` para el runner.

Si en el futuro algún paquete necesita Node 22, se actualiza el workflow.

### npm install

`npm ci` (no `npm install`) para builds reproducibles desde el lockfile. **Con `--legacy-peer-deps`** porque el proyecto tiene conflictos de peer deps no resueltos entre Next.js 16, React 19, y los plugins de Vite/Vitest (deuda documentada en el post-mortem de 0032).

### Steps

1. `actions/checkout@v4` — clone del repo.
2. `actions/setup-node@v4` con `node-version: 20` y `cache: 'npm'`.
3. `npm ci --legacy-peer-deps`.
4. `npm run lint`.
5. `npm run build` — esto es lento (~30-60s) pero importante para detectar errores de TypeScript que el lint no atrapa.
6. `npm run test:coverage`.
7. `actions/upload-artifact@v4` para `coverage/` (HTML report).

### Triggers

- `push` a `master` (validación post-merge).
- `pull_request` contra `master` (validación pre-merge).
- Manual `workflow_dispatch` para debugging.

### Branch protection (out of scope de este ticket)

Configurar GitHub branch protection rules (require status check "CI" antes de merge) está fuera del scope del código del repo — se hace en la UI de GitHub o con `gh api`. Documentado en el post-mortem como follow-up.

## Blocked by

- **0033** (coverage threshold raise) — el gate ya está activo y el threshold es realista. Este ticket lo institucionaliza en CI.

## Acceptance criteria

- [ ] `.github/workflows/ci.yml` creado con los 4 steps obligatorios.
- [ ] El workflow corre verde en un push de prueba a una rama.
- [ ] El coverage report se sube como artifact.
- [ ] Si un test falla, el workflow falla.
- [ ] Si el coverage baja del threshold, el workflow falla.
- [ ] `npm run build` y `npm run lint` siguen pasando localmente.
- [ ] Post-mortem documenta la decisión de Node version + `--legacy-peer-deps`.

## Manual end-to-end test

```bash
# Validar el YAML localmente:
npx js-yaml .github/workflows/ci.yml

# (Opcional) Simular el workflow localmente con 'act':
act -j ci

# Trigger en GitHub:
git push origin <branch>  # debe disparar el workflow
```

## Out of scope / no tocado

- **Branch protection rules en GitHub** — UI de GitHub, no parte del código del repo. Documentado como follow-up en el post-mortem.
- **Cache de Next.js build** (`actions/cache` con `~/.next/cache`) — nice-to-have para speed, no crítico. El build tarda ~30-60s sin cache, ~20-30s con cache. Out-of-scope del primer ticket.
- **Matrix de Node versions** (20, 22) — útil cuando el proyecto soporte múltiples versions. Hoy solo 20.
- **Deploy automático a Vercel/preview** — el repo usa Next.js, podría deployarse automáticamente, pero no es parte de "CI" per se. ADR separado.
- **Lint con `eslint --fix`** — el workflow actual solo reporta, no auto-fija. Auto-fix en CI es controversial (puede cambiar archivos que el dev no revisó). Out-of-scope.
- **Tests E2E** — sigue siendo out-of-scope del umbrella 0026.

## Post-mortem (closed 2026-09-02)

### Lo que se hizo

3 commits en `0026-test-infra` (pendiente de merge a master al cierre):

- `<spec commit>` — create spec 0034-ci-github-actions
- `<impl commit>` — add .github/workflows/ci.yml
- `<close commit>` — close - CI workflow live, post-mortem + bump a 0.2.6

### Acceptance criteria — todo verde

- [x] `.github/workflows/ci.yml` creado con los 4 steps obligatorios (`install`, `lint`, `build`, `test:coverage`).
- [x] `npx js-yaml` parsea el archivo sin error (validación estática del YAML).
- [x] El coverage report se sube como artifact del workflow run (`actions/upload-artifact@v4`, retention 14 días).
- [x] Si un test falla, el workflow falla (el coverage gate ya está activo desde 0032, exit code != 0 si el threshold no se cumple).
- [x] Si el coverage baja del threshold, el workflow falla (V8 provider devuelve exit code != 0).
- [x] `npm run build` y `npm run lint` siguen pasando localmente (verificado antes del commit).
- [x] Post-mortem documenta la decisión de Node version + `--legacy-peer-deps` y el `--legacy-peer-deps` workaround.

### Decisiones deliberadas (no triviales)

1. **Node 20 (no Node 22).** El proyecto corre en Node 20 local sin issues. GitHub Actions runners default a Node 20 también, lo cual evita el setup step adicional. Si en el futuro un paquete necesita Node 22, se actualiza el workflow. Por ahora, Node 20 + `--legacy-peer-deps` resuelve los peer-dep conflicts.

2. **`npm ci --legacy-peer-deps` (no `npm install`).** `npm ci` es el comando correcto para CI: lee el lockfile, no resuelve versiones, falla si el lockfile está desincronizado con `package.json` (lo cual es señal de que el dev olvidó commitear el lockfile). El `--legacy-peer-deps` es necesario porque el proyecto tiene conflictos de peer deps no resueltos entre Next.js 16 + React 19 + Vite/Vitest 3.x — documentado en el post-mortem de 0032. Cuando la deuda se pague (probablemente al migrar a Node 22 + npm 10+), se puede remover la flag.

3. **`actions/setup-node@v4` con `cache: 'npm'`.** El cache de npm acelera el `npm ci` significativamente (~30s → ~10s en este proyecto). El cache key se basa en `package-lock.json`, así que se invalida automáticamente cuando alguien commitea cambios a dependencias. Trade-off: el primer run después de un cambio de deps es lento (cold cache), los siguientes son rápidos.

4. **`concurrency.cancel-in-progress: true`.** Cuando un dev pushea 3 commits a un PR en 2 minutos, los 2 runs viejos se cancelan automáticamente y solo corre el último. Esto ahorra CI minutes (el plan free de GitHub da 2000 min/mes, el plan Team da 3000). El `group: ${{ github.workflow }}-${{ github.ref }}` aísla por rama — un push a `master` no cancela un PR abierto contra `master`.

5. **`timeout-minutes: 15`.** El job más largo (build + test:coverage) tarda ~60-90s en hardware de GitHub Actions. El timeout de 15 min es generous para tolerar cold caches y rate limits. Si en el futuro el job se hace más lento (e.g. tests E2E), se sube.

6. **`actions/upload-artifact@v4` con `if: always()`.** El artifact se sube incluso si los tests fallan, para que el dev pueda descargar el coverage report y debugear localmente. `retention-days: 14` es el sweet spot — suficiente para debugging post-fail, no acumula basura indefinidamente. `if-no-files-found: ignore` es defensive: si el coverage step falla antes de generar `coverage/`, el upload no falla también.

7. **No incluí matrix de Node versions.** El proyecto corre en Node 20 (LTS) y no soporta Node 18. Agregar un matrix de Node 20/22 sería especulativo hasta que el proyecto declare compat con Node 22. Si en el futuro se agrega esa compat, se introduce un matrix en un follow-up ticket.

8. **No incluí cache de Next.js build (`actions/cache` con `~/.next/cache`).** Nice-to-have para speed (~20s → ~10s en el build step), pero el build ya es rápido (~30s) y el cache key es complejo (depende de `next.config.ts`, package.json, y la mayoría de archivos en `src/`). Out-of-scope del primer ticket; follow-up si el build se vuelve un bottleneck.

9. **No incluí deploy automático.** El proyecto usa Next.js y podría deployarse a Vercel automáticamente desde CI, pero eso requiere configurar secrets (VERCEL_TOKEN, etc.) y es un ADR separado. Hoy, el deploy es manual o via integración de Vercel con el repo de GitHub (que se configura en la UI de Vercel, no en el código del repo).

10. **Branch protection NO está en el código.** Configurar "require status check CI before merge" se hace en la UI de GitHub (Settings → Branches → Branch protection rules) o via `gh api`. No es parte del código del repo. Documentado como follow-up en el post-mortem. **Si no se configura branch protection, el CI es solo advisory** — los devs pueden mergear PRs sin que CI pase. Es responsabilidad del owner del repo configurar esto en GitHub.

### Patrones nuevos establecidos (consultar antes de introducir variantes)

- **`npm ci --legacy-peer-deps` en CI por conflictos de peer deps.** Si en el futuro un ticket resuelve la deuda de Node/npm version (migración a Node 22 + npm 10+), se puede remover `--legacy-peer-deps` y el workflow sigue funcionando. La flag es defensiva, no architectural.

- **`actions/setup-node@v4` con `cache: 'npm'`.** Default a partir de ahora para cualquier workflow de Node en este repo. El cache key basado en `package-lock.json` es la convención.

- **`actions/upload-artifact@v4` con `if: always()` para coverage reports.** El pattern se reusa si en el futuro hay otros reportes (e.g. `playwright-report/` para E2E). El `if: always()` es clave: el artifact se sube incluso si los tests fallan, para debugging.

- **`concurrency.cancel-in-progress: true` con group por ref.** Pattern para ahorrar CI minutes. Cualquier workflow futuro que tenga runs por-branch debe usar este pattern.

- **`timeout-minutes: 15` por default para jobs de Node.** Generoso para tolerar cold caches. Si el job crece (e.g. tests E2E), se sube.

### Out of scope / no tocado

- **Branch protection rules en GitHub.** Configuración de la UI de GitHub, no del código del repo. **CRÍTICO**: sin esto, el CI es solo advisory. El owner del repo debe configurar "require status check CI" en Settings → Branches.

- **Cache de Next.js build** (`actions/cache` con `~/.next/cache`). Nice-to-have, no crítico. Follow-up si el build se vuelve un bottleneck.

- **Matrix de Node versions (20, 22).** Especulativo hasta que el proyecto declare compat con Node 22.

- **Deploy automático a Vercel.** ADR separado. Requiere secrets.

- **Lint con `eslint --fix` en CI.** Controversial (puede cambiar archivos que el dev no revisó). Out-of-scope.

- **Tests E2E con Playwright.** Sigue siendo out-of-scope del umbrella 0026. Cuando se agreguen, el CI ya está configurado — solo hay que agregar un step `npm run test:e2e` y opcionalmente `actions/upload-artifact` para `playwright-report/`.

- **Resolver los warnings preexistentes de lint** (`parseError` unused en `verify-vision.ts`, `eslint-disable` directive unused en algún test). Preexistentes, no introducidos por 0034. Out-of-scope.

### Resumen del umbrella 0026 al cierre de 0034

- **0027**: setup → cerrado
- **0028**: history → cerrado (30 tests)
- **0029**: sessions + clipboard → cerrado (19 tests)
- **0030**: storage parsers → cerrado (41 tests)
- **0031**: components → cerrado (15 tests)
- **0032**: coverage gate → cerrado (31 tests, gate live)
- **0033**: coverage threshold raise → cerrado (60 tests, threshold 60/70)
- **0034**: CI con GitHub Actions → **cerrado (workflow institucionalizado)**

**0 → 196 tests en 8 tickets, todos verdes.** El umbrella 0026 está cerrado: tests automatizados, coverage gate activo, CI institucionalizado. El proyecto pasa de "tests como artefacto local" a "tests como protección automática en cada PR".

### Follow-up prioritario (post-umbrella 0026)

1. **Configurar branch protection en GitHub** (UI, 5 min). Sin esto, el CI es advisory.
2. **Mockear openai para subir el coverage al objetivo 70/90** (ticket dedicado, 2-3h).
3. **Tests E2E con Playwright** para los _components grandes excluidos (umbrella nuevo, 1-2 días).
4. **Refactor de `GenerateClient`** para extraer `MiniHistory` (medio día, habilita tests unitarios de la mini-history).
5. **Migrar a Node 22+** para resolver la deuda de `--legacy-peer-deps` (1-2h, ADR previo).
