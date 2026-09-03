"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { BookmarkPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  computeTotals,
  normalizeExerciseName,
  suggestRepsForExercise,
  type DiscRow,
  type SavedWeightRecord,
} from "@/lib/calculator";
import { addRecord, getRecords, getUniqueExercises, isQuotaError } from "@/lib/storage";

// ─── Props ──────────────────────────────────────────────────────────────────

interface SaveRecordFormProps {
  currentState: { barKg: number; discs: DiscRow[] };
  onSaved: (record: SavedWeightRecord) => void;
  onCancel: () => void;
  defaultExercise?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Inline form for saving the calculator's current configuration under an
 * exercise name. Renders inside the calculator's sticky footer (not a
 * modal, not a drawer) so the Entrenador keeps visual contact with the
 * totals they are about to persist.
 *
 * The form is fully controlled by its parent — the parent decides when it
 * is open (it is mounted only when open) and reacts to `onSaved` / `onCancel`
 * to close it. This component is responsible for input validation, the
 * autocomplete datalist, the submit lifecycle, and the keyboard handling
 * (auto-focus on mount, Escape to cancel).
 *
 * Since issue 0037 the form also collects `reps` and an optional
 * `isOneRepMax` flag. `reps` is initialized from
 * `suggestRepsForExercise(records, exercise)` at mount, so the coach
 * gets a sensible default based on their previous sets of the same
 * exercise. The default is a one-shot value at form open — the coach
 * can override it freely.
 */
export function SaveRecordForm({
  currentState,
  onSaved,
  onCancel,
  defaultExercise,
}: SaveRecordFormProps) {
  const [exercise, setExercise] = useState(defaultExercise ?? "");
  // Initial reps comes from the suggestion helper. The lazy initializer
  // reads `pd:calculator-records` once at mount; the coach's manual edits
  // to the reps field after mount are not overridden. If no records exist
  // or none match the default exercise, the suggestion defaults to 1.
  const [reps, setReps] = useState(() => {
    const records = getRecords();
    return suggestRepsForExercise(records, defaultExercise ?? "");
  });
  const [isOneRepMax, setIsOneRepMax] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const repsInputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();
  const repsId = useId();
  const flagId = useId();
  // Suggestions are computed once when the form opens and don't
  // auto-refresh: the autocomplete is a hint, not a live picker. The coach
  // reopens the form to see new suggestions. The form is short-lived
  // (mounts on click, unmounts on save/cancel/Escape), so a stale
  // suggestion list at most shows a missed recent save.
  const suggestions = useMemo(() => getUniqueExercises(), []);

  // ── Auto-focus on mount. The exercise input must receive focus before
  //    the coach can interact with the form. Use a microtask delay so the
  //    focus lands after React commits the form into the DOM.
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, []);

  // ── Escape to cancel. Bound at the document level so the keystroke
  //    works regardless of which element inside the form has focus.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // ── Submit. Persist a snapshot, toast, hand off to parent.
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const name = normalizeExerciseName(exercise);
    if (name === "") return; // Guard: button is disabled, but defensive.
    if (!Number.isFinite(reps) || reps < 1) return; // Same.

    setSubmitting(true);
    try {
      const totals = computeTotals(currentState);
      const record: SavedWeightRecord = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        exercise: name,
        barKg: currentState.barKg,
        discs: currentState.discs,
        totalKg: totals.totalKg,
        totalLb: totals.totalLb,
        breakdownLine: totals.breakdownLine,
        source: "manual",
        reps: Math.trunc(reps),
        isOneRepMax,
      };
      addRecord(record);
      toast.success("Carga guardada");
      onSaved(record);
    } catch (err) {
      console.error("[save-record-form] failed to persist:", err);
      if (isQuotaError(err)) {
        toast.error(
          "Almacenamiento lleno. Borrá registros antiguos desde el historial.",
          { duration: 6000 },
        );
      } else {
        toast.error("No pudimos guardar la carga. Probá de nuevo.");
      }
      setSubmitting(false);
    }
  }

  const trimmed = normalizeExerciseName(exercise);
  const repsValid = Number.isFinite(reps) && reps >= 1;
  const canSubmit = trimmed !== "" && repsValid && !submitting;

  return (
    <form
      role="region"
      aria-label="Guardar carga con etiqueta"
      onSubmit={handleSubmit}
      className="border border-hairline rounded-sm bg-panel/60 p-3 space-y-2"
    >
      <div className="flex items-center gap-2">
        <label
          htmlFor={`${listId}-input`}
          className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute shrink-0"
        >
          Ejercicio
        </label>
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="text"
          list={listId}
          autoComplete="off"
          maxLength={80}
          placeholder="Ej. Back Squat"
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
          aria-label="Nombre del ejercicio"
          className="font-mono text-sm flex-1 px-2 py-1.5 bg-transparent border border-hairline rounded-sm text-bone placeholder:text-mute focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 outline-none"
        />
      </div>

      <datalist id={listId}>
        {suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div className="flex items-center gap-3">
        <label
          htmlFor={repsId}
          className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute shrink-0"
        >
          Reps
        </label>
        <input
          ref={repsInputRef}
          id={repsId}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          required
          value={Number.isFinite(reps) ? reps : ""}
          onChange={(e) => {
            const next = e.target.value === "" ? NaN : Number(e.target.value);
            setReps(next);
          }}
          aria-label="Repeticiones"
          aria-invalid={!repsValid}
          className="font-mono text-sm w-20 px-2 py-1.5 bg-transparent border border-hairline rounded-sm text-bone placeholder:text-mute focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 outline-none aria-[invalid=true]:border-signal"
        />
        <label
          htmlFor={flagId}
          className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <input
            id={flagId}
            type="checkbox"
            checked={isOneRepMax}
            onChange={(e) => setIsOneRepMax(e.target.checked)}
            aria-label="Marcar como 1RM"
            className="size-3.5 accent-signal"
          />
          Marcar como 1RM
        </label>
      </div>

      <div className="flex items-center gap-2 justify-end pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          aria-label="Cancelar"
          className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute hover:text-bone hover:bg-muted rounded-md h-8 px-2.5 gap-1.5"
        >
          <X className="size-3.5" aria-hidden />
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={!canSubmit}
          aria-label="Guardar carga"
          className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] bg-signal text-signal-foreground hover:bg-signal-deep rounded-md h-8 px-3 gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <BookmarkPlus className="size-3.5" aria-hidden />
          Guardar
        </Button>
      </div>
    </form>
  );
}
