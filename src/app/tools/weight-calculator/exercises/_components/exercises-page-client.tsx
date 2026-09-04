"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseRecordsFromRaw } from "@/lib/storage";
import { deriveExerciseIndex, type ExerciseIndexEntry } from "@/lib/calculator";
import { useHydrated } from "@/hooks/use-hydrated";

const RECORDS_KEY = "pd:calculator-records";

// ─── External store subscription ────────────────────────────────────────────
//
// Identical mechanism to `history-page-client.tsx` and `analysis-page-client.tsx`:
// `useSyncExternalStore` over the raw JSON string on `pd:calculator-records`.
// The synthetic `storage` events from `dispatchStorage` (same-tab writes)
// AND the native `storage` events (cross-tab writes) both re-read the
// snapshot, so the list refreshes on any change. The `getServerSnapshot`
// returns `""` so SSR markup matches the first client render.

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
 * across browsers and CI). Format: "03 sep 2026".
 */
function formatDate(iso: string): string {
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
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Maps a `RecordSource` to the user-facing label shown next to the date.
 * "auto-log" was deprecated (see 0017 post-mortem) but the value still
 * lives in legacy records; we keep its label honest.
 */
function sourceLabel(source: ExerciseIndexEntry["lastRecord"]["source"]): string {
  switch (source) {
    case "manual":
      return "manual";
    case "foto":
      return "foto";
    case "auto-log":
      return "auto";
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Lists every unique exercise that has at least one record in
 * `pd:calculator-records`, sorted by most recent activity. Each entry
 * links to the per-exercise analysis view (issue 0039) at
 * `/tools/weight-calculator/exercise/[encodedName]`.
 *
 * Empty state: returns `null` so the catalog on `/classes` stands on
 * its own (per the project's "no empty state when there's nothing to
 * show" convention from `RecentActivityBanner`).
 */
export function ExercisesPageClient() {
  const hydrated = useHydrated();
  const raw = useSyncExternalStore(
    subscribeToStorage,
    getClientSnapshot,
    getServerSnapshot,
  );

  const entries = useMemo(() => {
    if (!hydrated) return [] as ExerciseIndexEntry[];
    const records = parseRecordsFromRaw(raw);
    return deriveExerciseIndex(records);
  }, [raw, hydrated]);

  // Pre-hydration placeholder mirrors the post-hydration header so
  // SSR and the first client render produce identical markup.
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
              Ejercicios
            </h1>
          </div>
        </header>
      </div>
    );
  }

  // No exercises recorded yet: render nothing. The `/classes` catalog
  // surfaces the calculator + history cards independently; the coach
  // discovers `/exercises` only when there's something to look at.
  if (entries.length === 0) return null;

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
            Ejercicios
          </h1>
        </div>
        <span className="numeric text-[0.6875rem] text-mute shrink-0">
          {entries.length}{" "}
          {entries.length === 1 ? "ejercicio" : "ejercicios"}
        </span>
      </header>

      <main className="mx-auto max-w-2xl px-5 md:px-8 pt-6 pb-16">
        <ul aria-label="Ejercicios guardados" className="space-y-2">
          {entries.map((entry) => (
            <ExerciseCard
              key={entry.name.toLowerCase()}
              entry={entry}
              formatDate={formatDate}
              sourceLabel={sourceLabel}
            />
          ))}
        </ul>
      </main>
    </div>
  );
}

// ─── Card ───────────────────────────────────────────────────────────────────

interface ExerciseCardProps {
  entry: ExerciseIndexEntry;
  formatDate: (iso: string) => string;
  sourceLabel: (source: ExerciseCardSource) => string;
}

type ExerciseCardSource = ExerciseIndexEntry["lastRecord"]["source"];

/**
 * One card per unique exercise. The whole card is a `<Link>` so the
 * tap target matches the visual surface (no separate "ver" button
 * after the description, à la the `/classes` cards). Visual rhythm
 * matches the `/classes` chalk-card pattern (header + body, no
 * footer / CTA — the card itself is the CTA).
 */
function ExerciseCard({ entry, formatDate, sourceLabel }: ExerciseCardProps) {
  const { lastRecord, count, name } = entry;
  const date = formatDate(lastRecord.createdAt);
  const isOneRm = lastRecord.isOneRepMax;

  return (
    <li>
      <Link
        href={`/tools/weight-calculator/exercise/${encodeURIComponent(name)}`}
        className="block bg-panel border border-hairline rounded-sm hover:border-l-hairline-strong transition-colors"
      >
        <article className="chalk-card border-0 px-4 py-3">
          <header className="flex items-baseline justify-between gap-4 pb-2 border-b border-hairline">
            <h2 className="font-display italic font-semibold text-xl leading-tight tracking-tight text-bone truncate">
              {name}
            </h2>
            <span className="numeric text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute shrink-0">
              {lastRecord.totalKg.toFixed(1)} kg
            </span>
          </header>

          <p className="numeric text-xs text-mute leading-relaxed mt-2">
            {date || "—"}
            {" · "}
            {count} {count === 1 ? "registro" : "registros"}
            {isOneRm ? " · ⭐ 1RM" : ""}
            {" · "}
            {sourceLabel(lastRecord.source)}
          </p>
        </article>
      </Link>
    </li>
  );
}
