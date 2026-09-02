"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import {
  getSessionsRaw,
  parseSessionsFromRaw,
  subscribeToSessions,
} from "@/lib/storage";
import { Button } from "@/components/ui/button";

/**
 * Renders a "last activity" summary card on `/classes` so the coach can
 * pick up where they left off without going through the full session list.
 *
 * - Reads `pd:sessions` reactively via `useSyncExternalStore` (raw string
 *   as the snapshot, parsed list memoized off it — see AGENTS.md
 *   storage-reactivo pattern).
 * - Returns `null` when there's no activity yet: the catalog of modalities
 *   stands on its own and we don't want to imply the coach is "missing"
 *   something by showing an empty state.
 * - Cross-tab: another tab's `addSession` fires the native `storage` event
 *   on this tab too, so the banner updates without a refresh.
 */
export function RecentActivityBanner() {
  const raw = useSyncExternalStore(
    subscribeToSessions,
    getSessionsRaw,
    () => "",
  );

  const { latest, total } = useMemo(() => {
    const all = parseSessionsFromRaw(raw);
    if (all.length === 0) return { latest: null, total: 0 };
    const sorted = [...all].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return { latest: sorted[0], total: all.length };
  }, [raw]);

  if (!latest) return null;

  return (
    <article
      aria-label="Última actividad"
      className="chalk-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute">
          Última actividad
        </p>
        <h3 className="font-display italic font-semibold text-base text-bone truncate mt-0.5">
          {latest.title}
        </h3>
        <p className="numeric-label text-[0.6875rem] text-mute mt-1">
          {formatRelativeTime(latest.createdAt)}
          {" · "}
          {latest.input.durationMinutes} min
          {" · "}
          {latest.model}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          nativeButton={false}
          render={
            <Link
              href={`/generate/${latest.modalityId}?fromSession=${latest.id}`}
            />
          }
          className="numeric text-[0.6875rem] font-semibold uppercase tracking-[0.10em] border border-signal bg-transparent text-signal hover:bg-signal hover:text-signal-foreground transition-colors h-8 px-3 inline-flex items-center gap-1.5 rounded-md"
        >
          Reabrir
          <span aria-hidden="true">→</span>
        </Button>
        <Link
          href="/sessions"
          className="numeric-label text-[0.6875rem] text-mute hover:text-bone transition-colors"
        >
          {total} {total === 1 ? "sesión guardada" : "sesiones guardadas"}
        </Link>
      </div>
    </article>
  );
}

/**
 * Returns a Spanish relative time string ("hace 2 minutos", "hace 3 días",
 * "ahora") for a given ISO date. Anything beyond a year is reported as an
 * absolute date — relative time loses meaning past that point.
 */
function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const formatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

  const absSec = Math.abs(diffSec);
  if (absSec < 60) return "ahora";
  if (absSec < 3600)
    return formatter.format(Math.round(diffSec / 60), "minute");
  if (absSec < 86400)
    return formatter.format(Math.round(diffSec / 3600), "hour");
  if (absSec < 604800)
    return formatter.format(Math.round(diffSec / 86400), "day");
  if (absSec < 2592000)
    return formatter.format(Math.round(diffSec / 604800), "week");
  if (absSec < 31536000)
    return formatter.format(Math.round(diffSec / 2592000), "month");

  // Beyond a year, fall back to absolute date — relative time is unhelpful
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
