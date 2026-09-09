---
label: feature
status: closed
closed_at: 2026-09-09
parent:
depends_on: []
blocks: []
---

# 0048 — Pestaña "Por objetivo" en la Calculadora de Pesos

## Parent

(standalone, no parent umbrella)

## What to build

Una nueva pestaña en `/tools/weight-calculator` llamada **"Por objetivo"**. Resuelve la carga (barra + discos por lado) a partir de un peso objetivo — la operación inversa de la pestaña Manual. Caso de uso del Entrenador: tipear `RX 135lb` o `SC 115lb` y obtener al instante qué barra y qué discos cargar.

## Contexto (por qué)

El flujo actual de la calculadora es **forward**: el coach selecciona los discos y ve el total. Eso sirve para verificar una carga ya armada, pero cuando el coach está **preparando** el box con los pesos recetados de un WOD (típicamente RX y SC lado a lado), tiene que hacer el cálculo inverso mentalmente cada vez. Esta feature cierra ese gap: el coach tipea el peso, la app devuelve la carga.

## Scope V1 (cerrado en este issue)

- Nueva pestaña "Por objetivo" en `/tools/weight-calculator` (siguiente a "Manual", antes de "Foto" desactivado).
- Input de peso objetivo como texto libre: `135`, `135 lb`, `135lb`, `60kg`, decimales como `62.5`. Unidad inferida del sufijo, o del toggle kg/lb cuando no hay sufijo.
- Selector de barra independiente arriba (15 kg / 20 kg / Otro), igual que Manual pero con state local.
- Output: `BarVisualization` reusada + breakdown (`20kg + (25kg + 10kg)×2`) + totales en kg/lb.
- Cuando no hay match exacto, dos cards lado a lado con vecino más cercano por arriba y por abajo, cada uno con badge `±X kg / ±Y lb`.
- Error claro cuando el peso objetivo está por debajo de la barra.
- Inventario por defecto hardcodeado: kg `[25, 20, 15, 10, 5, 2.5, 1.25]`, lb `[45, 35, 25, 10, 5, 2.5]`.
- Algoritmo: greedy descendente para match exacto, bounded DFS para vecinos.
- Stateless: no comparte state con Manual, no escribe en `pd:calculator-state` ni en `pd:calculator-records`.

## Scope V2 (out of scope, queda como follow-up)

- **Inventario configurable por box** ("Placas del box" en `/settings`). El default cubre el 95% de los boxes; el resto justifica un umbrella propio.
- **Botón "Aplicar a Manual"** para mover la carga resuelta a la pestaña Manual. En V1 el coach va manualmente. La razón de la des-escopada está en CHANGELOG 0.3.0: priorizamos velocidad de respuesta sobre integración.
- **Algoritmo óptimo de conteo de discos** (DP o branch & bound). Greedy + bounded DFS es suficiente para los pesos que se usan en un box real. Si la UX pide "menos discos", es cambio aislado en `resolver.ts`.
- **Multi-target side-by-side** (RX + SC al mismo tiempo, en paralelo). Se discutió en grill-with-docs; el single target es lo que el coach necesita cuando está preparando el box.
- **"Auto" para la barra** (elegir barra automáticamente según el target). En V1 el coach selecciona manualmente.

## Cambios en archivos

### Nuevos

- `src/lib/calculator/resolver.ts` — pure function `resolveWeight({ target, barKg, inventory?, tolerance? })`. Tipos exportados: `ResolveInput`, `ResolveResult`, `ResolvedLoad`, `ResolveStatus`, `InventoryUnit`. Constantes: `DEFAULT_INVENTORY_KG`, `DEFAULT_INVENTORY_LB`.
- `src/lib/calculator/resolver.test.ts` — 22 tests, cobertura 100% del módulo.

### Modificados

- `src/lib/calculator/index.ts` — re-export del resolver.
- `src/app/tools/weight-calculator/_components/calculator-client.tsx`:
  - `ActiveTab` extendido con `"por-objetivo"`.
  - Nuevo botón de tab entre Manual y Foto.
  - Nuevo sub-componente `PorObjetivoTab` (state local, no comparte con CalculatorClient).
  - Sub-componentes auxiliares: `ResolverResult`, `ResolverResultCard`, `parseTargetInput`.
  - Reusa: `formatWeightForDisplay`, `lbToKg`, `BarVisualization`, `discToneClass`, `discWidthPx`, `COMMON_BAR_KG`, `DEFAULT_BAR_KG`.
- `CONTEXT.md` — nueva sub-sección "Resolver" en la terminología de la Calculadora de Pesos, actualiza la entrada de "Estado compartido" para aclarar que Por objetivo no participa.
- `CHANGELOG.md` — entrada 0.3.0 al tope.
- `package.json` — bump `0.2.6 → 0.3.0`.

## Decisiones de diseño (capturadas en grill-with-docs)

| # | Decisión | Por qué |
|---|---|---|
| Q1 | Nueva pestaña en `/tools/weight-calculator` | Reusa el slot libre del Foto tab desactivado, mantiene el patrón de tabs paralelos. |
| Q2 | Inventario hardcodeado | El 95% de los boxes usa el set estándar; configurable es scope suficiente para su propio umbrella. |
| Q3 | Single target | El caso "preparar el box" se resuelve con un input a la vez; multi-target es V2. |
| Q4 | Selector de barra independiente | El coach puede estar resolviendo para una barra de 15 kg (femenina/técnica); no asumir 20 kg. |
| Q5 | Greedy + bounded DFS para vecinos | Simple, determinista, suficiente. DP/óptimo no aporta para un box real. |
| Q6 | **Sin integración con state actual** (de-escopado en Q6) | El coach quiere la respuesta rápida; persistir después es flujo aparte. |
| Q7 | Sigue siendo pestaña aunque no comparta state | Mantiene el patrón de tabs paralelos; state independiente se justifica por stateless. |
| Q8 | Selector de barra visible arriba | Mismo control que Manual, no se duplica lógica. |
| Q9 | Output = breakdown + BarVisualization (sin Copiar / Aplicar) | Es solo lectura; el V2 agrega Copiar/Aplicar si la feature se usa. |
| Q10 | Stateless (no autosave) | Pestaña de consulta; persistir el último input no aporta. |
| Q11 | Términos canónicos: Resolver, Peso objetivo, Resultado exacto, Vecino más cercano, Inventario por defecto, Greedy descendente | Documentados en CONTEXT.md. |
| Q12 | Sin ADR nuevo (solo CONTEXT.md) | La decisión greedy + inventario hardcodeado es local al archivo; se lee en 30 líneas de código. Un ADR sería burocracia. Si cambia a inventario configurable o algoritmo distinto, ahí sí ADR. |

## Convención de redondeo (importante para el futuro)

- **kg no se redondea.** 1.25 kg se queda 1.25 kg. `Math.round(1.25 * 10) / 10` daría 1.3 (porque `Math.round(12.5) === 13` en JS, half-up) y eso rompe el match con `formatWeightForDisplay` en el cliente.
- **lb se redondea a 1 decimal** al convertir desde kg (1.25 kg = 2.7557… lb → 2.8 lb).
- El grouping de discos adyacentes iguales tolera ±0.05 para absorber el drift de la conversión.

## TDD scope

- Tests del módulo pure (`resolver.ts`): 22 tests cubriendo los 10 escenarios de `CONTEXT.md`:
  1. Match exacto (`60kg → 20kg bar + 20kg×1` por lado)
  2. Match exacto con grouping (`120kg → 20kg bar + (25kg×2)`)
  3. Target = bar (bar only, sin discos)
  4. Target < bar (null)
  5. Vecinos cuando el residual no es exacto (`21.5kg → arriba 22.5kg, abajo 20kg`)
  6. Vecinos en el medio del inventario (`47kg → arriba 47.5kg, abajo 45kg`)
  7. Unidades mixtas (`135lb target, 20kg bar, default lb inventory`)
  8. Inventario custom (`50kg con [20, 10]`)
  9. Inventario vacío (null si target > bar; bar only si target == bar)
  10. Default inventory selection por unidad
  11. Targets grandes (200kg)
  12. Disc más chico en uso (1.25kg para 22.5kg target)
  13. Breakdown line matches `formatBreakdownLine`
- Tests del componente (`calculator-client.tsx`): excluidos del coverage gate (es un cliente monolítico de ~40KB; candidatos para Playwright en umbrella futuro). El módulo pure se testea exhaustivamente, que es donde está la lógica.

## Verificación local

```bash
cd v1
npm run build          # OK (TypeScript strict + Next.js build)
npx vitest run src/lib/calculator/resolver.test.ts   # 22/22 passing
npm run lint           # sin nuevos errores
npm run test:coverage  # > 80% líneas en src/lib/** (per vitest.config.ts)
```

## Bloqueado por

(nada)

## Bloquea

(nada explícito; deja como follow-ups los puntos de V2 listados arriba)
