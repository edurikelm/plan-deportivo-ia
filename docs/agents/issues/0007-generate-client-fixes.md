---
label: bug
status: open
created_at: 2026-07-28
---

## Resultado

(por completar cuando se cierre)

## What to build

Bugs y regresiones encontrados por el reviewer en el pase "impeccable" sobre `src/app/classes/[id]/generate/_components/generate-client.tsx`. Estos cambios tocan el **contrato de persistencia** y la **semántica de acciones**, así que van en issue aparte del commit estético ya mergeado.

### 1. Edit-then-save violado (crítico, B1)

`handleSubmit` ejecuta `addIdea(idea)` apenas aterriza el LLM. La salida cruda se persiste antes de que el Entrenador la edite, y el toast miente al decir "Plan generado y guardado". CONTEXT.md:32 y 80-88 son explícitos: "el `content` persistido refleja la versión final editada por el Entrenador".

**Fix**: no persistir al generar. Mantener la Idea únicamente en estado local (`setResult(idea)` sin `addIdea`). Persistir por primera vez en `handleSave` con `addIdea`. Ajustar el toast del submit para que diga "Plan generado" (sin "guardado").

### 2. Regenerar duplica Ideas con el mismo ID (crítico, B2)

`handleRegenerate` reusa `result.id` pero llama `addIdea(updated)`. Cada regeneración agrega otra entrada con el mismo UUID al array de `pd:ideas` → historial corrupto, `updateIdea` ambiguo.

**Fix**: la regeneración solo debe reemplazar el resultado local (`setResult(updated)` sin `addIdea`). `updateIdea` queda reservado para el caso "Idea ya persistida que el usuario re-edita después de guardar" (no aplica en el flujo normal).

### 3. CTA superior Regenerar llama a handleSubmit (alto, B3)

El botón del status strip cambia visualmente a "Regenerar" cuando ya hay resultado, pero sigue submit de `generate-form` (que dispara `handleSubmit`). Crea una Idea nueva con UUID nuevo, ignora el foco de la Idea, no pide confirmación ante cambios pendientes.

**Fix**: separar el botón del status strip del submit del form. Cuando hay resultado, el botón debe invocar `handleRegenerate` directamente (no `form="generate-form"`). Cuando no hay resultado, invocar `handleSubmit`. Misma apariencia, distinto handler según el estado.

### 4. Tokens CSS faltantes: `signal-deep` y `hairline-strong` (alto, B5)

`bg-signal-deep`, `text-signal-deep` y `text-hairline-strong` se usan en varios componentes pero **no existen en `@theme inline`**. El build pasa, pero los hovers y separadores quedan sin el color especificado por el brief.

**Fix**: declarar ambos tokens en el bloque `@theme inline` de `src/app/globals.css`:

```css
--color-signal-deep: oklch(0.78 0.16 130);
--color-hairline-strong: oklch(1 0 0 / 18%);
```

(no en `--color-hairline` que ya existe con otro nombre — son dos tokens distintos.)

### 5. Cronómetro: reset + intervalo 1000ms (medio, B12)

- `elapsed` no se resetea al iniciar un nuevo submit: durante ~250ms se ve el valor del request anterior.
- El brief pide actualización cada 1000ms; el código usa 250ms (sigue siendo fluido, pero el cronómetro se actualiza 4× más rápido de lo diseñado).

**Fix**: `setElapsed(0)` al inicio de `handleSubmit` y `handleRegenerate`. Cambiar el `setInterval` a 1000ms.

### 6. aria-live + cronómetro (medio, B9)

`aria-live="polite"` está sobre todo el status strip. Como el cronómetro cambia cada (ahora) 1000ms con un `aria-label` variable, el lector de pantalla anuncia el tiempo repetidamente durante toda la espera.

**Fix**: mover `aria-live="polite"` solo al label "Generando" del cronómetro (no al strip entero). Idealmente, anunciar una vez al entrar en `busy=true`, y otra al terminar (éxito o error).

### 7. `chalk-card-reveal` no respeta prefers-reduced-motion (alto, B7)

Solo la transición de `.status-strip` se desactiva bajo `prefers-reduced-motion: reduce`. La animación de entrada de la chalk card sigue aplicando opacity + translate.

**Fix**: en `src/app/globals.css`, dentro del media query existente, añadir:

```css
@media (prefers-reduced-motion: reduce) {
  .status-strip { transition: none; }
  .chalk-card-reveal { animation: none; }
}
```

### 8. Hover de cards usa signal en vez de hairline-strong (medio, B11)

`classes-list-client.tsx` aplica `hover:border-l-signal` en las cards. Brief y DESIGN.md dicen que el hover es "el hairline pasa de 10% a 18%" (o sea, `hairline-strong`). Consumir signal en hover viola la Single-Voice Rule (signal reservado para CTAs primarias).

**Fix**: cambiar a `hover:border-hairline-strong` (cuando el token B5 esté agregado) o usar un border de un solo paso más alto en `oklch(1 0 0 / 18%)` mientras tanto. La "Single-Voice Rule" del brief es estricta.

### 9. 404 con CTA signal (bajo)

El 404 dentro de `generate-client.tsx` (cuando `clase` no existe) usa un botón primary signal para "Volver a Mis Clases". El reviewer recomienda outline/ghost porque la recuperación no es acción primaria.

**Fix**: cambiar a `variant="ghost"` con `text-bone bg-transparent hover:bg-muted`. (Mismo patrón ya aplicado al 404 de `edit-class-page-client.tsx` en este pase.)

### 10. Form sigue visible post-generación (alto, B10)

Brief `classes-id-generate.md:34` dice "la chalk card reemplaza el form". El código mantiene ambos visibles (el textarea de foco arriba, la chalk card abajo). Funcionalmente el Entrenador puede re-tipear foco y regenerar, pero la lectura del brief pide un reemplazo.

**Decisión**: o se oculta/reemplaza el form (alineado con brief), o se actualiza el brief explícitamente declarando que ambos coexisten. **Pedir input al usuario antes de implementar.**

## Acceptance criteria

- [ ] (B1) `handleSubmit` no llama a `addIdea`. La primera persistencia ocurre en `handleSave`.
- [ ] (B1) El toast del submit dice "Plan generado" (no "...y guardado").
- [ ] (B2) `handleRegenerate` no llama a `addIdea`. Solo `setResult(updated)` local.
- [ ] (B3) El CTA del status strip dispatchea a `handleRegenerate` cuando hay resultado, `handleSubmit` cuando no.
- [ ] (B5) `signal-deep` y `hairline-strong` están declarados en `@theme inline` y producen CSS válido.
- [ ] (B7) `chalk-card-reveal` se desactiva bajo `prefers-reduced-motion: reduce`.
- [ ] (B8) Cronómetro: reset al iniciar, intervalo 1000ms.
- [ ] (B9) `aria-live` limitado al label del cronómetro; no anuncia repetidamente.
- [ ] (B11) Hover de cards usa `hairline-strong`, no signal.
- [ ] (B10) Decisión registrada: ocultar form post-generación, o actualizar brief.
- [ ] (404) CTA del 404 en generate-client es ghost, no signal.
- [ ] `npm run lint` y `npm run build` pasan con 0 warnings.
- [ ] Smoke manual: generar → editar → guardar → regenerar → editar → guardar. Una sola Idea por `pd:ideas` después del flujo completo.

## Blocked by

- 143a1ed (commit estético ya mergeado, provee el contexto).

## References

- CONTEXT.md:32, 80-88 (contrato edit-then-save)
- DESIGN.md:90-94 (Single-Voice Rule, Rarity Rule)
- .impeccable/surface-briefs/classes-id-generate.md (estado y comportamiento esperado del flujo)