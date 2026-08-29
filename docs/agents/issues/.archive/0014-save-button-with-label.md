---
label: feature
status: open
parent: 0012-saved-weight-records
phase: 2
adr: 0009-saved-weight-records
depends_on:
  - 0013-domain-and-storage
blocks:
  - 0016-mini-panel-in-calculator
affects:
  - src/app/tools/weight-calculator/_components/calculator-client.tsx
  - src/app/tools/weight-calculator/_components/save-record-form.tsx (new)
---

# 0014 — Fase 2: Botón Guardar con etiqueta (form inline en footer)

## Contexto

Segunda fase del umbrella [0012-saved-weight-records](./0012-saved-weight-records.md). Con el modelo de datos y los helpers ya en su lugar (issue 0013), esta fase introduce el primer punto visible para el coach: un botón `Guardar` en el footer sticky de la calculadora que abre un **form inline** con un campo obligatorio `Ejercicio`. Al submit, persiste un `SavedWeightRecord` con `source: "manual"` y `exercise` poblado.

Ver [ADR-0009](../adr/0009-saved-weight-records.md) § "Botón Guardar con etiqueta" para el rationale del form inline vs. modal/drawer.

## Tareas

### 1. Componente `save-record-form.tsx` (nuevo)

`src/app/tools/weight-calculator/_components/save-record-form.tsx`. Client-only.

Props:

```ts
interface SaveRecordFormProps {
  currentState: { barKg: number; discs: DiscRow[] };
  onSaved: (record: SavedWeightRecord) => void;
  onCancel: () => void;
  defaultExercise?: string;
}
```

Comportamiento:

- Estado local: `exercise: string` (init `defaultExercise ?? ""`).
- Render:
  - Label visible `Ejercicio` (estilo label uppercase tracking-plus + mute, consistente con el resto del footer de la calculadora).
  - Input text con `list="exercise-history"` y un `<datalist id="exercise-history">` cuyas `<option>` vienen de `getUniqueExercises()`. **El datalist se computa en cada mount** — no se subscribe a storage events aquí (el mini-panel de Fase 4 lo hará si necesita reactivo).
  - Botón primario `Guardar` (signal, deshabilitado si `exercise.trim() === ""`).
  - Botón ghost `Cancelar`.
- Submit (en un form `<form onSubmit={...}>`):
  1. `const name = exercise.trim()`; si `""` → return.
  2. `const totals = computeTotals(currentState)`.
  3. Construir `record: SavedWeightRecord = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), exercise: name, barKg: currentState.barKg, discs: currentState.discs, totalKg: totals.totalKg, totalLb: totals.totalLb, breakdownLine: totals.breakdownLine, source: "manual" }`.
  4. `addRecord(record)`.
  5. `toast.success("Carga guardada")`.
  6. `onSaved(record)` (padre cierra el form).
- Escape (`onKeyDown` en el input o document listener cuando está abierto): llama `onCancel()`.

No hacer un `useEffect` que cierre el form en mount — el form es controlado por el padre (open/closed).

### 2. Integración en `calculator-client.tsx`

En `src/app/tools/weight-calculator/_components/calculator-client.tsx`:

- Estado local nuevo: `const [saveFormOpen, setSaveFormOpen] = useState(false);`.
- En el footer sticky existente (`<footer className="sticky bottom-0 ...">`), agregar un botón `Guardar` **a la izquierda del botón `Copiar`**:

  ```tsx
  <Button
    variant="ghost"
    size="sm"
    onClick={() => setSaveFormOpen(true)}
    disabled={discs.length === 0 && barKg === DEFAULT_BAR_KG}
    aria-label="Guardar carga con etiqueta"
    className="... existing styling ..."
  >
    <BookmarkPlus className="size-3.5" aria-hidden /> {/* lucide */}
    Guardar
  </Button>
  ```

  - Usar el ícono `BookmarkPlus` de `lucide-react` (consistente con la paleta de iconos del proyecto: ya hay `Plus`, `Save` equivalentes; el más semántico para "registrar" es `BookmarkPlus`).
  - `disabled` cuando no hay carga real: `discs.length === 0 && barKg === DEFAULT_BAR_KG` (el state inicial puro). El tooltip lo agrega el `title` attr.

- Cuando `saveFormOpen === true`, el footer sticky se **expande** con el `<SaveRecordForm />` debajo de los botones. Layout:

  ```tsx
  <footer className="sticky bottom-0 bg-canvas border-t border-hairline">
    <div className="mx-auto max-w-2xl px-5 md:px-8 py-4 flex flex-col gap-3">
      {saveFormOpen ? (
        <SaveRecordForm
          currentState={{ barKg, discs: discs.map(toPersist) }}
          onSaved={() => setSaveFormOpen(false)}
          onCancel={() => setSaveFormOpen(false)}
        />
      ) : null}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        {/* bloque existente con totales, Copiar, Guardar */}
      </div>
    </div>
  </footer>
  ```

  El form va **arriba** de los totales y el botón `Copiar` (los totales siempre quedan visibles abajo). Esto preserva la visibilidad del "Total" incluso mientras se tipea el nombre del ejercicio.

- Al abrir el form, **auto-focus** en el input de ejercicio. Se puede lograr con un `ref` que el padre pasa al `<SaveRecordForm />` o que el form expone vía `forwardRef`; la primera es más simple.

### 3. (Opcional pero recomendado) Keyboard shortcut `Cmd/Ctrl+S`

Mientras el form está abierto, interceptar `Cmd+S` (Mac) o `Ctrl+S` (Windows/Linux) para submit. **Default**: no implementar. Si el equipo lo quiere como nice-to-have, agregar un `useEffect` con un listener `keydown` que sólo se monta cuando `saveFormOpen === true`. Documentar la decisión en el PR description.

## Aceptación

- [ ] `npm run build` y `npm run lint` pasan.
- [ ] Manual: con `bar=20, discs=[{25,kg,1}]`, click `Guardar` → aparece el form inline. Tipear "Back Squat", click `Guardar` → toast "Carga guardada", form se cierra, totales siguen visibles.
- [ ] Manual: con `bar=20, discs=[]` (defaults), el botón `Guardar` está disabled. Hover muestra tooltip "Sin carga para guardar" (o el copy equivalente; usar `title` attr).
- [ ] Manual: submit con `exercise = "   "` (whitespace) está bloqueado (botón disabled).
- [ ] Manual: Escape cierra el form sin guardar.
- [ ] Manual: el datalist sugiere ejercicios previamente guardados (crear uno primero, recargar, abrir el form, tipear la primera letra → aparece el datalist).
- [ ] Manual: refresh de la página, el registro persiste en `localStorage` (`pd:calculator-records`).
- [ ] Mobile (≤ 640px): el form y los botones se apilan correctamente; el footer sticky no se rompe; el "Total" sigue visible mientras el form está abierto.
- [ ] A11y: el input tiene `<label htmlFor>` correcto, el botón submit es focuseable, Escape funciona.
- [ ] No `console.warn` ni `console.error` durante el flujo normal.

## Decisiones durables

- El botón `Guardar` es **ghost** (no signal primario). El primario del footer sigue siendo el `Total` (que es read-only) y, cuando esté el form abierto, el `Guardar` interno del form (signal). Esto preserva la rareza del verde señal.
- El form va **arriba** de los totales en el footer, no abajo — para que el coach siempre vea el peso que está guardando mientras tipea el nombre del ejercicio.
- El form **no** es un modal ni un drawer. Es un panel dentro del footer sticky que se expande. Decisión documentada en ADR-0009.

## Out of scope

- El mini-panel de últimas 5 cargas (issue 0016). Esta fase sólo crea registros; no los muestra.
- La página completa de historial (issue 0017).
- El auto-log pasivo (issue 0015).
- Editar un registro existente (sólo crear).
- Atajos de teclado (Cmd/Ctrl+S) — nice-to-have, no parte del acceptance.

## Follow-ups (no en este PR)

- Si en el futuro se quiere un modal dedicado (e.g., para tomar foto adjunta al registro), se evalúa como issue separado.
- Si el form inline no cabe en mobile (cuando se agreguen más campos como notas), evaluar sheet lateral (mismo patrón ADR-0005).
