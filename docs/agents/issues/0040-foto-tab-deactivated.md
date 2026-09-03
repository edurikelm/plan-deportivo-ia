---
label: chore
status: open
parent: 0035-exercise-analysis-feature
depends_on: []
blocks: []
---

# 0040 — Foto tab desactivada

## Parent

[0035 — Vista de análisis de ejercicio (umbrella)](./0035-exercise-analysis-feature.md)

## What to build

El Foto tab de la calculadora está visible en el selector Manual/Foto pero su contenido está bloqueado: al seleccionarlo, se muestra un placeholder `Función desactivada` en lugar del Foto UX completo. El código del Foto tab y el endpoint `/api/calculate-weight` se preservan intactos para una eventual reactivación futura.

## Contexto (por qué)

El coach confirmó en el grill R3 Q10 que el Foto tab "no se ocupa la verdad" — no lo usa en su flujo. Mantener el código activo tiene costo de mantenimiento (revisarlo cuando hay cambios en la calculadora, mantener el endpoint, validar contra rate limits del modelo vision) sin un beneficio observable. Pero **sacar** el código también tiene costo: si el coach lo quiere reactivar, hay que reimplementar.

El compromiso: **desactivar visualmente** (UI muestra que la feature existe pero no es usable), **preservar el código** (la lógica y el endpoint siguen compilando y deployando).

## Cambios en archivos

### `src/app/tools/weight-calculator/_components/calculator-client.tsx`

Buscar la sección que renderiza el contenido del Foto tab (típicamente un `if (activeTab === "foto") return <FotoTab ... />` o equivalente). Reemplazar con:

```tsx
if (activeTab === "foto") {
  return (
    <div className="chalk-card p-6 text-center">
      <p className="text-sm text-mute">Función desactivada</p>
      <p className="text-xs text-mute mt-2">
        El reconocimiento de carga por foto está temporalmente deshabilitado.
      </p>
    </div>
  );
}
```

Opcional: agregar una copy más explícita si el coach lo pide (e.g. "Próximamente" o un link a un issue de reactivación). Por default, copy mínima.

### Lo que **no** se toca

- `src/app/api/calculate-weight/route.ts` — el endpoint queda intacto. Si Vercel reporta cold start o costo del modelo, se evalúa en un issue aparte.
- `src/lib/calculator/schemas.ts` — `BreakdownSchema` y los helpers de cross-check siguen exportados.
- `src/lib/calculator/one-rm.ts` — sin cambios (el Foto tab no se integra con el análisis).
- Los componentes internos del Foto tab (preview, thumbnail, status strip) — quedan en el código pero inalcanzables desde la UI.

## TDD scope

- **Sin tests**. El cambio es puramente visual: un branch de un `if` que ahora retorna un placeholder en lugar del Foto UX. El Foto UX original no tenía tests automatizados (verificar con `git log`); sumarlos ahora sería scope creep.
- Si el coach pide tests del placeholder, se agregan en un issue follow-up.

## Blocked by

- Ninguno. Este issue es independiente del resto de la feature.

## Acceptance criteria

- [ ] Al seleccionar la tab "Foto" en `/tools/weight-calculator`, se muestra el placeholder `Función desactivada`.
- [ ] El endpoint `/api/calculate-weight` sigue respondiendo (verificable con `curl` o un test manual; no requiere un test automatizado).
- [ ] Cero cambio en el storage: no se migra nada, no se borra nada de `pd:calculator-records`.
- [ ] `npm run build` verde.
- [ ] `npm run lint` verde.
- [ ] `npm test` verde (sin tests nuevos, los existentes deben seguir pasando).
- [ ] Cero cambio en el tipo `FotoState` ni en el state machine del Foto tab.

## Manual end-to-end test

```bash
npm run build && npm run lint && npm test
# Expect: los 3 verde
```

Smoke manual en `/tools/weight-calculator`:

1. Ver el selector de tabs: `Manual` y `Foto`.
2. Click en `Foto` → ver el placeholder "Función desactivada" en lugar del Foto UX.
3. Click en `Manual` → vuelve a la calculadora normal.
4. Verificar que `curl -X POST http://localhost:3000/api/calculate-weight` con un payload inválido devuelve 400 (sigue respondiendo, sólo está bloqueado desde la UI).

## Out of scope

- Reactivación del Foto tab. Si el coach lo quiere de vuelta, se levanta un issue aparte.
- Remoción del código del Foto tab. Decisión deliberada: el código se preserva para reactivación futura con costo mínimo.
- Remoción del endpoint `/api/calculate-weight`. Mismo rationale.
- Tests del Foto UX o del endpoint (no existían antes; sumarlos no es parte de este issue).
- Reasignación de los recursos del modelo vision (`MiniMax-M3`) a otra feature.
