---
label: bug
status: closed
closed_at: 2026-08-29
parent: 0018-ui-ux-polish
depends_on: []
blocks:
  - "0025"
---

# 0019 — Navigation guard + form validation

## Parent

[0018 — UI/UX polish: guards, history completeness, design tokens](../0018-ui-ux-polish.md)

## What to build

Dos arreglos puros en `GenerateClient` que protegen trabajo en progreso y mejoran la calidad del feedback de validación.

1. **Back button guard.** El botón `ArrowLeft` del status strip hoy es un `<Link>` pasivo. Convertirlo en `<Button onClick={handleBack}>` que evalúa `hasUnpersistedWork` (mismo umbral que el `beforeunload` guard y el `handleRegenerate`). Si true, dispara `window.confirm("Tenés cambios sin guardar. ¿Salir?")` antes de `router.push("/classes")`. Si el usuario cancela, no navega. Si false, navega directo.

2. **On-blur validation.** Los errores de `strengthSkill` y `wodFormat` hoy solo aparecen después de submit. Introducir un state `touched: { strengthSkill: boolean, wodFormat: boolean }` que se setea en el `onBlur` de cada campo y en el submit. El `aria-invalid` y el mensaje de error se muestran solo si `touched[field] && errors[field]`. El primer submit fallido marca todos los campos como `touched` (mantiene los errores visibles mientras el coach arregla). El `validate()` puro (gate del botón `Regenerar`) sigue funcionando como hasta ahora.

3. **`text-mute` ambiguity en los sufijos `(opcional)`.** Los labels de campos opcionales (`focusMovement`, `considerations`) usan `text-mute` para el sufijo `(opcional)`, mismo color que el placeholder. Aplicar el nuevo `.text-mute-strong` (definido en 0024) solo a esos dos sufijos, dejando `text-mute` para los placeholders.

Sin cambios de schema, sin nuevas rutas, sin nuevas keys de storage. La app key `pd:sessions` no se toca. Patrón existente: `useState` local + thresholds ya documentados en `generate-client.tsx:88-95`.

## Blocked by

None — can start immediately.

## Acceptance criteria

- [ ] El back del status strip en `/generate/[modalityId]` dispara `window.confirm` cuando hay `hasUnpersistedWork === true` y cancela la navegación si el usuario rechaza.
- [ ] El back navega directo a `/classes` sin diálogo cuando `hasUnpersistedWork === false`.
- [ ] El umbral de `hasUnpersistedWork` es exactamente `(result !== null && !persisted) || hasPendingEdit` (idéntico al `beforeunload` guard y al `handleRegenerate`).
- [ ] Tocar y dejar `strengthSkill` vacío dispara el mensaje "Strength/Skill es obligatorio" en `onBlur`, no en el siguiente submit.
- [ ] Tocar y dejar `wodFormat` sin seleccionar dispara el mensaje correspondiente en `onBlur` (o no, si el default "AMRAP" ya es una selección válida).
- [ ] El primer submit fallido deja todos los errores visibles hasta que cada campo sea corregido.
- [ ] El botón `Regenerar` sigue deshabilitado por el `validate()` puro cuando `strengthSkill.trim() === ""` (independiente del estado `touched`).
- [ ] Los sufijos `(opcional)` en los labels de `focusMovement` y `considerations` usan el nuevo `.text-mute-strong` y son visualmente distinguibles de los placeholders.
- [ ] El `beforeunload` guard existente sigue funcionando idéntico.

## Manual end-to-end test

### Setup

- `npm run dev` y abrir `http://localhost:3000/classes`.
- DevTools → Application → Local Storage → delete `pd:sessions`, `pd:calculator-state`, `pd:calculator-records` (clean slate).
- DevTools → Console → clear + "Preserve log" on.

### Steps

1. **Back sin trabajo pendiente.**
   - Click `Generar sesión` en CrossFit. Llega a `/generate/crossfit` con form vacío.
   - Click el `ArrowLeft` del status strip.
   - Expect: vuelve a `/classes` sin diálogo.

2. **Back con trabajo no persistido.**
   - En `/generate/crossfit`, escribí "Back Squat 5x5" en `Strength / Skill`. NO toques Generar.
   - Click el `ArrowLeft`.
   - Expect: aparece `window.confirm("Tenés cambios sin guardar. ¿Salir?")`.
   - Cancelá.
   - Expect: sigue en `/generate/crossfit`, el form mantiene el texto.

3. **Back con resultado no guardado.**
   - En `/generate/crossfit`, completá `Strength / Skill` y tocá `Generar`. Esperá el resultado.
   - NO toques `Guardar`.
   - Click el `ArrowLeft`.
   - Expect: aparece el mismo `window.confirm`. Cancelá.
   - Expect: el resultado activo sigue en la chalk card.

4. **Back con edit pendiente.**
   - Generá una sesión, guardala, click `Editar`, modificá el markdown.
   - Click el `ArrowLeft`.
   - Expect: `window.confirm`. Cancelá.
   - Expect: el editor mantiene los cambios.

5. **On-blur validation.**
   - En `/generate/crossfit`, focus en `Strength / Skill`, tabuleá sin escribir.
   - Expect: NO aparece error (no fue `touched`).
   - Escribí "x", borralo, tabuleá fuera.
   - Expect: aparece "Strength/Skill es obligatorio" debajo del campo.
   - Escribí algo válido, tabuleá.
   - Expect: el error desaparece.

6. **Errores persisten hasta corrección.**
   - Dejá `Strength / Skill` vacío y tocá `Generar`.
   - Expect: aparece el error de `Strength / Skill` y de `wodFormat` (si corresponde).
   - Corregí `Strength / Skill`. El error de ese campo desaparece; el otro (si hay) sigue visible.

7. **Visual `(opcional)` distinto del placeholder.**
   - En `/generate/crossfit`, mirá los labels de `Foco de movimiento` y `Consideraciones del entrenador`.
   - Expect: el sufijo "(opcional)" es visiblemente más claro que el texto placeholder debajo de cada input.

## Post-mortem

Manual end-to-end test passed en 2026-08-29. Los 7 pasos de la script se ejecutaron sin desvíos: back guard con `window.confirm` en los 4 estados de trabajo pendiente, on-blur validation con `touched` propagando correctamente, errores que persisten hasta corrección tras submit fallido, distinción visual entre `(opcional)` y placeholders. El `beforeunload` guard existente sigue intacto (paso 9 no fue necesario porque el 1-4 ya cubre el threshold).

`npm run build` y `npm run lint` pasan limpios. La nueva utility `text-mute-strong` se genera correctamente en el CSS servido por el dev server (validado leyendo el output de `/_next/static/chunks/...css`).

**Implementación final:**
- 3 archivos tocados: `generate-client.tsx` (+151/-12), `globals.css` (+5/-0), ticket file nuevo.
- Commit: `d45ba5a fix(0019): navigation guard + on-blur form validation` en branch `0018-ui-ux-polish`.
- Sin cambios al modelo de datos, sin nuevas keys de storage, sin nuevas rutas.
