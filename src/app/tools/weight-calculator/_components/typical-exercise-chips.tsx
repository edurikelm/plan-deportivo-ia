"use client";

/**
 * Horizontally scrollable row of clickable chips for the typical-exercise
 * catalog (issue 0043). Each chip represents one canonical Spanish exercise
 * name from `TYPICAL_EXERCISES`, optionally followed by its English alias
 * in parentheses. Clicking a chip fires `onSelect(name)`.
 *
 * Visual: chips share the same `hairline` / `signal` / `bone` design tokens
 * used elsewhere in the calculator. The active chip — i.e. the one whose
 * name (case-insensitive, trimmed) matches `value` — is rendered with the
 * signal color so the coach gets visual confirmation that the exercise
 * they're about to save is the one they picked.
 *
 * The row is `overflow-x-auto` with no wrap, so on narrow viewports the
 * coach can swipe through the rest of the catalog. We intentionally do NOT
 * collapse to a dropdown — the discoverability of seeing the names is the
 * whole point of the feature.
 */
import { TYPICAL_EXERCISES, findTypicalByName, type TypicalExercise } from "@/lib/calculator";

interface TypicalExerciseChipsProps {
  /** Current value of the exercise input. The chip matching this value is highlighted. */
  value: string;
  /** Called when the coach clicks a chip. Receives the canonical Spanish name. */
  onSelect: (name: string) => void;
}

// ─── Chip ────────────────────────────────────────────────────────────────────

interface ChipProps {
  exercise: TypicalExercise;
  active: boolean;
  onSelect: (name: string) => void;
}

function Chip({ exercise, active, onSelect }: ChipProps) {
  const label = exercise.alias
    ? `${exercise.name} (${exercise.alias})`
    : exercise.name;

  return (
    <button
      type="button"
      onClick={() => onSelect(exercise.name)}
      aria-pressed={active}
      aria-label={`Seleccionar ${exercise.name}`}
      data-active={active ? "true" : "false"}
      className={
        active
          ? "shrink-0 whitespace-nowrap rounded-full border border-signal bg-signal/15 px-2.5 py-1 font-mono text-[0.7rem] tracking-[0.04em] text-bone"
          : "shrink-0 whitespace-nowrap rounded-full border border-hairline bg-transparent px-2.5 py-1 font-mono text-[0.7rem] tracking-[0.04em] text-bone/70 transition-colors hover:border-bone/40 hover:text-bone"
      }
    >
      {label}
    </button>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

export function TypicalExerciseChips({ value, onSelect }: TypicalExerciseChipsProps) {
  // The active match is computed every render: the row is small (~25
  // entries) and the computation is O(n) string compare, well below the
  // cost of memoization bookkeeping.
  const active = findTypicalByName(value);

  return (
    <div
      role="group"
      aria-label="Ejercicios típicos"
      className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:thin]"
    >
      {TYPICAL_EXERCISES.map((exercise) => (
        <Chip
          key={exercise.name}
          exercise={exercise}
          active={active?.name === exercise.name}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
