---
label: feature
status: open
parent: 0012-saved-weight-records
phase: 3
adr: 0009-saved-weight-records
depends_on:
  - 0013-domain-and-storage
  - 0014-save-button-with-label
blocks: []
affects:
  - src/app/tools/weight-calculator/_components/calculator-client.tsx
---

# 0015 — Fase 3: Auto-log (watcher con debounce)

## Contexto

Tercera fase del umbrella [0012-saved-weight-records](./0012-saved-weight-records.md). El botón `Guardar` (issue 0014) cubre los registros **intencionales** del coach (con etiqueta de ejercicio). Esta fase agrega la red de seguridad pasiva: un watcher que registra automáticamente cada "punto estable" de la calculadora, sin intervención del usuario, con `source: "auto-log"` y `exercise: null`. Si el coach olvidó Guardar, el auto-log captura la sesión.

Ver [ADR-0009](../adr/0009-saved-weight-records.md) § "Auto-log: comportamiento" para el rationale (cap 200, dedupe por hash, pausa durante Foto).

## Tareas

### 1. Constantes y refs en `calculator-client.tsx`

```ts
const AUTO_LOG_DEBOUNCE_MS = 1500;
```

Refs nuevos:

```ts
const lastAutoLogHashRef = useRef<string | null>(null);
const fotoBusyRef = useRef<boolean>(false);
```

### 2. Pausa durante análisis Foto

Hay un `useEffect` existente que reacciona a `fotoState.kind`:

```ts
useEffect(() => {
  if (fotoState.kind !== "analyzing") {
    fotoStartRef.current = null;
    return;
  }
  // ... cronómetro analyzing
}, [fotoState.kind]);
```

Modificar para que también sincronice `fotoBusyRef`:

```ts
useEffect(() => {
  fotoBusyRef.current = fotoState.kind === "analyzing";
}, [fotoState.kind]);
```

(Ojo: `fotoBusyRef.current` se setea desde un effect que depende de `fotoState.kind`. La lectura se hace desde el effect del watcher; como es una `ref`, el watcher verá el valor actualizado en su próximo render/callback.)

### 3. Watcher con debounce

Nuevo `useEffect` en `calculator-client.tsx`:

```ts
useEffect(() => {
  // Skip durante análisis Foto
  if (fotoBusyRef.current) return;

  // Skip estado inicial puro
  if (discs.length === 0 && barKg === DEFAULT_BAR_KG) return;

  const currentHash = hashState({ barKg, discs });

  // Skip si es idéntico al último log
  if (currentHash === lastAutoLogHashRef.current) return;

  const id = setTimeout(() => {
    // Re-chequear por las dudas (Foto pudo haber arrancado durante el debounce)
    if (fotoBusyRef.current) return;
    if (discs.length === 0 && barKg === DEFAULT_BAR_KG) return;

    const totals = computeTotals({ barKg, discs });
    const record: SavedWeightRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      exercise: null,
      barKg,
      discs: discs.map(toPersist),
      totalKg: totals.totalKg,
      totalLb: totals.totalLb,
      breakdownLine: totals.breakdownLine,
      source: "auto-log",
    };
    addRecord(record);
    lastAutoLogHashRef.current = currentHash;
  }, AUTO_LOG_DEBOUNCE_MS);

  return () => clearTimeout(id);
}, [barKg, discs]);
```

Notas:

- El cleanup `clearTimeout` en cada cambio es lo que produce el debounce real.
- `lastAutoLogHashRef.current` se compara **antes** de programar el timeout para evitar programar trabajo que no va a hacer nada.
- El `useEffect` no depende de `fotoBusyRef` (es una ref; el check adentro es lo que cuenta).

### 4. Hidratación: reset del hash ref

El effect existente que hidrata desde `pd:calculator-state` ya existe. Después de hidratar, resetear el hash ref para que el primer cálculo post-hidratación se loguee si difiere del último logueado.

Modificar el effect de hidratación:

```ts
useEffect(() => {
  if (!hydrated || hasSyncedRef.current) return;
  hasSyncedRef.current = true;
  const saved = getCalculatorState();
  setBarKg(saved.barKg);
  setDiscs(saved.discs.map((d, i) => ({ ...d, id: `disc-${i}-${Date.now()}` })));
  // Inicializar el hash ref con el estado hidratado
  lastAutoLogHashRef.current = hashState({ barKg: saved.barKg, discs: saved.discs });
}, [hydrated]);
```

**Importante**: el hash ref arranca con el estado hidratado. Si el coach no toca nada, no se genera un auto-log. Si toca algo distinto al hash hidratado, se loguea. Si toca algo y vuelve al estado hidratado, el hash coincide y no se duplica.

### 5. Foto aplicado: registro inmediato

Cuando el usuario hace click en "Aplicar a la carga" en el Foto tab, el código actual hace:

```ts
function acceptFoto() {
  if (fotoState.kind !== "preview") return;
  setBarKg(fotoState.breakdown.barKg);
  setDiscs(fotoState.breakdown.discs.map((d) => ({ ...d, id: newDiscId() })));
  setFotoState({ kind: "idle" });
  setActiveTab("manual");
  toast.success("Carga aplicada");
}
```

Modificar para que también persista un registro inmediato con `source: "foto"`:

```ts
function acceptFoto() {
  if (fotoState.kind !== "preview") return;
  const { breakdown } = fotoState;
  setBarKg(breakdown.barKg);
  setDiscs(breakdown.discs.map((d) => ({ ...d, id: newDiscId() })));
  setFotoState({ kind: "idle" });
  setActiveTab("manual");
  toast.success("Carga aplicada");

  // Persistir registro inmediato con source: "foto"
  const totals = computeTotals({ barKg: breakdown.barKg, discs: breakdown.discs });
  const fotoRecord: SavedWeightRecord = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    exercise: null,
    barKg: breakdown.barKg,
    discs: breakdown.discs,
    totalKg: totals.totalKg,
    totalLb: totals.totalLb,
    breakdownLine: totals.breakdownLine,
    source: "foto",
  };
  addRecord(fotoRecord);
  lastAutoLogHashRef.current = hashState({ barKg: breakdown.barKg, discs: breakdown.discs });
}
```

**Por qué inmediato y no debounced**: si el coach aplica la foto y luego sigue editando, el watcher con debounce no va a capturar el "momento foto" — va a capturar el estado final. El `source: "foto"` se pierde. Persistir inmediato preserva la atribución.

**Por qué `addRecord` directo y no a través del `useEffect`**: el effect es responsable del auto-log; el `acceptFoto` es un evento discreto y debe tener su propia atribución.

## Aceptación

- [ ] `npm run build` y `npm run lint` pasan.
- [ ] Manual: cambiar la barra de 20 → 25, esperar 1500ms. En devtools, `pd:calculator-records` tiene una nueva entrada con `source: "auto-log"`, `barKg: 25`, `exercise: null`.
- [ ] Manual: cambiar la barra 25 → 20 → 25 rápido. **Sólo 1** auto-log (dedupe por hash).
- [ ] Manual: subir una foto, esperar el preview, click `Aplicar`. Inmediatamente hay un registro `source: "foto"`, `exercise: null` aunque el debounce no haya disparado.
- [ ] Manual: hardcodear 200 auto-logs en `localStorage` y agregar uno más. La cuenta vuelve a 200; el más antiguo se fue. Verificar que los `manual` y `foto` previos siguen intactos.
- [ ] Manual: refresh de la página. El primer cambio de barra después de refresh **sí** genera auto-log (porque el hash ref se resetea con el estado hidratado, y si el coach toca algo distinto, genera).
- [ ] Manual: refresh sin tocar nada, esperar 5s. **Cero** auto-logs nuevos.
- [ ] Manual: el contador de auto-logs se mantiene ≤ 200 incluso con uso intenso.
- [ ] Foto + edición: aplicar foto → editar un disco → el auto-log debounced genera una entrada `source: "auto-log"` con la edición (no se pierde la atribución de "foto" porque la del foto se persistió inmediato, antes del debounce).

## Decisiones durables

- `AUTO_LOG_DEBOUNCE_MS = 1500` es deliberadamente mayor que el debounce del draft save (`250`). Justificación: el draft save puede dispararse múltiples veces en una sesión de tipeo normal; el auto-log debe consolidar en un punto estable.
- El hash ref arranca con el estado **hidratado**, no con `null`. Esto evita el auto-log fantasma en mount.
- `source: "foto"` se persiste **inmediato** al aceptar el desglose, no espera el debounce. La atribución de origen es importante y no debe ser sobrescribible por la edición posterior.

## Out of scope

- UI del auto-log (no se muestra en el mini-panel, sólo en la página completa de historial). Eso lo cubre el issue 0017.
- Límite de frecuencia del watcher (e.g., "máximo 1 auto-log por segundo"). El dedupe por hash ya cubre el caso típico. Si el coach tipea cambios válidos muy rápido, generar N logs es esperado.
- Persistir la foto adjunta al registro. Los registros pesan ~200 bytes sin foto; 200 logs = ~40 KB, bien dentro del quota de `localStorage`.

## Follow-ups (no en este PR)

- Si en el futuro el equipo quiere mostrar un toast discreto "Carga auto-registrada" para feedback, se evalúa en polish (issue 0018). Decisión actual: **sin toast** — el auto-log es telemetría silenciosa, no debe interrumpir.
- Si el cap de 200 resulta muy bajo o muy alto en uso real, ajustar en un PR de tuning.
