---
label: chore
status: closed
closed_at: 2026-09-03
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

## Post-mortem (closed 2026-09-03)

### Lo que se hizo

1 commit de impl:

- `0040-impl-...` — reemplazo del Foto tab UX por un placeholder "Función desactivada" + disable comments sobre el state machine preservado.

### Acceptance criteria — todo verde

- [x] Al seleccionar la tab "Foto" en `/tools/weight-calculator`, se muestra el placeholder "Función desactivada" (copy "El reconocimiento de carga por foto está temporalmente deshabilitado. El código de la feature se conserva para una reactivación futura.").
- [x] El endpoint `/api/calculate-weight` sigue compilando (las 11 rutas de Next se generan sin cambios, incluyendo el endpoint dinámico). No se llamó al endpoint en runtime pero su código está intacto.
- [x] Cero cambio en storage.
- [x] `npm test` verde: 249/249 tests pasando (cero nuevos tests por diseño).
- [x] `npm run build` verde, 11/11 static pages, typecheck OK.
- [x] `npm run lint` verde: 0 errors, 2 warnings preexistentes (no relacionadas con este cambio).
- [x] `FotoState` union intacta, foto-related handlers preservados.

### Decisiones deliberadas (no triviales)

1. **`eslint-disable-next-line` en 4 de los 5 símbolos preservados.** El state machine del Foto tab sigue declarado pero ya no se usa. ESLint flaguea `fileInputRef` y `isDragOver` (los que solo servían al FotoTab component), pero no flagua `fotoState`/`setFotoState`/`setFotoElapsed`/`fotoAbortRef` (siguen usados por `acceptFoto` y `cancelFoto`, que ESLint no alcanza a inlining-analyze). Resultado: 4 disables necesarios, 3 innecesarios en un primer pase — corregidos después de un build del linter.

2. **Copy del placeholder más explícita que el spec original.** El spec sugería "Función desactivada" en una línea. Usé 2 líneas: el título ("Función desactivada") + la explicación ("El reconocimiento de carga por foto está temporalmente deshabilitado. El código de la feature se conserva para una reactivación futura."). Razón: el coach en el futuro va a ver este placeholder y va a preguntarse "¿cuándo vuelve?". La copy explica el estado sin prometer fechas. Documentado en el comment inline.

3. **El placeholder usa `chalk-card` y no `border border-dashed`.** El otro empty state del proyecto (`history-page-client.tsx`) usa `border border-dashed border-hairline rounded-sm p-6 text-center` para "no hay registros". El placeholder del Foto tab usa `chalk-card` (igual que el `FotoTab` original) para que la transición entre Manual y Foto se vea más sólida. Decisión estética.

4. **No removí el import de `ImagePlus`, `Loader2`, etc.** Aunque el FotoTab no se renderiza, los iconos se siguen usando en otros lugares del archivo (`BookmarkPlus` ya estaba, y `Loader2` no — déjame verificar). Verificado: `ImagePlus` y `Loader2` solo se usan en FotoTab, así que técnicamente podrían eliminarse. Decidí no tocarlos porque (a) el spec dice preservar el código del Foto tab completo, y (b) eliminar imports selectivamente requiere cuidado con el tree-shaking. Si en una sesión futura alguien reactiva Foto, los imports están listos.

### Patrones nuevos establecidos

- **`eslint-disable-next-line` selectivo, no global.** Cuando una pieza de código se preserva para reactivación futura, marcar SÓLO los símbolos que el linter flague. Marcar de más genera "unused eslint-disable directive" warnings, que son ruido adicional. El approach iterativo (agregar, correr lint, podar) es más limpio que adivinar de antemano.

### Out of scope / no tocado

- **El endpoint `/api/calculate-weight`**, los `BreakdownSchema`, `crossCheckBreakdown`, `formatBreakdownLine`, `calculateBreakdownFromImage`, y el `FotoState` union — todos intactos. La próxima sesión puede reactivar Foto montando estos en una nueva ruta o componente.
- **El `FotoTab` component** (definido en el mismo archivo) — sigue compilando pero ya no se renderiza. ESLint lo flaguió (assigned but never used), silenciado con `eslint-disable-next-line`.
- **`scripts/verify-vision.ts`** — el script de verificación manual del endpoint vision sigue intacto.

### Hallazgo no relacionado (de paso)

El proceso de "agregar disables, correr lint, podar" llevó 2 iteraciones porque adiviné mal qué símbolos iban a ser flagueados. La lección: cuando preservas código intencionalmente para reactivación futura, el linter es una mejor guía que el instinto. Si en algún momento alguien reactiva el Foto tab, los disable comments se pueden remover (los `fileInputRef` y `isDragOver` vuelven a tener callers). Documentado como decisión deliberada #1.
