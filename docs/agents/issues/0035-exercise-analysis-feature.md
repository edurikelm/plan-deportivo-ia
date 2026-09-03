---
label: feature
status: closed
parent: null
depends_on: []
blocks:
  - "0036"
  - "0037"
  - "0038"
  - "0039"
  - "0040"
---

# 0035 — Vista de análisis de ejercicio (umbrella)

## Goal

Sumar a la Calculadora de Pesos una **vista de análisis por ejercicio** que muestre progresión de carga, e1RM estimado, tabla de Prilepin (1-12 reps × % de 1RM) e historial del ejercicio. Accesible desde una nueva card en `/classes` → `/tools/weight-calculator/history` (refactorizado a lista de ejercicios) → `/tools/weight-calculator/exercise/[name]`.

## ADRs que este umbrella ejecuta

- [0010 — 1RM estimation from reps](../adr/0010-1rm-estimation-from-reps.md) — schema change + fórmula Epley piecewise.
- [0011 — Exercise catalog as analysis entry](../adr/0011-exercise-catalog-as-analysis-entry.md) — entry point + refactor de `/history`.

## Sub-issues

| # | Título | Bloqueado por |
|---|---|---|
| [0036](./0036-schema-1rm-helpers-storage-migration.md) | Schema + 1RM helpers + storage migration | — |
| [0037](./0037-save-form-reps-marcar-1rm.md) | Save form: `reps` + `Marcar 1RM` | 0036 |
| [0038](./0038-catalog-card-history-refactor.md) | Catalog card + `/history` refactor | 0036 |
| [0039](./0039-analysis-view-recharts-prilepin.md) | Analysis view: Recharts + Prilepin | 0036, 0038 |
| [0040](./0040-foto-tab-deactivated.md) | Foto tab desactivada | — |

`0040` es independiente (no comparte código con el resto de la feature); puede ejecutarse en paralelo desde el día 1.

## What ships when this umbrella is done

- Click en `Ejercicios guardados` desde `/classes` → lista de ejercicios únicos derivados de `pd:calculator-records`.
- Click en un ejercicio → vista con 3 charts Recharts, tabla de Prilepin sticky, y lista del ejercicio con `Cargar` + `Marcar 1RM`.
- 1RM estimado por Epley piecewise (`reps = 1` directo, `reps ≥ 2` Epley), con override opcional vía flag `isOneRepMax`.
- Foto tab visible pero desactivada (placeholder `Función desactivada`).
- Cero cambio en el storage key (`pd:calculator-records` se rehidrata con los nuevos campos via `.default()` en Zod).
- Cero cambio en la lista de modalidades de IA (CrossFit sin tocar).

## Out of scope (explícito)

- Export de la vista (PNG/MD). El grill R4 Q15 decidió no exportar en v1.
- Vista de análisis global (todos los ejercicios en una sola página).
- Comparación entre ejercicios.
- Búsqueda global de registros por fecha/peso.
- Reactivación del Foto tab.
- RPE, Prilepin custom por ejercicio, validación de "set a fallo".

## Acceptance criteria del umbrella

- [ ] Los 5 sub-issues (0036-0040) están en `status: closed` con sus ACs verdes.
- [ ] `npm run build` verde, `npm run lint` verde, `npm test` verde.
- [ ] Smoke manual end-to-end: el coach guarda 3 sets de "Back Squat" con reps distintos, marca uno como 1RM, navega a la vista de análisis desde `/classes`, ve los 3 charts + tabla de Prilepin + lista del ejercicio con el flag `1RM` visible.
- [ ] Smoke manual de regresión: un registro pre-migración (sin `reps`, sin `isOneRepMax`) aparece en la lista del ejercicio con `reps: null` y queda excluido del cálculo de 1RM.
