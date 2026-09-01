---
label: chore
status: open
parent: 0018-ui-ux-polish
depends_on: []
blocks: []
---

# 0024 — Design tokens: .numeric, .prose-chalk, cronómetro hierarchy

## Parent

[0018 — UI/UX polish: guards, history completeness, design tokens](../0018-ui-ux-polish.md)

## What to build

Tres mejoras de consistencia visual que el system ya demanda pero hoy aplica con overrides inline repetidos. Centraliza como utilities del design system.

1. **`.numeric` utility class en `globals.css:203` (capa `@layer utilities`).**
   ```css
   .numeric {
     font-family: var(--font-mono);
     font-variant-numeric: tabular-nums;
   }
   .numeric-label {
     font-family: var(--font-mono);
     font-variant-numeric: tabular-nums;
     letter-spacing: 0.04em;
   }
   .numeric-display {
     font-family: var(--font-mono);
     font-variant-numeric: tabular-nums;
     font-feature-settings: "tnum" 1, "cv11";
   }
   ```
   - Reemplazar las ~30 ocurrencias de `font-mono tabular` (con o sin `tracking-[0.04em]`) por `numeric` o `numeric-label`.
   - `numeric-display` se usa en el cronómetro y en IDs visibles donde se quiere la `font-feature-settings` completa.

2. **`.prose-chalk` utility class** que centraliza los overrides de `prose prose-invert` que hoy viven inline en 2 lugares distintos (`CrossFitPlanView` y fallback `ReactMarkdown`). Definir en `globals.css:203`:
   ```css
   .prose-chalk {
     max-width: 65ch;
   }
   .prose-chalk :where(p) {
     margin-block: 0.75rem;
     line-height: 1.55;
   }
   .prose-chalk :where(h1, h2, h3, h4) {
     font-family: var(--font-display);
     font-style: italic;
     letter-spacing: -0.015em;
     margin-top: 1.25rem;
     margin-bottom: 0.5rem;
   }
   .prose-chalk :where(strong) {
     color: var(--foreground);
   }
   .prose-chalk :where(code) {
     font-family: var(--font-mono);
     color: var(--foreground);
   }
   .prose-chalk :where(li) {
     margin-block: 0.25rem;
   }
   ```
   - Reemplazar las dos definiciones inline por `<div className="prose prose-invert prose-chalk ...">`.

3. **Cronómetro jerarquía** en `generate-client.tsx:502, 506` — cambiar `text-2xl` por `text-xl` en los dígitos del tiempo. El label "Generando" sigue en `text-[0.6875rem]`. Verificar visualmente que la jerarquía se lee "Generando > 00:13" cuando el status strip está en estado activo.

4. **`.text-mute-strong`** utility para resolver la ambigüedad del label `(opcional)` (item #11 del review). Define el color en `globals.css:14-77` (theme block) o en `@layer utilities`. Aplicar solo a los sufijos `(opcional)` de `focusMovement` y `considerations` en `generate-client.tsx:672, 693`.

5. **Documentar en `DESIGN.md`**:
   - Typography section: agregar `.numeric`, `.numeric-label`, `.numeric-display` como utilities oficiales.
   - Components section: agregar `.prose-chalk` como utility de prose styling unificado.
   - Elevation section: agregar la jerarquía `canvas < panel < popover` (item #21 del review, implícita hoy).
   - `text-mute` vs `text-mute-strong`: aclarar la regla de uso.

6. **Caveat del refactor masivo de `font-mono tabular`**: hacerlo en commits chicos por archivo para no introducir regresiones. Si el count de ocurrencias es muy alto, hacerlo en un solo PR bien testeado con screenshot comparison. El refactor es puramente cosmético.

Sin cambios de schema, sin nuevas keys de storage, sin cambios funcionales.

## Blocked by

None — can start immediately.

## Acceptance criteria

- [ ] `.numeric`, `.numeric-label`, `.numeric-display` están definidas en `globals.css:203`.
- [ ] Las ocurrencias de `font-mono tabular` en `generate-client.tsx`, `crossfit.tsx`, `calculator-client.tsx` y otros lugares relevantes están reemplazadas por `numeric` o `numeric-label` según contexto.
- [ ] `.prose-chalk` está definida y aplicada en `CrossFitPlanView` (`crossfit.tsx:54-68`) y en el fallback `ReactMarkdown` de `generate-client.tsx:752-757`.
- [ ] El aspect ratio del prose es idéntico entre `CrossFitPlanView` y el fallback de `ReactMarkdown` (verificable con screenshot side-by-side).
- [ ] El cronómetro del status strip usa `text-xl` (no `text-2xl`) para los dígitos.
- [ ] El label "Generando" sigue en `text-[0.6875rem]` (sin cambios).
- [ ] Los sufijos `(opcional)` en `focusMovement` y `considerations` usan `.text-mute-strong` y son visualmente distinguibles de los placeholders.
- [ ] `DESIGN.md` documenta los nuevos utilities en la sección apropiada.
- [ ] `DESIGN.md` aclara la jerarquía `canvas < panel < popover` en la sección Elevation.
- [ ] `DESIGN.md` aclara la regla `text-mute` vs `text-mute-strong` (cuándo usar cada uno).
- [ ] `npm run build` pasa.
- [ ] `npm run lint` pasa.
- [ ] No hay regresiones visuales: el screenshot de una sesión CrossFit renderizada debe ser idéntico antes y después del refactor (más allá del cronómetro, que cambia de `text-2xl` a `text-xl`).

## Manual end-to-end test

### Setup

- `npm run dev` y abrir `http://localhost:3000/classes`.
- Generar y guardar al menos 2 sesiones CrossFit (variedad de wodFormat para testear prose-chalk en ambos paths).

### Steps

1. **`.numeric` en acción.**
   - Abrir `/classes`. Mirar las fechas en los items del catálogo.
   - Expect: las cifras están en mono tabular (no se desplazan al cambiar de número).

2. **`.numeric-label` en mini-historial.**
   - Ir a `/generate/crossfit`. Mirar el meta del mini-historial: `dd/mm · 60 min`.
   - Expect: el `·` y los números están en mono tabular, con tracking `0.04em`.

3. **`.prose-chalk` unificado.**
   - Render de `CrossFitPlanView` (sesión nueva con `structured` no null): capturar screenshot.
   - Render del fallback `ReactMarkdown` (sesión pre-0011 con `structured: null`): capturar screenshot.
   - Comparar: el line-height de párrafos, el margin de headings, el estilo de `<strong>` y `<code>`, el `<li>` spacing deben ser idénticos.
   - Ambos respetan `max-width: 65ch`.

4. **Cronómetro jerarquía.**
   - En `/generate/crossfit`, completar el form y tocar `Generar`. Inmediatamente el status strip se llena con signal green.
   - Mirar el cronómetro. El label "Generando" debe ser visualmente más prominente que los dígitos `00:13`.
   - Capturar screenshot en estado activo para comparación futura.

5. **`text-mute-strong` en los label suffixes.**
   - Mirar los labels de `Foco de movimiento` y `Consideraciones del entrenador`. El sufijo `(opcional)` debe ser visiblemente más claro que el texto placeholder debajo.

6. **DESIGN.md actualizado.**
   - Abrir `DESIGN.md`. Verificar:
     - Typography section menciona `.numeric`, `.numeric-label`, `.numeric-display`.
     - Components section menciona `.prose-chalk`.
     - Elevation section tiene la jerarquía `canvas < panel < popover` explícita.
     - Hay una nota sobre `text-mute` vs `text-mute-strong` (cuándo usar cada uno).

7. **Build + lint clean.**
   - `npm run build` debe pasar sin errores ni warnings nuevos.
   - `npm run lint` debe pasar sin warnings nuevos.

8. **Visual regression.**
   - Comparar la home `/classes` antes y después: idéntica visualmente.
   - Comparar `/generate/crossfit` con una sesión renderizada antes y después: idéntica visualmente (excepto el cronómetro que cambia de `text-2xl` a `text-xl`).
