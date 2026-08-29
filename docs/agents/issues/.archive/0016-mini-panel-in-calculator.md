---
label: feature
status: open
parent: 0012-saved-weight-records
phase: 4
adr: 0009-saved-weight-records
depends_on:
  - 0013-domain-and-storage
  - 0014-save-button-with-label
blocks:
  - 0017-full-history-page
affects:
  - src/app/tools/weight-calculator/_components/calculator-client.tsx
  - src/app/tools/weight-calculator/_components/saved-records-panel.tsx (new)
  - src/app/tools/weight-calculator/_components/saved-records-panel-row.tsx (new, optional)
---

# 0016 — Fase 4: Mini-panel de registros en la calculadora

## Contexto

Cuarta fase del umbrella [0012-saved-weight-records](./0012-saved-weight-records.md). Con la captura (issue 0014 manual, issue 0015 auto-log) ya en su lugar, esta fase introduce la primera **superficie de lectura**: un mini-panel dentro de la calculadora que muestra las últimas 5 cargas **etiquetadas** (no auto-log), con un botón `Cargar` que rehidrata el estado y un link al historial completo. La rareza del verde señal se preserva: el panel es informativo, no promocional.

Ver [ADR-0009](../adr/0009-saved-weight-records.md) § "UX: dónde vive" para el rationale de la ubicación (debajo del bar visualization, no sidebar) y por qué auto-log se excluye del panel.

## Tareas

### 1. Componente `saved-records-panel.tsx` (nuevo)

`src/app/tools/weight-calculator/_components/saved-records-panel.tsx`. Client-only.

Props:

```ts
interface SavedRecordsPanelProps {
  onLoad: (record: SavedWeightRecord) => void;
}
```

Comportamiento:

- Estado local: `records: SavedWeightRecord[]` (init `[]`).
- `useEffect`:
  1. En mount, `setRecords(getRecentRecords(5))`.
  2. Suscribirse a `window.addEventListener("storage", ...)` filtrando por `e.key === "pd:calculator-records"`. En cada event, re-llamar `getRecentRecords(5)`. Cleanup con `removeEventListener`.
- Render:
  - Si `records.length === 0`: empty state inline (ver más abajo).
  - Si `records.length > 0`: lista de filas + footer con link.

**Empty state**:

```tsx
<p className="font-sans text-sm text-mute leading-relaxed py-3 px-4 border border-dashed border-hairline rounded-sm">
  Todavía no guardaste cargas con nombre. Usá{" "}
  <span className="font-sans font-semibold text-bone">Guardar</span>{" "}
  abajo para registrar una.
</p>
```

(Estilo consistente con el empty state del mini-historial de CrossFit en `/generate/[modalityId]` — `font-sans text-sm text-mute leading-relaxed py-3 px-4 border border-dashed border-hairline rounded-sm`.)

**Contenedor con registros**:

```tsx
<section className="border border-hairline rounded-none bg-panel p-5 space-y-4">
  <header className="flex items-baseline justify-between">
    <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute">
      Registros
    </p>
    <span className="font-mono tabular-nums text-[0.6875rem] text-mute">
      {records.length} {records.length === 1 ? "carga" : "cargas"}
    </span>
  </header>
  <ul className="space-y-2">
    {records.map((r) => <SavedRecordRow key={r.id} record={r} onLoad={onLoad} />)}
  </ul>
  <footer className="pt-3 border-t border-hairline flex items-center justify-end">
    <Link
      href="/tools/weight-calculator/history"
      className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-signal hover:underline inline-flex items-center gap-1.5"
    >
      Ver historial completo
      <span aria-hidden>→</span>
    </Link>
  </footer>
</section>
```

### 2. Componente `SavedRecordRow`

Sub-componente (puede vivir en el mismo archivo o en `saved-records-panel-row.tsx` si crece). Client-only.

Props: `{ record: SavedWeightRecord; onLoad: (r: SavedWeightRecord) => void }`.

Render:

```tsx
<li className="flex items-center gap-3 px-2 py-1.5 border border-hairline rounded-sm bg-canvas/40">
  <div className="min-w-0 flex-1">
    <p className="font-display italic font-semibold text-base leading-tight text-bone truncate">
      {record.exercise ?? "(sin etiqueta)"}
    </p>
    <p className="font-mono tabular-nums text-sm text-bone mt-0.5">
      {record.totalKg.toFixed(1)} kg · {record.totalLb.toFixed(1)} lb
    </p>
    <p className="font-mono tabular-nums text-[0.8125rem] text-mute mt-0.5">
      {record.breakdownLine}
    </p>
  </div>
  <div className="flex flex-col items-end gap-1 shrink-0">
    <span className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute">
      {formatRelative(record.createdAt)}
    </span>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onLoad(record)}
      className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute hover:text-bone hover:bg-muted rounded-md h-7 px-2.5 gap-1.5"
      aria-label={`Cargar ${record.exercise ?? "esta carga"}`}
    >
      <ArrowDownToLine className="size-3.5" aria-hidden />
      Cargar
    </Button>
  </div>
</li>
```

### 3. Helper `formatRelative(iso: string): string`

Función pura local al archivo del panel (o exportada desde `lib/calculator/history.ts` si se quiere reusar). Devuelve:

- `ahora` si < 60s.
- `hace Xm` si < 60min.
- `hace Xh` si < 24h.
- `ayer` si entre 24h y 48h.
- `hace Xd` si entre 48h y 7d.
- `dd MMM` (formato `14 ago`) si > 7d. **No** usar locale full — el sistema es Spanish-only MVP.

Implementación:

```ts
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "ahora";
  if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `hace ${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 172800) return "ayer";
  if (diffSec < 604800) return `hace ${Math.floor(diffSec / 86400)}d`;
  const date = new Date(iso);
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}
```

(Si el equipo prefiere `Intl.RelativeTimeFormat("es", ...)`, queda como decisión de polish en el issue 0018. El default de este issue es el helper inline para no agregar dependencia de runtime ni locale negotiation.)

### 4. Integración en `calculator-client.tsx`

- Importar el panel.
- Estado local nuevo: `const [loadConfirm, setLoadConfirm] = useState<SavedWeightRecord | null>(null);` (el registro a cargar después de la confirmación).
- Renderizar `<SavedRecordsPanel onLoad={handleLoadRequest} />` **debajo** del `<BarVisualization />` y **sólo** en el Manual tab (no en Foto tab).
- Handler:

  ```ts
  function handleLoadRequest(record: SavedWeightRecord) {
    const currentState: CalculatorState = { barKg, discs: discs.map(toPersist) };
    const currentHash = hashState(currentState);
    const recordHash = hashState({ barKg: record.barKg, discs: record.discs });
    if (currentHash === recordHash) {
      // Ya está cargado, no-op silencioso
      return;
    }
    if (window.confirm(`Reemplazar la carga actual con "${record.exercise ?? "esta carga" }"?`)) {
      setBarKg(record.barKg);
      setDiscs(record.discs.map((d, ({ ...d, id: newDiscId() })));
      toast.success("Carga cargada");
    }
  }
  ```

  El `confirm` sólo aparece si el estado actual difiere del registro a cargar. Si el coach ya tiene ese estado en pantalla (caso raro pero posible — re-click accidental), no-op silencioso.

### 5. Icono `ArrowDownToLine`

Verificar que `lucide-react` lo exporta. Si no, usar `RotateCcw` o `Download` como fallback (todos los iconos ya están en uso en el proyecto). El nombre exacto en `lucide-react@1.25.0` (versión actual del proyecto) puede variar; verificar con `node -e "console.log(Object.keys(require('lucide-react')).filter(k => /download|arrow.*down|rotate/i.test(k)))"` antes de hacer el commit.

## Aceptación

- [ ] `npm run build` y `npm run lint` pasan.
- [ ] Manual: con cero registros guardados, el panel muestra el empty state.
- [ ] Manual: con 3+ registros manuales, el panel muestra los 5 más recientes (los más viejos se ocultan).
- [ ] Manual: los auto-logs **no** aparecen en el panel aunque haya 50 (sólo `exercise !== null`).
- [ ] Manual: el storage event re-renderiza el panel cuando se guarda desde el form (issue 0014) — abrir el panel, abrir el form en otra parte de la UI, guardar, el panel se actualiza sin refresh.
- [ ] Manual: cross-tab — abrir dos tabs con la calculadora, guardar en una, la otra actualiza al recibir el storage event.
- [ ] Manual: `Cargar` reescribe `barKg` y `discs`. Si el estado actual difiere, aparece `window.confirm`. Si acepta, toast "Carga cargada".
- [ ] Manual: `Cargar` cuando el estado actual ya es el mismo registro → no-op silencioso, sin confirm, sin toast.
- [ ] Manual: el link `Ver historial completo →` navega a `/tools/weight-calculator/history` (la ruta se crea en issue 0017, pero el link puede estar antes — la página dará 404 hasta que 0017 se mergee; documentar esto en el PR description).
- [ ] Mobile: cada registro es una card vertical con nombre, totales, fecha y botón `Cargar` (touch target ≥ 44px).

## Decisiones durables

- El mini-panel es **sólo etiquetado** (`exercise !== null`). Auto-log se excluye. Justificación: el panel es "lo que el coach consultará para volver a una carga"; el auto-log es telemetría histórica, no acceso rápido.
- `Cargar` pide `window.confirm` sólo si el draft actual difiere. Mismo umbral que el `Limpiar` actual de la calculadora.
- El panel se monta sólo en Manual tab. En Foto tab la atención está en el preview; añadir el panel allí competiría con la lectura del desglose.
- Sin sidebar (decisión ADR-0009 vs. ADR-0005). La calculadora mantiene single-column estricto.

## Out of scope

- La página completa de historial (issue 0017). El link `Ver historial completo →` puede quedar apuntando aunque la página aún no exista; el merge de 0017 lo hará funcional.
- Búsqueda o filtros en el panel (siempre son los últimos 5 etiquetados).
- Editar o eliminar registros desde el panel (sólo `Cargar`).

## Follow-ups (no en este PR)

- Si el panel crece mucho (e.g., se agregan notas, foto, etiquetas múltiples), evaluar virtualización.
- Si el coach pide filtro por ejercicio en el panel, se evalúa como issue separado.
- `Intl.RelativeTimeFormat` se evalúa en polish (0018) — la decisión default es el helper inline.
