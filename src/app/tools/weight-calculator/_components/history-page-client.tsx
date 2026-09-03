"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseRecordsFromRaw } from "@/lib/storage";
import {
  aggregateByExercise,
  type ExerciseSummary,
} from "@/lib/calculator";
import { useHydrated } from "@/hooks/use-hydrated";

const RECORDS_KEY = "pd:calculator-records";

// ─── External store subscription ────────────────────────────────────────────
//
// Identical mechanism to the saved-records-panel: `useSyncExternalStore` over
// the raw JSON string on `pd:calculator-records`. The synthetic `storage`
// events from `dispatchStorage` (same-tab writes) AND the native `storage`
// events (cross-tab writes) both re-read the snapshot, so the list
// refreshes on any change. The `getServerSnapshot` returns `""` so SSR
// markup matches the first client render (placeholder shown until
// hydration).
//
// v1.1 candidate: search and sort controls. The current MVP lists every
// exercise sorted by `lastRecordAt` desc (most recently trained first),
// which is the helper's default. As the exercise count grows, a search
// input + sort by record count / best total would land here.

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

// ─── Component ──────────────────────────────────────────────────────────────

export function HistoryPageClient() {
  const router = useRouter();
  const hydrated = useHydrated();
  const raw = useSyncExternalStore(
    subscribeToStorage,
    getClientSnapshot,
    getServerSnapshot,
  );

  const records = useMemo(
    () => (hydrated ? parseRecordsFromRaw(raw) : []),
    [raw, hydrated],
  );

  // Group + sort records by exercise. The helper is pure; memoize so
  // re-renders triggered by unrelated state don't re-aggregate.
  const summaries = useMemo(() => aggregateByExercise(records), [records]);

  // Pre-hydration placeholder matches the post-hydration layout's
  // header so SSR and the first client render produce identical markup.
  if (!hydrated) {
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
              Ejercicios guardados
            </h1>
          </div>
        </header>
      </div>
    );
  }

  const hasExercises = summaries.length > 0;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="status-strip" data-state="idle">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<Link href="/classes" />}
            aria-label="Volver al catálogo"
            className="rounded-md text-mute hover:text-bone hover:bg-transparent"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="font-display italic font-semibold text-lg leading-none tracking-tight truncate">
            Ejercicios guardados
          </h1>
        </div>
        {hasExercises && (
          <span className="numeric text-[0.6875rem] text-mute shrink-0">
            {summaries.length}{" "}
            {summaries.length === 1 ? "ejercicio" : "ejercicios"}
          </span>
        )}
      </header>

      <main className="mx-auto max-w-2xl px-5 md:px-8 pt-6 pb-16">
        {!hasExercises ? (
          <EmptyState />
        ) : (
          <ul aria-label="Lista de ejercicios guardados" className="space-y-2">
            {summaries.map((summary) => (
              <ExerciseRow
                key={summary.name.toLowerCase()}
                summary={summary}
                onClick={() => {
                  // Use `router.push` (not a plain `<a>`) so the navigation
                  // is client-side and the previous /history entry stays
                  // in the history stack.
                  router.push(
                    `/tools/weight-calculator/exercise/${encodeURIComponent(summary.name)}`,
                  );
                }}
                formatAbsolute={formatAbsolute}
              />
            ))}
          </ul>
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
        Todavía no guardaste ningún ejercicio con nombre. Volvé a la{" "}
        <Link
          href="/tools/weight-calculator"
          className="font-semibold text-bone hover:text-signal underline underline-offset-2"
        >
          calculadora
        </Link>{" "}
        y usá el botón{" "}
        <span className="font-semibold text-bone">Guardar</span> con un nombre
        de ejercicio para empezar.
      </p>
    </div>
  );
}

interface ExerciseRowProps {
  summary: ExerciseSummary;
  onClick: () => void;
  formatAbsolute: (iso: string) => string;
}

function ExerciseRow({ summary, onClick, formatAbsolute }: ExerciseRowProps) {
  const oneRm = summary.estimatedOneRmKg;
  const oneRmDisplay =
    oneRm === null ? "—" : `${oneRm.toFixed(1)}kg`;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group w-full text-left border border-hairline rounded-sm bg-panel hover:border-signal transition-colors px-4 py-3 flex items-center gap-3 focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 outline-none"
      >
        <div className="min-w-0 flex-1">
          <h2 className="font-display italic font-semibold text-lg leading-tight tracking-tight text-bone truncate">
            {summary.name}
          </h2>
          <p className="numeric text-xs text-mute leading-relaxed mt-1">
            {summary.recordCount}{" "}
            {summary.recordCount === 1 ? "registro" : "registros"}
            {" · último "}
            {formatAbsolute(summary.lastRecordAt) || "—"}
          </p>
          <p className="numeric text-xs text-bone leading-relaxed mt-0.5">
            mejor {summary.bestTotalKg > 0 ? `${summary.bestTotalKg}kg` : "—"}{" "}
            {oneRm !== null && oneRm > 0 ? `· e1RM ${oneRmDisplay}` : ""}
          </p>
        </div>
        <ChevronRight
          className="size-4 text-mute group-hover:text-signal transition-colors shrink-0"
          aria-hidden
        />
      </button>
    </li>
  );
}
