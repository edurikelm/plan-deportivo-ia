"use client";

/**
 * Horizontally scrollable row of clickable chips for the coach's favorited
 * exercises (issue 0044, refined by 0045). Each chip represents one exercise
 * name from the `favorites` prop (most recently favorited first) and renders
 * two affordances:
 *
 * - Click the chip body → fills the input via `onSelect(name)`.
 * - Click the trailing `×` → removes the name from favorites via
 *   `onRemove(name)`. The remove action stops propagation so it does not
 *   also fire the select.
 *
 * Visual: chips follow the chip recipe in DESIGN.md: 2px radius, hairline
 * border, mute text in pasivo, solid signal + signal-foreground in selected.
 * The `.numeric-label` utility centralizes the mono + tabular-nums +
 * 0.04em tracking that all small chip labels use.
 *
 * The component is purely presentational. The empty-state (whether to
 * render anything at all when `favorites.length === 0`) is the parent's
 * call — the form hides the row entirely when there are no favorites, so
 * the user never sees an empty "Favoritos" header with no chips.
 */
import { useMemo } from "react";
import { X } from "lucide-react";
import { isFavorite } from "@/lib/calculator";

interface FavoriteExerciseChipsProps {
  /** Current value of the exercise input. The chip matching this value is highlighted. */
  value: string;
  /** Coach's favorites, most recently favorited first. */
  favorites: readonly string[];
  /** Called when the coach clicks a chip body. Receives the canonical name. */
  onSelect: (name: string) => void;
  /** Called when the coach clicks the trailing × on a chip. */
  onRemove: (name: string) => void;
}

// ─── Chip ────────────────────────────────────────────────────────────────────

interface ChipProps {
  name: string;
  active: boolean;
  onSelect: (name: string) => void;
  onRemove: (name: string) => void;
}

function Chip({ name, active, onSelect, onRemove }: ChipProps) {
  return (
    <span
      data-active={active ? "true" : "false"}
      data-favorite={name}
      className={
        active
          ? "inline-flex items-center gap-1 shrink-0 whitespace-nowrap rounded-sm border border-transparent bg-signal text-signal-foreground pl-2.5 pr-1 py-1 numeric-label"
          : "inline-flex items-center gap-1 shrink-0 whitespace-nowrap rounded-sm border border-hairline bg-transparent pl-2.5 pr-1 py-1 numeric-label text-mute transition-colors hover:text-bone"
      }
    >
      <button
        type="button"
        onClick={() => onSelect(name)}
        aria-pressed={active}
        aria-label={`Seleccionar ${name}`}
        className="focus:outline-none focus-visible:underline"
      >
        {name}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(name);
        }}
        aria-label={`Quitar ${name} de favoritos`}
        className="inline-flex items-center justify-center rounded-sm size-4 hover:bg-foreground/10 transition-colors"
      >
        <X className="size-3" aria-hidden />
      </button>
    </span>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

export function FavoriteExerciseChips({
  value,
  favorites,
  onSelect,
  onRemove,
}: FavoriteExerciseChipsProps) {
  // The active match is computed every render: the row is small (~dozens
  // of entries) and the computation is O(n) string compare, well below the
  // cost of memoization bookkeeping. The `useMemo` exists to keep the
  // favorite flag cheap when the row is large (e.g. a coach with 50+
  // favorites), not because it's a hot path.
  const isActive = useMemo(() => isFavorite(favorites, value), [favorites, value]);

  return (
    <div
      role="group"
      aria-label="Ejercicios favoritos"
      className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:thin]"
    >
      {favorites.map((name) => (
        <Chip
          key={name}
          name={name}
          active={isActive && name.trim().toLowerCase() === value.trim().toLowerCase()}
          onSelect={onSelect}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
