---
label: chore
status: open
parent: 0026-test-infra
depends_on: [0031]
blocks: []
---

# 0032 — Coverage gate para el umbrella 0026

## Parent

[0026 — Test infrastructure](../0026-test-infra.md)

## What to build

Cierre del umbrella 0026 con un **reporte automatizado de cobertura**. Instalar `@vitest/coverage-v8`, agregar el script `test:coverage` al `package.json`, configurar un threshold conservador en `vitest.config.ts`, y leer el reporte para detectar módulos con cobertura baja.

### Por qué ahora

El umbrella 0026 cerró 105 tests en 6 archivos. La inspección visual confirmó 100% en los módulos testeados, pero **sin un reporte automatizado** no tenemos forma de saber:
- Qué módulos de `src/lib/` NO están testeados (e.g. `clipboard.ts` tiene tests, pero `use-hydrated.ts` no).
- Si una regresión silenciosa baja la cobertura de un módulo que SÍ está testeado.
- Cuál es el delta de cobertura cuando se agrega código nuevo.

El spec 0026 decía explícitamente: "Sin coverage gate todavía — se introduce cuando haya suficientes tests para que la métrica sea significativa (umbral tentativo: cuando el codebase tenga ≥ 50% cobertura en `src/lib/`)". Hoy `src/lib/` está cerca de 100% en los archivos testeados y 0% en los no testeados. La métrica ya es significativa.

### Threshold conservador al inicio

El primer reporte va a mostrar la realidad cruda. Para evitar que el gate se rompa en el primer commit:

- **Threshold inicial**: `--coverage.thresholds.lines = 50` global, `--coverage.thresholds.branches = 40`.
- **Threshold para `src/lib/**`**: lines 90, branches 80 (los archivos puros deberían estar casi al 100%).
- **NO threshold por función** (demasiado granular al inicio; ajustamos si hace falta).

El threshold se sube gradualmente en tickets futuros si la métrica se mantiene estable. Documentar el delta en el CHANGELOG.

### Lo que se va a detectar (hipótesis)

Después de leer el reporte, los huecos más probables son:

- `src/hooks/use-hydrated.ts` — 0% (trivial, sin tests dedicados).
- `src/hooks/use-local-storage.ts` — 0% (trivial).
- `src/lib/modalities/modalities.ts` — 0% (registry de modalities, no testeado).
- `src/lib/modalities/crossfit-schemas.ts` — parcial (las funciones puras como `crossfitPlanToMarkdown` no están testeadas, solo el Zod schema se valida indirectamente).
- `src/lib/storage.ts` — funciones como `getCalculatorState` / `setCalculatorState` no testeadas (0030 las saltó explícitamente).
- Componentes grandes (`GenerateClient`, `SettingsClient`, `CalculatorClient`) — parcial / 0%.

Estos huecos NO son motivo para no mergear el coverage gate. El threshold inicial (50% global) está calculado para que se cumpla con lo que hay.

## Blocked by

- **0031** (component tests) — el umbrella 0026 está cerrado, podemos agregar meta-infra.

## Acceptance criteria

- [ ] `@vitest/coverage-v8` instalado.
- [ ] Script `test:coverage` en `package.json`.
- [ ] Threshold conservador en `vitest.config.ts` (50% global, 90% en `src/lib/**`).
- [ ] `npm run test:coverage` ejecuta y muestra el reporte.
- [ ] El threshold se cumple con el código actual (105 tests pasando).
- [ ] `coverage/` agregado a `.gitignore` (ya está desde 0027).
- [ ] `npm run build` sigue pasando.
- [ ] `npm run lint` sigue pasando.
- [ ] Post-mortem incluye tabla con la cobertura por archivo (lines/branches/functions).

## Manual end-to-end test

```bash
npm run test:coverage
# Expect: 105 tests passing + reporte con % por archivo
npm run build
npm run lint
```

## Out of scope / no tocado

- **Coverage por archivo individual con threshold estricto**: requiere que TODOS los archivos de `src/lib/` estén al 100%. Out-of-scope para este ticket; sería un follow-up si la métrica global es saludable.
- **Coverage badge en el README**: nice-to-have, no es parte del cierre del umbrella.
- **Mutation testing con Stryker**: overkill para el tamaño del proyecto.
- **Visual regression tests**: fuera del scope de tests automatizados.
