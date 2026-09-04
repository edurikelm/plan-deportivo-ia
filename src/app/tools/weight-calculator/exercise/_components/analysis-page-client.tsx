"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, Star, Trash2, Upload } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  parseRecordsFromRaw,
  removeRecord,
  setCalculatorState,
  updateRecord,
} from "@/lib/storage";
import {
  aggregateExerciseOneRepMax,
  buildPrilepinRows,
  getRecordsForExercise,
  type PrilepinRow,
  type SavedWeightRecord,
} from "@/lib/calculator";
import {
  formatProgressionTick,
  rollingEstimatedOneRm,
} from "@/lib/calculator/chart-helpers";

const RECORDS_KEY = "pd:calculator-records";

// ─── External store subscription ────────────────────────────────────────────
//
// Same `useSyncExternalStore` pattern as `exercises-page-client.tsx`:
// subscribe to the global `storage` event (covers both same-tab
// `dispatchStorage` from the storage helpers AND cross-tab writes).
// `getServerSnapshot` returns `""` so the SSR markup matches the first
// client render — the page renders a header-only placeholder until
// hydration, then re-renders with the real records.

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getClientSnapshot(): string {
  return localStorage.getItem(RECORDS_KEY) ?? "";
}

function getServerSnapshot(): string {
  return "";
}

// ─── Date formatters ────────────────────────────────────────────────────────

/**
 * Spanish short-month absolute date for the exercise list (e.g.
 * "03 sep 2026"). Locale-free, same array as
 * `exercises-page-client.tsx`'s `formatDate` to keep visual consistency.
 */
const SPANISH_MONTHS_ABBR = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

function formatAbsoluteShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${SPANISH_MONTHS_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface AnalysisPageClientProps {
  name: string;
}

/**
 * Per-exercise analysis view (issue 0039).
 *
 * Renders a header with the exercise name + summary stats, a grid of
 * Recharts charts (progression, volume, rolling e1RM), the Prilepin
 * table (sticky on desktop), and the exercise's full record list with
 * Cargar / Marcar 1RM / Eliminar actions.
 *
 * Empty states are explicit and consistent with the rest of the app:
 *   - 0 records → "No hay registros para este ejercicio"
 *   - 1 record  → only the progression chart, the other two with a copy
 *     saying you need ≥ 2 records
 *   - all `reps === null` → all 3 charts but the Prilepin table shows
 *     "Sin 1RM estimado"
 */
export function AnalysisPageClient({ name }: AnalysisPageClientProps) {
  const hydrated = useHydrated();
  const raw = useSyncExternalStore(
    subscribeToStorage,
    getClientSnapshot,
    getServerSnapshot,
  );

  const allRecords = useMemo(
    () => (hydrated ? parseRecordsFromRaw(raw) : []),
    [raw, hydrated],
  );

  const records = useMemo(
    () => (hydrated ? getRecordsForExercise(allRecords, name) : []),
    [allRecords, hydrated, name],
  );

  const oneRm = useMemo(
    () => aggregateExerciseOneRepMax(records),
    [records],
  );

  // Sort records chronologically (oldest first) for the charts. The
  // exercise list is displayed in reverse order (newest first) below.
  // Declared before the early returns so the hook order is stable across
  // every render — `react-hooks/rules-of-hooks` enforces this.
  const chronological = useMemo(
    () => [...records].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [records],
  );

  // Pre-hydration placeholder matches the post-hydration header so SSR
  // and the first client render produce identical markup.
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-canvas">
        <header className="status-strip" data-state="idle">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon-sm"
              nativeButton={false}
              render={<Link href="/tools/weight-calculator/exercises" />}
              aria-label="Volver al listado de ejercicios"
              className="rounded-md text-mute hover:text-bone hover:bg-transparent"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="font-display italic font-semibold text-lg leading-none tracking-tight truncate">
              {name}
            </h1>
          </div>
        </header>
      </div>
    );
  }

  if (records.length === 0) {
    return <NoRecordsState name={name} />;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Header
        name={name}
        recordCount={records.length}
        oneRmKg={oneRm}
        lastRecordAt={records[0].createdAt}
      />

      <main className="mx-auto max-w-5xl px-5 md:px-8 pt-6 pb-16">
        <ChartsSection records={chronological} />

        <div className="mt-10 grid grid-cols-1 md:grid-cols-[1fr_18rem] gap-6 md:gap-8">
          <ExerciseHistoryList records={records} />
          <PrilepinSidebar oneRmKg={oneRm} />
        </div>
      </main>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Header({
  name,
  recordCount,
  oneRmKg,
  lastRecordAt,
}: {
  name: string;
  recordCount: number;
  oneRmKg: number | null;
  lastRecordAt: string;
}) {
  const oneRmLabel =
    oneRmKg === null ? "—" : `${oneRmKg.toFixed(1)}kg`;
  const lastDate = formatAbsoluteShort(lastRecordAt);
  return (
    <header className="status-strip" data-state="idle">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={
            <Link href="/tools/weight-calculator/exercises" />
          }
          aria-label="Volver al historial"
          className="rounded-md text-mute hover:text-bone hover:bg-transparent shrink-0"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="font-display italic font-semibold text-lg leading-none tracking-tight truncate">
          {name}
        </h1>
      </div>
      <div className="numeric text-[0.6875rem] text-mute shrink-0 hidden sm:flex flex-col items-end leading-tight">
        <span>
          {recordCount} {recordCount === 1 ? "registro" : "registros"}
          {" · 1RM estimado "}
          {oneRmLabel}
        </span>
        <span>último {lastDate || "—"}</span>
      </div>
    </header>
  );
}

function NoRecordsState({ name }: { name: string }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="status-strip" data-state="idle">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={
              <Link href="/tools/weight-calculator/exercises" />
            }
            aria-label="Volver al listado de ejercicios"
            className="rounded-md text-mute hover:text-bone hover:bg-transparent shrink-0"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="font-display italic font-semibold text-lg leading-none tracking-tight truncate">
            {name}
          </h1>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 md:px-8 pt-6 pb-16">
        <div className="border border-dashed border-hairline rounded-sm p-6 text-center">
          <p className="font-sans text-sm text-mute leading-relaxed">
            No hay registros para este ejercicio. Volvé al{" "}
            <Link
              href="/tools/weight-calculator/exercises"
              className="font-semibold text-bone hover:text-signal underline underline-offset-2"
            >
              listado de ejercicios
            </Link>{" "}
            o a la{" "}
            <Link
              href="/tools/weight-calculator"
              className="font-semibold text-bone hover:text-signal underline underline-offset-2"
            >
              calculadora
            </Link>{" "}
            para empezar.
          </p>
        </div>
      </main>
    </div>
  );
}

function ChartsSection({
  records,
}: {
  records: SavedWeightRecord[];
}) {
  const hasMultiple = records.length >= 2;
  const hasReps = records.some((r) => r.reps !== null);

  return (
    <section
      aria-label="Charts de progresión"
      className="grid grid-cols-1 md:grid-cols-3 gap-4"
    >
      <ProgressionChart records={records} />
      {hasMultiple && hasReps ? (
        <VolumeChart records={records} />
      ) : (
        <ChartPlaceholder
          title="Volumen"
          message="Necesitás ≥ 2 registros con repeticiones para ver volumen."
        />
      )}
      {hasMultiple ? (
        <EstimatedOneRmChart records={records} />
      ) : (
        <ChartPlaceholder
          title="e1RM"
          message="Necesitás ≥ 2 registros para ver la progresión del 1RM estimado."
        />
      )}
    </section>
  );
}

function ChartPlaceholder({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="chalk-card p-4 flex flex-col min-h-[180px]">
      <h3 className="font-display italic font-semibold text-sm text-bone leading-tight">
        {title}
      </h3>
      <p className="font-sans text-xs text-mute leading-relaxed mt-3">
        {message}
      </p>
    </div>
  );
}

// ─── Chart 1: Progression (totalKg vs fecha) ────────────────────────────────

function ProgressionChart({ records }: { records: SavedWeightRecord[] }) {
  const data = records.map((r) => ({
    date: r.createdAt,
    tick: formatProgressionTick(r.createdAt),
    totalKg: r.totalKg,
    reps: r.reps,
  }));

  return (
    <ChartCard title="Progresión" subtitle="Carga total (kg) por sesión">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="2 4" />
          <XAxis dataKey="tick" tick={{ fontSize: 10, fill: "var(--color-mute)" }} />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--color-mute)" }}
            width={36}
            unit="kg"
          />
          <Tooltip content={ProgressionTooltip as never} />
          <Line
            type="monotone"
            dataKey="totalKg"
            stroke="var(--color-signal)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--color-signal)" }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function ProgressionTooltip(props: TooltipContentProps<number, string>) {
  const { active, payload } = props;
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload as {
    tick: string;
    totalKg: number;
    reps: number | null;
  };
  return (
    <div className="border border-hairline rounded-sm bg-panel px-3 py-2 shadow-sm">
      <p className="font-sans text-xs text-mute leading-none">{point.tick}</p>
      <p className="numeric text-sm text-bone leading-tight mt-1">
        {point.totalKg.toFixed(1)}kg
        {point.reps === null ? "" : ` × ${point.reps}`}
      </p>
    </div>
  );
}

// ─── Chart 2: Volume (totalKg × reps) ──────────────────────────────────────

function VolumeChart({ records }: { records: SavedWeightRecord[] }) {
  const data = records
    .filter((r) => r.reps !== null)
    .map((r) => ({
      date: r.createdAt,
      tick: formatProgressionTick(r.createdAt),
      volume: Math.round(r.totalKg * (r.reps ?? 0)),
      totalKg: r.totalKg,
      reps: r.reps,
    }));

  return (
    <ChartCard title="Volumen" subtitle="Carga × repeticiones">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="2 4" />
          <XAxis dataKey="tick" tick={{ fontSize: 10, fill: "var(--color-mute)" }} />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--color-mute)" }}
            width={42}
            unit="kg"
          />
          {/* Recharts 3.x infers `content` as `ContentType<ValueType, NameType>`,
              the union of every possible value/name type. Our tooltips are
              concrete `TooltipContentProps<number, string>`; the `as never`
              cast is safe at runtime (Y-axis values are always numbers) but
              TypeScript can't prove it because of contravariance on the
              generic params. The same cast appears on the other two charts
              below. */}
          <Tooltip content={VolumeTooltip as never} />
          <Bar
            dataKey="volume"
            fill="var(--color-signal)"
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function VolumeTooltip(props: TooltipContentProps<number, string>) {
  const { active, payload } = props;
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload as {
    tick: string;
    totalKg: number;
    reps: number | null;
  };
  return (
    <div className="border border-hairline rounded-sm bg-panel px-3 py-2 shadow-sm">
      <p className="font-sans text-xs text-mute leading-none">{point.tick}</p>
      <p className="numeric text-sm text-bone leading-tight mt-1">
        {point.totalKg.toFixed(1)}kg × {point.reps ?? "—"}
      </p>
    </div>
  );
}

// ─── Chart 3: e1RM rolling ─────────────────────────────────────────────────

function EstimatedOneRmChart({ records }: { records: SavedWeightRecord[] }) {
  const e1rmSeries = rollingEstimatedOneRm(records, 3);
  const data = records.map((r, i) => ({
    date: r.createdAt,
    tick: formatProgressionTick(r.createdAt),
    e1rm: e1rmSeries[i],
    reps: r.reps,
  }));
  const window = data.length < 3 ? data.length : 3;

  return (
    <ChartCard
      title="e1RM"
      subtitle={`Ventana rolling de ${window} ${window === 1 ? "sesión" : "sesiones"}`}
    >
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="2 4" />
          <XAxis dataKey="tick" tick={{ fontSize: 10, fill: "var(--color-mute)" }} />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--color-mute)" }}
            width={36}
            unit="kg"
          />
          <Tooltip content={EstimatedOneRmTooltip as never} />
          <Line
            type="monotone"
            dataKey="e1rm"
            stroke="var(--color-signal)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--color-signal)" }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function EstimatedOneRmTooltip(props: TooltipContentProps<number, string>) {
  const { active, payload } = props;
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload as {
    tick: string;
    e1rm: number | null;
    reps: number | null;
  };
  if (point.e1rm === null) {
    return (
      <div className="border border-hairline rounded-sm bg-panel px-3 py-2 shadow-sm">
        <p className="font-sans text-xs text-mute leading-none">{point.tick}</p>
        <p className="numeric text-sm text-mute leading-tight mt-1">
          sin 1RM
        </p>
      </div>
    );
  }
  return (
    <div className="border border-hairline rounded-sm bg-panel px-3 py-2 shadow-sm">
      <p className="font-sans text-xs text-mute leading-none">{point.tick}</p>
      <p className="numeric text-sm text-bone leading-tight mt-1">
        {point.e1rm.toFixed(1)}kg
        {point.reps === null ? "" : ` (origen: × ${point.reps})`}
      </p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="chalk-card p-4 flex flex-col min-h-[180px]"
      data-testid="analysis-chart"
    >
      <h3 className="font-display italic font-semibold text-sm text-bone leading-tight">
        {title}
      </h3>
      <p className="font-sans text-[0.6875rem] text-mute leading-tight mt-0.5">
        {subtitle}
      </p>
      <div className="mt-2 flex-1">{children}</div>
    </div>
  );
}

// ─── Exercise history list ─────────────────────────────────────────────────

function ExerciseHistoryList({ records }: { records: SavedWeightRecord[] }) {
  return (
    <section aria-label="Historial del ejercicio">
      <h2 className="font-display italic font-semibold text-base text-bone leading-tight">
        Historial
      </h2>
      <ul className="mt-3 space-y-2" data-testid="exercise-history-list">
        {records.map((record) => (
          <HistoryRow key={record.id} record={record} />
        ))}
      </ul>
    </section>
  );
}

function HistoryRow({ record }: { record: SavedWeightRecord }) {
  const handleLoad = () => {
    setCalculatorState({ barKg: record.barKg, discs: record.discs });
    toast.success("Cargado en la calculadora", {
      description: "Volvé a la calculadora para editar.",
    });
  };

  const handleDelete = () => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      `¿Eliminar este registro de ${record.totalKg.toFixed(1)}kg${
        record.reps === null ? "" : ` × ${record.reps}`
      }? Esta acción no se puede deshacer.`,
    );
    if (!ok) return;
    removeRecord(record.id);
    toast.success("Registro eliminado");
  };

  const handleToggleFlag = () => {
    updateRecord({ ...record, isOneRepMax: !record.isOneRepMax });
  };

  return (
    <li
      className="border border-hairline rounded-sm bg-panel px-4 py-3 flex items-center gap-3"
      data-testid="exercise-history-row"
    >
      <div className="min-w-0 flex-1">
        <p className="numeric text-sm text-bone leading-tight">
          {formatAbsoluteShort(record.createdAt)}
          {" · "}
          <span className="font-semibold">
            {record.totalKg.toFixed(1)}kg
          </span>
          {record.reps === null ? "" : ` × ${record.reps}`}
        </p>
        <p className="font-sans text-xs text-mute leading-tight mt-0.5 truncate">
          {record.breakdownLine}
        </p>
        <div className="mt-1 flex items-center gap-2">
          {record.isOneRepMax && (
            <span
              className="numeric text-[0.6875rem] text-signal font-semibold inline-flex items-center gap-1"
              aria-label="Marcado como 1RM"
            >
              <Star className="size-3 fill-current" aria-hidden /> 1RM
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleLoad}
          aria-label="Cargar en la calculadora"
          className="text-mute hover:text-bone"
        >
          <Upload className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleToggleFlag}
          aria-label={
            record.isOneRepMax ? "Desmarcar como 1RM" : "Marcar como 1RM"
          }
          className={
            record.isOneRepMax
              ? "text-signal hover:text-bone"
              : "text-mute hover:text-bone"
          }
        >
          <Star
            className={`size-4 ${record.isOneRepMax ? "fill-current" : ""}`}
            aria-hidden
          />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleDelete}
          aria-label="Eliminar registro"
          className="text-mute hover:text-bone"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}

// ─── Prilepin sidebar ──────────────────────────────────────────────────────

function PrilepinSidebar({ oneRmKg }: { oneRmKg: number | null }) {
  if (oneRmKg === null) {
    return (
      <aside
        aria-label="Tabla de Prilepin"
        className="md:sticky md:top-4 md:self-start"
      >
        <h2 className="font-display italic font-semibold text-base text-bone leading-tight">
          Tabla de RM
        </h2>
        <p className="font-sans text-xs text-mute leading-relaxed mt-3">
          Sin 1RM estimado. Marcá un registro como 1RM o cargá sets con
          repeticiones para ver la tabla de Prilepin.
        </p>
      </aside>
    );
  }

  const rows = buildPrilepinRows(oneRmKg);
  return (
    <aside
      aria-label="Tabla de Prilepin"
      className="md:sticky md:top-4 md:self-start"
    >
      <h2 className="font-display italic font-semibold text-base text-bone leading-tight">
        Tabla de RM
      </h2>
      <p className="font-sans text-[0.6875rem] text-mute leading-tight mt-0.5">
        Prilepin · 1RM base {oneRmKg.toFixed(1)}kg
      </p>
      <div className="mt-3 border border-hairline rounded-sm overflow-hidden">
        <table className="w-full numeric text-xs">
          <thead className="bg-panel">
            <tr className="text-mute">
              <th className="text-left font-sans font-normal py-1.5 px-2">
                Reps
              </th>
              <th className="text-right font-sans font-normal py-1.5 px-2">
                % 1RM
              </th>
              <th className="text-right font-sans font-normal py-1.5 px-2">
                kg
              </th>
              <th className="text-right font-sans font-normal py-1.5 px-2">
                lb
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PrilepinRowView key={row.reps} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </aside>
  );
}

function PrilepinRowView({ row }: { row: PrilepinRow }) {
  return (
    <tr className="border-t border-hairline text-bone">
      <td className="py-1.5 px-2 text-left">{row.reps}</td>
      <td className="py-1.5 px-2 text-right">{row.percentage}%</td>
      <td className="py-1.5 px-2 text-right">
        {row.weightKg.toFixed(1)}
      </td>
      <td className="py-1.5 px-2 text-right">
        {row.weightLb.toFixed(1)}
      </td>
    </tr>
  );
}
