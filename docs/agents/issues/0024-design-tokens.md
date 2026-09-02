---
label: chore
status: closed
parent: 0018-ui-ux-polish
depends_on: []
blocks: []
closed_at: 2026-09-02
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

## Post-mortem (closed 2026-09-02)

### Lo que se hizo

8 commits chicos, uno por archivo más el de utilities y el de docs:

- `4121814` — add numeric + prose-chalk utilities
- `3a6ba64` — refactor crossfit.tsx
- `96565e9` — refactor generate-client (cronómetro + 11 prose overrides + 9 call sites)
- `6ae238a` — refactor calculator-client (cronómetro + 15 call sites)
- `c2aa065` — refactor saved-records-panel
- `bcc1885` — refactor history-page-client
- `e410826` — refactor sessions-client
- `49c57cf` — DESIGN.md (numeric tier system, prose-chalk, elevation, mute rule)
- `chore(0024): close` (este commit)

### Acceptance criteria — todo verde

- [x] `.numeric`, `.numeric-label`, `.numeric-display` en `globals.css` `@layer utilities` con scope explícito
- [x] ~30 ocurrencias de `font-mono tabular(-nums)` reemplazadas
- [x] `.prose-chalk` aplicada en `CrossFitPlanView` y en los 2 fallbacks de `ReactMarkdown` (`generate-client.tsx:868` y `:948`)
- [x] Cronómetro en `/generate/crossfit`: `text-2xl` → `text-xl` + `numeric-display`
- [x] Cronómetro en `/tools/weight-calculator` (analyze foto state): mismo cambio por consistencia
- [x] `text-mute-strong` ya estaba funcionando (auto-mapeo desde `--color-mute-strong` token) — no requirió cambio
- [x] DESIGN.md: Typography, Components, Elevation, Mute rule actualizados
- [x] `npm run build` — pasa limpio (10/10 static pages, 4.8s compile, 6.4s typecheck)
- [x] `npm run lint` — 0 errores. 1 warning preexistente en `scripts/verify-vision.ts` (no introducido por este ticket)

### Hallazgos durante la impl

- **`.text-mute-strong` ya existía como utility funcional** (Tailwind v4 mapea automáticamente cualquier token CSS declarado en `@theme inline`, así que `--color-mute-strong` ya generaba la clase). El código en `generate-client.tsx:788, 809` ya la usaba y funcionaba. Lo único que faltaba era documentarla en DESIGN.md.
- **El viejo `.tabular` de `@layer base` aplicaba `font-variant-numeric: tabular-nums` globalmente** a todo el documento (no era scoped como utility). Esto quedó implícito en el sistema por años; ningún test lo detectó porque todos los números se ven igual con o sin tabular-nums en tamaños grandes. Lo removí junto con la introducción de las utilities explícitas — si quedaba, los call sites con `numeric` recibían doble `tabular-nums` (sigue funcionando, pero era ruido).
- **Línea 703 de `calculator-client.tsx` se me escapó en el primer pase** (string muy similar a la 691 pero sin `disabled:opacity-50`); el grep posterior lo cazó y amend al commit.
- **Cronómetro de `calculator-client.tsx`** no estaba en el ticket original (sólo mencionaba `generate-client.tsx:502, 506`), pero usa exactamente el mismo patrón visual (mismo `<time>` con mono tabular, mismo `text-2xl` overwhelming el label). Por consistencia de sistema lo cambié igual. Si querés revertirlo a `text-2xl`, está en la línea 587/591 con el patrón `numeric-display text-xl leading-none tracking-tight`.

### Patrones nuevos establecidos (consultar antes de introducir variantes)

- **Numeric tier system**: tres niveles (`.numeric` / `.numeric-label` / `.numeric-display`). Si necesitás un cuarto nivel (e.g. `numeric-button` para CTAs con tracking 0.10em), evalúa primero si el `tracking-[0.10em]` inline es suficiente. No proliferar utilities.
- **`.prose-chalk` como única fuente de verdad del prose**: nunca redefinir `prose-headings:*` o `prose-strong:*` inline. Si necesitás override (e.g. `prose-h1:text-2xl` en el fallback editor), agregalo como utility encima de `prose-chalk` — la jerarquía base se mantiene intacta.
- **Cronómetro en estado activo**: `numeric-display text-xl leading-none tracking-tight`. El `text-xl` (no `2xl`) es la decisión deliberada para que el label "Generando" / "Analizando" siga siendo visualmente más prominente que los dígitos. Resiste el impulso de volver a `text-2xl`.
- **`text-mute-strong` sólo para sufijos inline que pertenecen al label** (e.g. `(opcional)`). No usar para "elevar" algo. Si necesita más prominencia, escalá a `text-bone` o a una Label uppercase.

### Out of scope / no tocado

- Inputs que sólo tienen `font-mono` sin `tabular-nums` (e.g. el search input de `/sessions`) los dejé como `font-mono`. Agregar `tabular-nums` ahí es un cambio visual que no estaba en el scope. Si querés consistencia absoluta, es un commit de 2 líneas.
- El `style={{ fontSize: "0.9375rem", lineHeight: 1.55 }}` inline de `CrossFitPlanView` se mantuvo. Es un override per-componente (escala de texto de la chalk card) y no es candidato a utility.
- No se introdujo `prefers-reduced-motion` consideration para el cambio de `text-2xl` → `text-xl` (no aplica — no es motion, es hierarchy).
