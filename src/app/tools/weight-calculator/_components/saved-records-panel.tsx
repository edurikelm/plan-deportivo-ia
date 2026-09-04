"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRecentRecordsFromRaw } from "@/lib/storage";
import type { SavedWeightRecord } from "@/lib/calculator";
import { useHydrated } from "@/hooks/use-hydrated";

const RECORDS_KEY = "pd:calculator-records";
const PANEL_LIMIT = 5;

// ─── External store subscription ────────────────────────────────────────────
//
// `useSyncExternalStore` is the React-19-idiomatic way to subscribe to a
// mutable external source (here, the `pd:calculator-records` localStorage
// key plus its `storage` events). The store value we expose is the raw
// JSON string — strings compare with `Object.is`, so React's reconciler
// re-renders only when the storage contents actually change.
//
// The snapshot function reads from `localStorage` directly. During SSR
// and the very first client render (before hydration), `getServerSnapshot`
// returns `""` so server and client markup match. After hydration,
// `useSyncExternalStore` switches to the client snapshot, which triggers
// a re-render with the real data. `getRecentRecords` itself is
// localStorage-safe (try/catch) so the memo never throws in the wrong
// environment.

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

// ─── Relative time ──────────────────────────────────────────────────────────

/**
 * Returns a short, human-readable relative timestamp for a record's
 * `createdAt`. Spanish strings; the format is "Xh" / "Xd" / absolute date
 * once the entry is older than a week. Locale-free: no `Intl.*` calls so
 * the output is stable across browsers and CI environments.
 */
function formatRelative(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "ahora";
  if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `hace ${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 172800) return "ayer";
  if (diffSec < 604800) return `hace ${Math.floor(diffSec / 86400)}d`;
  const d = new Date(iso);
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
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface SavedRecordsPanelProps {
  /**
   * Called when the Entrenador clicks `Cargar` on a record. The parent
   * decides what to do with it (rehydrate the calculator, confirm
   * overwrite, navigate elsewhere). The panel does not mutate the
   * calculator state directly — that's the orchestrator's job.
   */
  onLoad: (record: SavedWeightRecord) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Compact list of the most recent labeled records below the bar
 * visualization. Shows the last `PANEL_LIMIT` (5) records the coach named
 * explicitly — auto-logs are excluded because the panel is for
 * intentional saves, not telemetry.
 *
 * Reactive: subscribes to `storage` events on the records key so that
 * (a) a save in the same tab updates the panel without a refresh, and
 * (b) a save in another browser tab is reflected when the user returns
 * to this tab.
 *
 * Gated by `useHydrated` so the SSR pass renders a stable placeholder;
 * the localStorage read happens only on the client.
 */
export function SavedRecordsPanel({ onLoad }: SavedRecordsPanelProps) {
  const hydrated = useHydrated();
  // Raw storage string. Re-renders only when the actual contents change.
  // Same mechanism is used internally for cross-tab updates: the
  // subscribe callback receives a notification on the `storage` event and
  // `useSyncExternalStore` re-reads the snapshot.
  const raw = useSyncExternalStore(
    subscribeToStorage,
    getClientSnapshot,
    getServerSnapshot,
  );
  const records = useMemo(
    () => (hydrated ? getRecentRecordsFromRaw(raw, PANEL_LIMIT) : []),
    [raw, hydrated],
  );

  // Pre-hydration: render a stable placeholder so SSR markup matches the
  // first client render. The empty state shown to the user is the
  // "no records yet" message — it's a defensible default for first
  // visits and saves us a flash of empty content.
  if (!hydrated) {
    return (
      <section
        aria-busy="true"
        className="border border-hairline rounded-none bg-panel p-5"
      >
        <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute">
          Registros
        </p>
      </section>
    );
  }

  return (
    <section className="border border-hairline rounded-none bg-panel p-5 space-y-4">
      <header className="flex items-baseline justify-between">
        <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute">
          Registros
        </p>
        {records.length > 0 && (
          <span className="numeric text-[0.6875rem] text-mute">
            {records.length} {records.length === 1 ? "carga" : "cargas"}
          </span>
        )}
      </header>

      {records.length === 0 ? (
        <p className="font-sans text-sm text-mute leading-relaxed py-3 px-4 border border-dashed border-hairline rounded-sm">
          Todavía no guardaste cargas con nombre. Usá{" "}
          <span className="font-sans font-semibold text-bone">Guardar</span>{" "}
          abajo para registrar una.
        </p>
      ) : (
        <ul aria-label="Cargas guardadas" className="space-y-2">
          {records.map((r) => (
            <SavedRecordRow key={r.id} record={r} onLoad={onLoad} />
          ))}
        </ul>
      )}

      <footer className="pt-3 border-t border-hairline flex items-center justify-end">
        <Link
          href="/tools/weight-calculator/exercises"
          className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-signal hover:underline inline-flex items-center gap-1.5"
        >
          Ver todos los ejercicios
          <span aria-hidden>→</span>
        </Link>
      </footer>
    </section>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────────

interface SavedRecordRowProps {
  record: SavedWeightRecord;
  onLoad: (record: SavedWeightRecord) => void;
}

function SavedRecordRow({ record, onLoad }: SavedRecordRowProps) {
  return (
    <li className="flex items-start gap-3 px-2.5 py-2 border border-hairline rounded-sm bg-canvas/40">
      <div className="min-w-0 flex-1">
        <p className="font-display italic font-semibold text-base leading-tight text-bone truncate">
          {record.exercise ?? "(sin etiqueta)"}
        </p>
        <p className="numeric text-sm text-bone mt-1">
          {record.totalKg.toFixed(1)} kg · {record.totalLb.toFixed(1)} lb
        </p>
        <p className="numeric text-[0.8125rem] text-mute mt-0.5 truncate">
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
          aria-label={`Cargar ${record.exercise ?? "esta carga"} ${record.totalKg.toFixed(1)}kg`}
          className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute hover:text-bone hover:bg-muted rounded-md h-11 sm:h-7 px-3 sm:px-2.5 gap-1.5"
        >
          <ArrowDownToLine className="size-3.5" aria-hidden />
          Cargar
        </Button>
      </div>
    </li>
  );
}
