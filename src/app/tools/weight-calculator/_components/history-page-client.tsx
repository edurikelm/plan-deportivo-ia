"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowLeft,
  Copy,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  parseRecordsFromRaw,
  removeRecord,
  setCalculatorState,
} from "@/lib/storage";
import type { RecordSource, SavedWeightRecord } from "@/lib/calculator";
import { useHydrated } from "@/hooks/use-hydrated";

const RECORDS_KEY = "pd:calculator-records";

type SourceFilter = "all" | RecordSource;
type SortKey = "date-desc" | "date-asc" | "exercise" | "weight-desc";

const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "auto-log", label: "Auto-log" },
  { value: "manual", label: "Manual" },
  { value: "foto", label: "Foto" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date-desc", label: "Más recientes" },
  { value: "date-asc", label: "Más antiguos" },
  { value: "exercise", label: "Ejercicio A–Z" },
  { value: "weight-desc", label: "Más pesados" },
];

// ─── External store subscription ────────────────────────────────────────────
//
// Identical mechanism to the saved-records-panel: `useSyncExternalStore` over
// the raw JSON string on `pd:calculator-records`, plus the synthetic `storage`
// events dispatched by `dispatchStorage` on the write path. Cross-tab updates
// fire native `storage` events in this tab, same-tab updates fire synthetic
// ones; both end up triggering the snapshot to re-read, which re-renders the
// page. The `getServerSnapshot` returns `""` so SSR markup matches the first
// client render (the placeholder is rendered instead of the real list).

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

// ─── Formatters ─────────────────────────────────────────────────────────────

/**
 * Spanish short-month, locale-free (no `Intl.*` so the output is stable
 * across browsers and CI). Format: "15 mar 2026 · 14:32".
 */
function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const months = [
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
  ];
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} · ${time}`;
}

function sourceLabel(source: RecordSource): string {
  switch (source) {
    case "auto-log":
      return "auto-log";
    case "manual":
      return "manual";
    case "foto":
      return "foto";
  }
}

function sourceToneClass(source: RecordSource): string {
  switch (source) {
    case "auto-log":
      return "text-mute";
    case "manual":
    case "foto":
      return "text-signal";
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function HistoryPageClient() {
  const router = useRouter();
  const hydrated = useHydrated();
  const raw = useSyncExternalStore(
    subscribeToStorage,
    getClientSnapshot,
    getServerSnapshot,
  );

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");

  const records = useMemo(
    () => (hydrated ? parseRecordsFromRaw(raw) : []),
    [raw, hydrated],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = records;
    if (sourceFilter !== "all") {
      list = list.filter((r) => r.source === sourceFilter);
    }
    if (q.length > 0) {
      // Search is case-insensitive and only matches records with a non-null
      // `exercise` (auto-log and foto records have `null` exercise by
      // design). The user can still see them by clearing the search and
      // using the source filter instead.
      list = list.filter(
        (r) => r.exercise !== null && r.exercise.toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    switch (sortKey) {
      case "date-desc":
        sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
      case "date-asc":
        sorted.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        break;
      case "exercise":
        // Nulls sort to the end; otherwise alphabetical (locale-free to keep
        // output stable across environments).
        sorted.sort((a, b) => {
          if (a.exercise === null && b.exercise === null) return 0;
          if (a.exercise === null) return 1;
          if (b.exercise === null) return -1;
          return a.exercise.localeCompare(b.exercise);
        });
        break;
      case "weight-desc":
        sorted.sort((a, b) => b.totalKg - a.totalKg);
        break;
    }
    return sorted;
  }, [records, search, sourceFilter, sortKey]);

  // ─── Actions ─────────────────────────────────────────────────────────────

  async function handleCopy(record: SavedWeightRecord) {
    const label = record.exercise ?? sourceLabel(record.source);
    const text = [
      label,
      record.breakdownLine,
      `${record.totalKg.toFixed(1)}kg · ${record.totalLb.toFixed(1)}lb`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  function handleLoad(record: SavedWeightRecord) {
    // Per ADR-0009 + umbrella 0012: write the draft state before navigating
    // so the calculator mounts already-hydrated with this record's snapshot.
    // No "empty → applied" flash.
    setCalculatorState({ barKg: record.barKg, discs: record.discs });
    router.push("/tools/weight-calculator");
  }

  function handleDelete(record: SavedWeightRecord) {
    const label = record.exercise ?? "este registro";
    if (
      !window.confirm(
        `¿Eliminar ${label}? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    removeRecord(record.id);
    toast.success("Registro eliminado");
  }

  // ─── Render (pre-hydration) ──────────────────────────────────────────────

  if (!hydrated) {
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
              Historial
            </h1>
          </div>
        </header>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  const hasRecords = records.length > 0;
  const hasMatches = filtered.length > 0;
  const filterIsActive = sourceFilter !== "all" || search.trim().length > 0;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="status-strip" data-state="idle">
        <div className="flex items-center gap-3 min-w-0">
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
          <h1 className="font-display italic font-semibold text-lg leading-none tracking-tight truncate">
            Historial
          </h1>
        </div>
        {hasRecords && (
          <span className="font-mono tabular-nums text-[0.6875rem] text-mute shrink-0">
            {filterIsActive && records.length !== filtered.length
              ? `${filtered.length} de ${records.length}`
              : `${records.length} ${records.length === 1 ? "registro" : "registros"}`}
          </span>
        )}
      </header>

      <main className="mx-auto max-w-2xl px-5 md:px-8 pt-6 pb-16">
        {!hasRecords ? (
          <EmptyState />
        ) : (
          <>
            {/* Sticky search/filter/sort bar. Negative horizontal margin so the
                bar can extend full-width when sticky (so the bg covers the
                content scrolled underneath), while its content stays in the
                max-w-2xl container. */}
            <div className="sticky top-0 z-10 -mx-5 md:-mx-8 px-5 md:px-8 pt-2 pb-4 bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/80 border-b border-hairline">
              <div className="relative mb-3">
                <Search
                  aria-hidden
                  className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-mute pointer-events-none"
                />
                <Input
                  type="search"
                  inputMode="search"
                  placeholder="Buscar por nombre de ejercicio…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Buscar registros por nombre de ejercicio"
                  className="pl-9 pr-9 font-sans text-sm h-11 sm:h-10 rounded-sm"
                />
                {search.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-md text-mute hover:text-bone hover:bg-muted flex items-center justify-center"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div
                  role="group"
                  aria-label="Filtrar por origen"
                  className="flex flex-wrap gap-1.5"
                >
                  {SOURCE_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setSourceFilter(f.value)}
                      aria-pressed={sourceFilter === f.value}
                      className={`font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] px-3 sm:px-2.5 h-11 sm:h-7 rounded-sm border transition-colors ${
                        sourceFilter === f.value
                          ? "bg-signal text-signal-foreground border-signal"
                          : "bg-transparent text-mute border-hairline hover:border-hairline-strong hover:text-bone"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-1.5">
                  <span className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute">
                    Orden
                  </span>
                  <select
                    value={sortKey}
                    onChange={(e) =>
                      setSortKey(e.target.value as SortKey)
                    }
                    aria-label="Ordenar registros"
                    className="font-sans text-xs font-semibold uppercase tracking-[0.10em] text-mute bg-transparent border border-hairline rounded-sm h-11 sm:h-8 px-2.5 hover:border-hairline-strong focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 outline-none"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="pt-6">
              {!hasMatches ? (
                <NoMatchesState
                  onReset={() => {
                    setSearch("");
                    setSourceFilter("all");
                  }}
                />
              ) : (
                <ul aria-label="Historial de cargas" className="space-y-2">
                  {filtered.map((r) => (
                    <HistoryRecordRow
                      key={r.id}
                      record={r}
                      onLoad={handleLoad}
                      onCopy={handleCopy}
                      onDelete={handleDelete}
                    />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="border border-dashed border-hairline rounded-sm p-6 text-center">
      <p className="font-sans text-sm text-mute leading-relaxed">
        Todavía no hay registros. Volvé a la{" "}
        <Link
          href="/tools/weight-calculator"
          className="font-semibold text-bone hover:text-signal underline underline-offset-2"
        >
          calculadora
        </Link>{" "}
        y guardá tu primera carga con un nombre de ejercicio.
      </p>
    </div>
  );
}

function NoMatchesState({ onReset }: { onReset: () => void }) {
  return (
    <div className="border border-dashed border-hairline rounded-sm p-6 text-center">
      <p className="font-sans text-sm text-mute leading-relaxed mb-3">
        No hay registros que coincidan con los filtros actuales.
      </p>
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute hover:text-bone hover:bg-muted rounded-sm h-9 sm:h-7 px-3 gap-1.5"
      >
        Limpiar filtros
      </Button>
    </div>
  );
}

interface HistoryRecordRowProps {
  record: SavedWeightRecord;
  onLoad: (r: SavedWeightRecord) => void;
  onCopy: (r: SavedWeightRecord) => void;
  onDelete: (r: SavedWeightRecord) => void;
}

function HistoryRecordRow({
  record,
  onLoad,
  onCopy,
  onDelete,
}: HistoryRecordRowProps) {
  const isFoto = record.source === "foto";
  const displayName = record.exercise ?? sourceLabel(record.source);
  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-3 px-3 py-3 border border-hairline rounded-sm bg-panel/40">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p
            className={`text-base leading-tight truncate ${
              record.exercise
                ? "font-display italic font-semibold text-bone"
                : "font-sans font-semibold text-mute"
            }`}
          >
            {displayName}
          </p>
          <span
            className={`font-sans text-[0.625rem] font-semibold uppercase tracking-[0.12em] inline-flex items-center gap-1 ${sourceToneClass(record.source)}`}
          >
            {isFoto && <Sparkles aria-hidden className="size-3" />}
            {sourceLabel(record.source)}
          </span>
        </div>
        <p className="font-mono tabular-nums text-sm text-bone mt-1">
          {record.totalKg.toFixed(1)} kg · {record.totalLb.toFixed(1)} lb
        </p>
        <p className="font-mono tabular-nums text-[0.8125rem] text-mute mt-0.5 truncate">
          {record.breakdownLine}
        </p>
        <p className="font-sans text-[0.6875rem] text-mute mt-1.5">
          {formatAbsolute(record.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onLoad(record)}
          aria-label={`Cargar ${displayName}`}
          className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute hover:text-bone hover:bg-muted rounded-md h-11 sm:h-8 px-3 sm:px-2.5 gap-1.5"
        >
          <ArrowDownToLine className="size-3.5" aria-hidden />
          Cargar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCopy(record)}
          aria-label={`Copiar ${displayName}`}
          className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute hover:text-bone hover:bg-muted rounded-md h-11 sm:h-8 px-3 sm:px-2.5 gap-1.5"
        >
          <Copy className="size-3.5" aria-hidden />
          Copiar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(record)}
          aria-label={`Eliminar ${displayName}`}
          className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute hover:text-destructive hover:bg-muted rounded-md h-11 sm:h-8 px-3 sm:px-2.5 gap-1.5"
        >
          <Trash2 className="size-3.5" aria-hidden />
          Eliminar
        </Button>
      </div>
    </li>
  );
}
