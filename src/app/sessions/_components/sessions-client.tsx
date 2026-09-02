"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  Copy,
  Download,
  FolderOpen,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  getSessionsRaw,
  parseSessionsFromRaw,
  removeSession,
  setSessions,
  subscribeToSessions,
} from "@/lib/storage";
import { copyToClipboard, downloadAsMarkdown, markdownFilename } from "@/lib/clipboard";
import type { SavedSession } from "@/lib/types";

type SortMode = "newest" | "oldest" | "az" | "za";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "newest", label: "Más recientes" },
  { value: "oldest", label: "Más antiguos" },
  { value: "az", label: "Título A-Z" },
  { value: "za", label: "Título Z-A" },
];

const ALL_MODALITIES = "all";

export function SessionsClient() {
  const hydrated = useHydrated();
  const router = useRouter();

  // Search / filter / sort state
  const [search, setSearch] = useState("");
  const [modality, setModality] = useState<string>(ALL_MODALITIES);
  const [sort, setSort] = useState<SortMode>("newest");

  // Sessions: raw snapshot from useSyncExternalStore (storage-reactivo pattern,
  // AGENTS.md:91-92). The parsed list is memoized off the raw string.
  const sessionsRaw = useSyncExternalStore(
    subscribeToSessions,
    getSessionsRaw,
    () => "",
  );
  const allSessions = useMemo(
    () => parseSessionsFromRaw(sessionsRaw),
    [sessionsRaw],
  );

  // Derive the list of modalities present in storage (for the filter chips).
  // Sorted by first-seen, which is the most-recent-first order thanks to
  // the storage layer returning newest-first.
  const knownModalities = useMemo(() => {
    const seen = new Set<string>();
    for (const s of allSessions) seen.add(s.modalityId);
    return Array.from(seen);
  }, [allSessions]);

  // No derived `effectiveModality`: if the user filters to a modality that
  // no longer has any sessions, the inline empty state surfaces
  // ("no hay sesiones de 'crossfit'"). The chip stays on the user's
  // selection so they can see what they asked for and click "Todas" to
  // reset. Forcing a fallback to "Todas" would feel like the click was
  // ignored.

  // Apply search + filter + sort
  const visibleSessions = useMemo(() => {
    const term = search.trim().toLowerCase();
    let filtered = allSessions;
    if (modality !== ALL_MODALITIES) {
      filtered = filtered.filter((s) => s.modalityId === modality);
    }
    if (term) {
      filtered = filtered.filter((s) => {
        // title is the primary match; markdown is a secondary fallback
        // for older sessions where the title was empty.
        const haystack = `${s.title}\n${s.markdown}`.toLowerCase();
        return haystack.includes(term);
      });
    }
    const sorted = [...filtered];
    switch (sort) {
      case "newest":
        sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
      case "oldest":
        sorted.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        break;
      case "az":
        sorted.sort((a, b) => a.title.localeCompare(b.title, "es"));
        break;
      case "za":
        sorted.sort((a, b) => b.title.localeCompare(a.title, "es"));
        break;
    }
    return sorted;
  }, [allSessions, search, modality, sort]);

  // Actions
  function handleLoad(session: SavedSession) {
    // Use the modality label for the toast; the actual modalityId is the
    // route segment. The GenerateClient reads ?fromSession on mount and
    // applies loadSessionInto.
    router.push(`/generate/${session.modalityId}?fromSession=${session.id}`);
  }

  async function handleCopy(session: SavedSession) {
    const outcome = await copyToClipboard(session.markdown);
    if (outcome.ok) {
      toast.success("Copiado al portapapeles");
    } else {
      toast.error("No se pudo copiar");
    }
  }

  function handleExport(session: SavedSession) {
    const filename = markdownFilename(
      session.modalityId,
      new Date(session.createdAt),
    );
    downloadAsMarkdown(filename, session.markdown);
  }

  function handleDelete(session: SavedSession) {
    const ok = window.confirm("¿Eliminar esta sesión?");
    if (!ok) return;
    // Snapshot the full list BEFORE removing so the undo restore is
    // position-preserving (the session returns to the same index, not
    // appended at the end).
    const all = parseSessionsFromRaw(getSessionsRaw());
    const original = [...all];
    removeSession(session.id);
    toast("Sesión eliminada", {
      description: session.title,
      action: {
        label: "Deshacer",
        onClick: () => setSessions(original),
      },
      duration: 5000,
    });
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-canvas">
        <header className="status-strip" data-state="idle">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              nativeButton={false}
              render={<Link href="/classes" />}
              aria-label="Volver al catálogo"
              className="size-7 rounded-md text-mute hover:text-bone hover:bg-transparent"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="font-display italic font-semibold text-lg leading-none tracking-tight">
              Cargando…
            </h1>
          </div>
        </header>
      </div>
    );
  }

  const showFullEmpty = allSessions.length === 0;
  const showInlineEmpty =
    !showFullEmpty && visibleSessions.length === 0;

  return (
    <div className="min-h-screen bg-canvas">
      {/* Status strip */}
      <header className="status-strip" data-state="idle">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            nativeButton={false}
            render={<Link href="/classes" />}
            aria-label="Volver al catálogo"
            className="size-7 rounded-md text-mute hover:text-bone hover:bg-transparent"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="font-display italic font-semibold text-lg leading-none tracking-tight truncate">
            Sesiones guardadas
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="numeric-label text-[0.6875rem] text-mute">
            {allSessions.length} en total
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 md:px-8 py-10 space-y-6">
        {/* Search + filter + sort row */}
        {!showFullEmpty && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título…"
                aria-label="Buscar sesiones por título o contenido"
                className="flex-1 h-10 px-3.5 bg-transparent border border-hairline rounded-sm text-bone placeholder:text-mute font-mono text-sm focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30"
              />
              <Select
                value={sort}
                onValueChange={(v) => setSort(v as SortMode)}
              >
                <SelectTrigger
                  aria-label="Ordenar por"
                  className="h-10 px-3.5 sm:w-48 bg-transparent border border-hairline rounded-sm text-bone numeric focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30"
                >
                  <SelectValue>
                    {SORT_OPTIONS.find((o) => o.value === sort)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover border-hairline text-bone">
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {knownModalities.length > 0 && (
              <div
                role="radiogroup"
                aria-label="Filtrar por modalidad"
                className="flex flex-wrap items-center gap-2"
              >
                <FilterChip
                  label="Todas"
                  selected={modality === ALL_MODALITIES}
                  onClick={() => setModality(ALL_MODALITIES)}
                />
                {knownModalities.map((m) => (
                  <FilterChip
                    key={m}
                    label={m}
                    selected={modality === m}
                    onClick={() => setModality(m)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* List / empty states */}
        {showFullEmpty ? (
          <FullEmptyState />
        ) : showInlineEmpty ? (
          <InlineEmptyState
            search={search}
            modality={modality === ALL_MODALITIES ? null : modality}
          />
        ) : (
          <ul className="space-y-px bg-hairline rounded-none overflow-hidden">
            {visibleSessions.map((s) => (
              <li key={s.id} className="bg-panel">
                <SessionListItem
                  session={s}
                  onLoad={handleLoad}
                  onCopy={handleCopy}
                  onExport={handleExport}
                  onDelete={handleDelete}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function FilterChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`numeric text-xs px-3 py-1 rounded-sm border transition-colors ${
        selected
          ? "bg-signal text-signal-foreground border-signal"
          : "bg-transparent text-mute border-hairline hover:border-hairline-strong hover:text-bone"
      }`}
    >
      {label}
    </button>
  );
}

export function SessionListItem({
  session,
  onLoad,
  onCopy,
  onExport,
  onDelete,
}: {
  session: SavedSession;
  onLoad: (s: SavedSession) => void;
  onCopy: (s: SavedSession) => Promise<void> | void;
  onExport: (s: SavedSession) => void;
  onDelete: (s: SavedSession) => void;
}) {
  const date = new Date(session.createdAt);
  return (
    <article className="chalk-card border-0 px-5 py-4">
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="font-display italic font-semibold text-base leading-none tracking-tight text-bone truncate">
          {session.title || "(sin título)"}
        </h2>
        <span className="numeric-label text-[0.6875rem] text-mute shrink-0">
          {date.toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
          })}
          {" · "}
          {session.input.durationMinutes} min
          {" · "}
          {session.model}
        </span>
      </header>
      <footer className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <ListAction
          icon={<FolderOpen className="size-3" />}
          label="Cargar"
          ariaLabel={`Cargar sesión: ${session.title}`}
          onClick={() => onLoad(session)}
        />
        <ListAction
          icon={<Copy className="size-3" />}
          label="Copiar"
          ariaLabel={`Copiar sesión: ${session.title}`}
          onClick={() => onCopy(session)}
        />
        <ListAction
          icon={<Download className="size-3" />}
          label="Exportar"
          ariaLabel={`Exportar sesión: ${session.title}`}
          onClick={() => onExport(session)}
        />
        <ListAction
          icon={<Trash2 className="size-3" />}
          label="Eliminar"
          ariaLabel={`Eliminar sesión: ${session.title}`}
          onClick={() => onDelete(session)}
        />
      </footer>
    </article>
  );
}

function ListAction({
  icon,
  label,
  ariaLabel,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="numeric-label text-[0.6875rem] text-mute hover:text-bone hover:bg-muted transition-colors flex items-center gap-1 min-h-11 sm:min-h-7 px-2 sm:px-1 -mx-1 rounded-sm"
    >
      {icon}
      {label}
    </button>
  );
}

function FullEmptyState() {
  return (
    <div className="chalk-card border border-hairline max-w-md">
      <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute mb-2">
        Vacío
      </p>
      <p className="text-bone mb-1">No tenés sesiones guardadas.</p>
      <p className="text-sm text-mute leading-relaxed mb-6">
        Generá una sesión y guardala. Todas las que persistas aparecen acá.
      </p>
      <Button
        variant="ghost"
        nativeButton={false}
        render={<Link href="/classes" />}
        className="font-sans text-xs font-semibold uppercase tracking-[0.10em] text-bone bg-transparent hover:bg-muted rounded-md h-9 px-4"
      >
        Ir al catálogo
      </Button>
    </div>
  );
}

function InlineEmptyState({
  search,
  modality,
}: {
  search: string;
  modality: string | null;
}) {
  const subject = search
    ? "que coincidan con tu búsqueda"
    : modality
      ? `de la modalidad "${modality}"`
      : "que coincidan con los filtros activos";
  return (
    <p className="text-sm text-mute leading-relaxed">
      No hay sesiones {subject}.
    </p>
  );
}
