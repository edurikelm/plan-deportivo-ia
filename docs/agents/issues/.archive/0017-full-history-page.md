---
label: feature
status: open
parent: 0012-saved-weight-records
phase: 5
adr: 0009-saved-weight-records
depends_on:
  - 0013-domain-and-storage
  - 0016-mini-panel-in-calculator
blocks:
  - 0018-polish-and-edge-cases
affects:
  - src/app/tools/weight-calculator/history/page.tsx (new)
  - src/app/tools/weight-calculator/history/_components/history-client.tsx (new)
  - src/app/tools/weight-calculator/history/_components/history-row.tsx (new)
---

# 0017 — Fase 5: Página completa `/tools/weight-calculator/history`

## Contexto

Quinta fase del umbrella [0012-saved-weight-records](./0012-saved-weight-records.md). El mini-panel (issue 0016) muestra los últimos 5 registros etiquetados. Esta fase introduce la **vista completa**: una ruta dedicada `/tools/weight-calculator/history` que lista todos los registros (etiquetados + auto-log), con búsqueda, filtros por source, sort, y acciones por fila (`Cargar`, `Copiar`, `Eliminar`).

Ver [ADR-0009](../adr/0009-saved-weight-records.md) § "UX: dónde vive" para el rationale de la ruta dedicada. Decisión deliberada: single-page, no dashboard con widgets. La página es una tabla/lista operable, no un informe.

## Tareas

### 1. Server shell: `history/page.tsx`

`src/app/tools/weight-calculator/history/page.tsx`. Server component.

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { HistoryClient } from "./_components/history-client";

export const metadata: Metadata = {
  title: "Historial — Calculadora de Pesos",
};

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="status-strip" data-state="idle">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<Link href="/tools/weight-calculator" />}
            aria-label="Volver a la calculadora"
            className="rounded-md text-mute hover:text-bone hover:bg-transparent"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="font-display italic font-semibold text-lg leading-none tracking-tight">
            Historial de cargas
          </h1>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 md:px-8 pt-6 pb-32">
        <HistoryClient />
      </main>
    </div>
  );
}
```

Notas:
- `max-w-2xl` (no `3xl` como en `/classes`): la calculadora ya usa `max-w-2xl` y mantener consistencia visual entre la calculadora y su historial ayuda a la continuidad. Si el equipo prefiere `3xl`, ajustar.
- Status strip sin pill de acción primaria (la página es de consulta).
- El `<main>` tiene `pb-32` para dejar espacio al footer sticky futuro si lo agregamos (ver polish 0018).

### 2. `history-client.tsx` (nuevo)

`src/app/tools/weight-calculator/history/_components/history-client.tsx`. Client-only.

Estado:

```ts
const [records, setRecords] = useState<SavedWeightRecord[]>([]);
const [query, setQuery] = useState("");
const [sourceFilter, setSourceFilter] = useState<"all" | "auto-log" | "manual" | "foto">("all");
const [sort, setSort] = useState<"date-desc" | "date-asc" | "exercise" | "weight-desc">("date-desc");
```

Effects:

- `useEffect` en mount: `setRecords(getRecords())`.
- `useEffect`: subscribe a `window.addEventListener("storage", ...)` filtrando `e.key === "pd:calculator-records"`. En cada event, `setRecords(getRecords())`. Cleanup con `removeEventListener`.

Render:

- **Header de la sección** (debajo del `<main>`):
  - Input de búsqueda (full-width, `placeholder="Buscar por ejercicio"`).
  - Fila de chips de filtro: `Todos`, `Auto-log`, `Manual`, `Foto`. (Usar el componente `Button` con `variant="ghost"` y estilo de chip del catálogo.)
  - Select de sort (custom con `<select>` HTML, o el componente `Select` de shadcn si está disponible — verificar `src/components/ui/select.tsx`).

- **Lista de registros**:
  - Aplicar `sourceFilter` primero.
  - Aplicar search: `r.exercise !== null && r.exercise.toLowerCase().includes(query.toLowerCase().trim())`. (Los auto-logs sin `exercise` no matchean búsqueda de ejercicio.)
  - Aplicar sort.
  - Si la lista filtrada está vacía pero `records.length > 0`:
    ```tsx
    <p className="font-sans text-sm text-mute leading-relaxed py-6 text-center">
      Ningún resultado coincide con el filtro.
    </p>
    ```
  - Si `records.length === 0`:
    ```tsx
    <p className="font-sans text-sm text-mute leading-relaxed py-3 px-4 border border-dashed border-hairline rounded-sm">
      Sin registros todavía. Empezá a usar la calculadora y aparecerán acá.
    </p>
    ```
  - Si hay registros, render `<HistoryRow>` por cada uno (ver siguiente).

### 3. `history-row.tsx` (nuevo)

`src/app/tools/weight-calculator/history/_components/history-row.tsx`. Client-only.

Props: `{ record: SavedWeightRecord; onLoad: (r: SavedWeightRecord) => void; onDelete: (r: SavedWeightRecord) => void }`.

Render:

```tsx
<li className="border border-hairline rounded-sm bg-panel/40 px-3 py-2.5 flex items-start gap-3">
  <div className="min-w-0 flex-1">
    <div className="flex items-baseline gap-2 flex-wrap">
      <p className="font-display italic font-semibold text-base text-bone truncate">
        {record.exercise ?? <span className="text-mute font-sans not-italic font-normal">Auto-log sin etiqueta</span>}
      </p>
      <SourceBadge source={record.source} />
    </div>
    <p className="font-mono tabular-nums text-sm text-bone mt-1">
      {record.totalKg.toFixed(1)} kg · {record.totalLb.toFixed(1)} lb
    </p>
    <p className="font-mono tabular-nums text-[0.8125rem] text-mute mt-0.5">
      {record.breakdownLine}
    </p>
    <p className="font-sans text-[0.6875rem] text-mute mt-1.5 uppercase tracking-[0.10em]">
      {formatAbsolute(record.createdAt)}
    </p>
  </div>
  <div className="flex flex-col gap-1 shrink-0">
    <Button variant="ghost" size="sm" onClick={() => onLoad(record)} className="... existing button ghost styling ...">
      <ArrowDownToLine className="size-3.5" aria-hidden />
      Cargar
    </Button>
    <Button variant="ghost" size="sm" onClick={() => onCopy(record)} className="...">
      <Copy className="size-3.5" aria-hidden />
      Copiar
    </Button>
    <Button variant="ghost" size="sm" onClick={() => onDelete(record)} className="... hover:text-destructive ...">
      <Trash2 className="size-3.5" aria-hidden />
      Eliminar
    </Button>
  </div>
</li>
```

Sub-componente `SourceBadge`:

```tsx
function SourceBadge({ source }: { source: RecordSource }) {
  const label = source === "auto-log" ? "Auto" : source === "manual" ? "Manual" : "Foto";
  return (
    <span className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute border border-hairline rounded-sm px-1.5 py-0.5">
      {label}
    </span>
  );
}
```

### 4. Helper `formatAbsolute(iso: string): string`

Devuelve la fecha completa: `dd MMM YYYY · HH:mm` (e.g., `30 ago 2026 · 14:23`). Sin locale full.

```ts
function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
```

### 5. Handlers `onLoad`, `onCopy`, `onDelete`

Viven en `HistoryClient` y se pasan a cada `<HistoryRow>`.

```ts
function handleLoad(record: SavedWeightRecord) {
  // Escribir al draft de la calculadora ANTES de navegar, así la calculadora abre ya con la carga.
  setCalculatorState({ barKg: record.barKg, discs: record.discs });
  router.push("/tools/weight-calculator");
}

function handleCopy(record: SavedWeightRecord) {
  const text = record.exercise
    ? `${record.exercise} — ${record.totalKg.toFixed(1)} kg · ${record.totalLb.toFixed(1)} lb\n${record.breakdownLine}`
    : `${record.totalKg.toFixed(1)} kg · ${record.totalLb.toFixed(1)} lb\n${record.breakdownLine}`;
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copiado"),
    () => toast.error("No se pudo copiar"),
  );
}

function handleDelete(record: SavedWeightRecord) {
  const label = record.exercise ?? "este auto-log";
  if (!window.confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;
  removeRecord(record.id);
  // No necesitamos setRecords manual: el storage event va a re-disparar.
  // Pero como removeRecord también dispatcha storage event, podemos escucharlo.
  // Optimistic: setRecords(getRecords()) directamente.
  setRecords(getRecords());
  toast.success("Registro eliminado");
}
```

### 6. Search sticky

La barra de búsqueda + filtros + sort debe quedar **sticky top-0** dentro del `<main>`, con `bg-canvas` y `border-b` para que no se pierda al scrollear listas largas. Esto replica el patrón del mini-historial sticky de CrossFit (ADR-0005).

```tsx
<div className="sticky top-0 bg-canvas border-b border-hairline -mx-5 md:-mx-8 px-5 md:px-8 py-3 z-10 space-y-3">
  {/* input search */}
  {/* filter chips */}
  {/* sort select */}
</div>
```

Los `-mx-*` y `px-*` compensan el padding del `<main>` para que el sticky llegue de borde a borde del viewport.

### 7. (Opcional) Bulk delete

NO implementar en este issue. Queda como follow-up si el coach lo pide. Default: sólo delete individual.

## Aceptación

- [ ] `npm run build` y `npm run lint` pasan.
- [ ] Manual: con 0 registros, la página muestra el empty state. Con N registros, la lista los muestra.
- [ ] Manual: el filtro por source excluye correctamente. Búsqueda es case-insensitive y filtra por `exercise`.
- [ ] Manual: el sort cambia el orden sin perder el filtro ni la búsqueda.
- [ ] Manual: `Cargar` desde la página escribe a `pd:calculator-state` y navega a `/tools/weight-calculator`. Al llegar, la calculadora abre con la carga correcta (verificar en el footer "Total").
- [ ] Manual: `Copiar` escribe al portapapeles. Pegar en otra app muestra el texto correcto.
- [ ] Manual: `Eliminar` pide `window.confirm`, borra el registro, toast success, la lista se reduce.
- [ ] Manual: cross-tab — abrir la página en una tab y la calculadora en otra, guardar en calculadora, la página de historial se actualiza al recibir el storage event.
- [ ] Mobile: la barra de búsqueda + filtros queda sticky arriba. La lista scrollea debajo. Los botones por fila se mantienen touch-friendly (≥ 44px).
- [ ] A11y: input de búsqueda tiene `<label>` o `aria-label`. Chips de filtro usan `aria-pressed`. Select tiene label.
- [ ] No `box-shadow` ni gradientes. Todo dentro del design system.

## Decisiones durables

- La página usa `max-w-2xl` (consistencia con la calculadora).
- El sort default es `date-desc` (lo más reciente primero). Cambio a otro default se evalúa si el coach reporta fricción.
- La búsqueda filtra sólo por `exercise`. No busca por fecha, peso, ni source. (Source es un filtro separado, no un target de búsqueda.)
- `Cargar` desde la página escribe al draft (`pd:calculator-state`) **antes** de navegar. Esto evita un flash de "calculadora vacía → carga aplicada" en la calculadora destino.
- Search sticky es decisión durable (no se quita en polish 0018 sin motivo).
- Auto-logs son visibles en esta página. En el mini-panel (issue 0016) no. Esta es la diferencia entre "resumen rápido" y "vista completa".

## Out of scope

- Bulk delete / multi-select (sólo delete individual).
- Edit inline de un registro. El helper `updateRecord` existe (issue 0013) pero la UI no lo llama. Se evalúa en polish.
- Paginación. Asumimos < 2000 registros en uso típico. Si la lista crece, virtualizar.
- Export CSV/JSON.
- Gráficas o trends.
- Cross-references con `SavedSession` de CrossFit.

## Follow-ups (no en este PR)

- Si el coach pide filtro por rango de fechas, se evalúa como issue separado (afecta el modelo de queries y la UI).
- Si la lista crece > 1000 registros, virtualización con `react-virtual` o equivalente.
- Bulk delete si la fricción de borrar uno por uno resulta real.
- Editar un registro (el `updateRecord` ya existe).
