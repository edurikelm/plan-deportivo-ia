"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  Copy,
  ImagePlus,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  BreakdownSchema,
  type Breakdown,
  type CalculatorState,
  type DiscRow,
  type SavedWeightRecord,
  computeTotals,
  formatBreakdownLine,
  hashState,
} from "@/lib/calculator";
import {
  addRecord,
  getCalculatorState,
  isQuotaError,
  setCalculatorState,
} from "@/lib/storage";
import { useHydrated } from "@/hooks/use-hydrated";
import { SaveRecordForm } from "./save-record-form";
import { SavedRecordsPanel } from "./saved-records-panel";

// ─── Types ───────────────────────────────────────────────────────────────────

type ActiveTab = "manual" | "foto";
type DisplayUnit = "kg" | "lb";
type FotoState =
  | { kind: "idle" }
  | { kind: "analyzing"; imageDataUrl: string }
  | {
      kind: "preview";
      imageDataUrl: string;
      breakdown: Breakdown;
      uncertain: boolean;
      model: string;
    }
  | { kind: "error"; imageDataUrl: string; message: string };

interface DiscRowUI extends DiscRow {
  id: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_BAR_KG = 20;
const COMMON_BAR_KG = [15, 20] as const;
const KG_PER_LB = 2.20462;
const LB_PER_KG = 1 / KG_PER_LB;

// Chalk-disc visual scaling. Width of each rendered disc-block is computed
// as `clamp(MIN, weight_kg * SCALE, MAX)` so the visualization carries real
// information (heavier discs are visibly wider). The scale is intentionally
// conservative so a typical 5-disc-per-side load still fits inside a 360px
// container with the bar in the middle. MIN is high enough that a real
// 2.5 kg plate reads as a thin chalk stripe rather than disappearing into
// the row gap.
const DISC_WIDTH_MIN_PX = 12;
const DISC_WIDTH_MAX_PX = 56;
const DISC_WIDTH_SCALE = 3.2; // px per kg

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lbToKg(lb: number): number {
  return lb * LB_PER_KG;
}

function toPersist(disc: DiscRowUI): DiscRow {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- id is intentionally discarded
  const { id: _id, ...rest } = disc;
  return rest;
}

/**
 * Renders the weight in the user's chosen display unit.
 * The internal store stays in the original unit the coach entered (no
 * round-tripping through lb↔kg), so a disc entered as 25kg stays 25kg even
 * when the display flips to lb.
 */
function formatWeightForDisplay(weight: number, unit: "kg" | "lb"): number {
  return unit === "kg" ? weight : Math.round(weight * KG_PER_LB * 10) / 10;
}

function discWidthPx(weight: number, unit: "kg" | "lb"): number {
  const wKg = unit === "kg" ? weight : lbToKg(weight);
  return Math.min(
    DISC_WIDTH_MAX_PX,
    Math.max(DISC_WIDTH_MIN_PX, wKg * DISC_WIDTH_SCALE),
  );
}

/**
 * Encodes the disc's mass as a luminosity step so heavier plates sit
 * flush against the bone ceiling and lighter bumpers recede — the eye
 * reads "iron vs bumper" without leaving the monochrome chalkboard
 * palette. Threshold lines up with the common bumper-plate ranges:
 * < 10 kg is almost always a training bumper, > 20 kg is competition
 * iron or calibrated change.
 */
function discToneClass(weight: number, unit: "kg" | "lb"): string {
  const wKg = unit === "kg" ? weight : lbToKg(weight);
  if (wKg >= 20) return "disc-tone-iron";
  if (wKg >= 10) return "disc-tone-standard";
  return "disc-tone-bumper";
}

function newDiscId(): string {
  return `disc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CalculatorClient() {
  const hydrated = useHydrated();

  // Calculator state
  const [barKg, setBarKg] = useState<number>(DEFAULT_BAR_KG);
  const [discs, setDiscs] = useState<DiscRowUI[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<ActiveTab>("manual");
  const [displayUnit, setDisplayUnit] = useState<DisplayUnit>("lb");
  const [customBarKg, setCustomBarKg] = useState<string>("");
  const [showCustomBar, setShowCustomBar] = useState(false);
  // Save-form visibility. The form is mounted only when open (controlled by
  // the footer), so `saveFormOpen` doubles as "should the form be rendered".
  const [saveFormOpen, setSaveFormOpen] = useState(false);
  // Ref to the "Guardar" trigger so we can return focus to it when the form
  // closes (per 0017 AC 3 — keyboard users must not lose their place).
  const guardarButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeSaveForm = useCallback(() => {
    setSaveFormOpen(false);
    guardarButtonRef.current?.focus();
  }, []);

  // Foto state
  const [fotoState, setFotoState] = useState<FotoState>({ kind: "idle" });
  const [fotoElapsed, setFotoElapsed] = useState(0);
  const fotoAbortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Auto-log was removed (see 0017 post-mortem). Previously a debounced
  // watcher persisted every stable state to `pd:calculator-records` as
  // a passive safety net, but in practice it created more noise than
  // value: every typed change was logged, the history page got crowded
  // with `exercise: null` rows, and coaches found the duplicates
  // confusing. Now the only persistence paths are the explicit Save
  // form (`source: "manual"`) and the Foto accept (`source: "foto"`).

  // ─── Hydration ─────────────────────────────────────────────────────────────

  const hasSyncedRef = useRef(false);
  useEffect(() => {
    if (!hydrated || hasSyncedRef.current) return;
    hasSyncedRef.current = true;
    const saved = getCalculatorState();
    setBarKg(saved.barKg);
    setDiscs(
      saved.discs.map((d, i) => ({ ...d, id: `disc-${i}-${Date.now()}` })),
    );
  }, [hydrated]);

  // ─── Persistence (debounced) ───────────────────────────────────────────────

  useEffect(() => {
    if (!hydrated || !hasSyncedRef.current) return;
    const id = setTimeout(() => {
      setCalculatorState({ barKg, discs: discs.map(toPersist) });
    }, 250);
    return () => clearTimeout(id);
  }, [barKg, discs, hydrated]);

  // ─── Foto cronómetro ──────────────────────────────────────────────────────

  const fotoStartRef = useRef<number | null>(null);
  useEffect(() => {
    if (fotoState.kind !== "analyzing") {
      fotoStartRef.current = null;
      return;
    }
    const start = Date.now();
    fotoStartRef.current = start;
    const tick = () => {
      setFotoElapsed(Math.floor((Date.now() - start) / 1000));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [fotoState.kind]);

  useEffect(() => {
    return () => {
      fotoAbortRef.current?.abort();
    };
  }, []);

  // ─── Bar handlers ──────────────────────────────────────────────────────────

  function selectBar(value: number) {
    setBarKg(value);
    setShowCustomBar(false);
    setCustomBarKg("");
  }

  function handleCustomBarBlur() {
    const parsed = parseFloat(customBarKg);
    if (!Number.isNaN(parsed) && parsed > 0) {
      setBarKg(parsed);
      setShowCustomBar(true);
    } else {
      setShowCustomBar(false);
      setCustomBarKg("");
    }
  }

  // ─── Disc handlers ─────────────────────────────────────────────────────────

  const addDisc = useCallback(() => {
    setDiscs((prev) => [
      ...prev,
      { id: newDiscId(), weight: 20, unit: "lb", count: 1 },
    ]);
  }, []);

  const removeDisc = useCallback((id: string) => {
    setDiscs((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const updateDisc = useCallback(
    (id: string, key: keyof DiscRow, value: number | "kg" | "lb") => {
      setDiscs((prev) =>
        prev.map((d) => (d.id === id ? { ...d, [key]: value } : d)),
      );
    },
    [],
  );

  // ─── Limpiar ──────────────────────────────────────────────────────────────

  const handleLimpiar = useCallback(() => {
    if (
      !window.confirm(
        "¿Borrar la carga actual? Esta acción no se puede deshacer.",
      )
    )
      return;
    setBarKg(DEFAULT_BAR_KG);
    setDiscs([]);
    setShowCustomBar(false);
    setCustomBarKg("");
  }, []);

  // ─── Cargar (rehidratar desde un registro guardado) ───────────────────────

  /**
   * Replaces the calculator's current state with a saved record's snapshot.
   * If the current state is already identical to the record, this is a
   * silent no-op. If they differ, a confirmation dialog guards against
   * silently overwriting work the coach has in progress.
   */
  const handleLoadRecord = useCallback(
    (record: SavedWeightRecord) => {
      const currentHash = hashState({
        barKg,
        discs: discs.map(toPersist),
      });
      const recordHash = hashState({
        barKg: record.barKg,
        discs: record.discs,
      });
      if (currentHash === recordHash) {
        // Already loaded — nothing to do, no toast, no dialog.
        return;
      }
      const label = record.exercise ?? "esta carga";
      if (
        !window.confirm(
          `¿Reemplazar la carga actual con "${label}"? Se va a perder lo que no hayas guardado.`,
        )
      ) {
        return;
      }
      setBarKg(record.barKg);
      setDiscs(record.discs.map((d) => ({ ...d, id: newDiscId() })));
      toast.success("Carga cargada");
    },
    [barKg, discs],
  );

  // ─── Foto handlers ─────────────────────────────────────────────────────────

  async function startAnalyze(imageDataUrl: string) {
    setFotoState({ kind: "analyzing", imageDataUrl });
    const controller = new AbortController();
    fotoAbortRef.current = controller;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      timeoutId = setTimeout(() => controller.abort(), 60_000);
      const res = await fetch("/api/calculate-weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
        signal: controller.signal,
      });
      const data = (await res.json()) as
        | { ok: true; breakdown: unknown; model: string; crossCheck: { ok: boolean; detail: string } }
        | { ok: false; error: string };

      if (!data.ok) {
        setFotoState({
          kind: "error",
          imageDataUrl,
          message:
            data.error === "invalid_image"
              ? "Imagen inválida."
              : data.error === "unsupported_format"
                ? "Formato no soportado (JPG, PNG, GIF, WEBP)."
                : data.error === "image_too_large"
                  ? "La imagen es demasiado grande (máx. 5 MB)."
                  : data.error === "upstream_error"
                    ? "No pudimos leer la imagen. Probá de nuevo."
                    : "Error inesperado.",
        });
        return;
      }

      const parsed = BreakdownSchema.safeParse(data.breakdown);
      if (!parsed.success) {
        setFotoState({
          kind: "error",
          imageDataUrl,
          message: "La respuesta del modelo no se pudo interpretar.",
        });
        return;
      }
      // Treat cross-check mismatches as uncertain — coach must confirm.
      const uncertain = !data.crossCheck.ok;
      setFotoState({
        kind: "preview",
        imageDataUrl,
        breakdown: parsed.data,
        uncertain,
        model: data.model,
      });
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      setFotoState({
        kind: "error",
        imageDataUrl,
        message: "No pudimos comunicarnos con el servidor. Probá de nuevo.",
      });
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      fotoAbortRef.current = null;
    }
  }

  function handleFile(file: File) {
    const ALLOWED = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!ALLOWED.includes(file.type)) {
      toast.error("Formato no soportado. Probá JPG, PNG o WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen es demasiado grande (máx. 5 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      void startAnalyze(dataUrl);
    };
    reader.onerror = () => toast.error("No se pudo leer la imagen.");
    reader.readAsDataURL(file);
  }

  function onFileInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function acceptFoto() {
    if (fotoState.kind !== "preview") return;
    const breakdown = fotoState.breakdown;
    setBarKg(breakdown.barKg);
    setDiscs(
      breakdown.discs.map((d) => ({ ...d, id: newDiscId() })),
    );
    setFotoState({ kind: "idle" });
    setActiveTab("manual");
    toast.success("Carga aplicada");

    // Persist a photo-attribution record immediately, not through the
    // debounced auto-log. The reason: the coach will often edit the
    // applied load right after accepting the photo, and the auto-log
    // debounce would resolve to the *edited* state with no trace of the
    // photo origin. The foto record is the canonical "this came from a
    // photo" marker; the post-edit state will be picked up by a separate
    // auto-log entry (which is fine — they have different sources).
    const totals = computeTotals({
      barKg: breakdown.barKg,
      discs: breakdown.discs,
    });
    const fotoRecord: SavedWeightRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      exercise: null,
      barKg: breakdown.barKg,
      discs: breakdown.discs,
      totalKg: totals.totalKg,
      totalLb: totals.totalLb,
      breakdownLine: totals.breakdownLine,
      source: "foto",
    };
    try {
      addRecord(fotoRecord);
    } catch (err) {
      // Foto attribution is a passive write, not the user's primary action.
      // We log loudly and surface a toast, but we don't unwind the applied
      // load — the coach already accepted the breakdown and editing the
      // bar/discs is the more important next step. The record simply isn't
      // persisted this time; the auto-log watcher will catch the next
      // stable state.
      console.error("[calculator] failed to persist foto record:", err);
      if (isQuotaError(err)) {
        toast.error(
          "Almacenamiento lleno. Borrá registros antiguos desde el historial.",
          { duration: 6000 },
        );
      } else {
        toast.error("No pudimos registrar el origen de la foto.");
      }
    }
  }

  function cancelFoto() {
    setFotoState({ kind: "idle" });
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const calculatorState: CalculatorState = { barKg, discs };
  const totals = computeTotals(calculatorState);
  const breakdownLine = formatBreakdownLine(calculatorState);

  // Whether the saved store has been loaded — used to gate the placeholder
  // dash so a coach with a saved bar of 20kg doesn't see "—" on first paint.
  const [storeLoaded, setStoreLoaded] = useState(false);
  useEffect(() => {
    if (hydrated && hasSyncedRef.current) setStoreLoaded(true);
  }, [hydrated]);

  const stripState: "idle" | "active" | "preview-ready" =
    fotoState.kind === "analyzing"
      ? "active"
      : fotoState.kind === "preview" || fotoState.kind === "error"
        ? "preview-ready"
        : "idle";

  const stripLabel =
    fotoState.kind === "analyzing"
      ? "Analizando"
      : fotoState.kind === "preview"
        ? "Revisar"
        : fotoState.kind === "error"
          ? "Reintentar"
          : "Listo";

  const fotoMinutes = Math.floor(fotoElapsed / 60);
  const fotoSeconds = fotoElapsed % 60;

  // Stable sort of discs for visualization: heaviest first (visually,
  // bigger discs on the inside is the gym convention).
  const sortedDiscs = useMemo(
    () =>
      [...discs].sort(
        (a, b) =>
          (a.unit === "kg" ? a.weight : lbToKg(a.weight)) * a.count -
          (b.unit === "kg" ? b.weight : lbToKg(b.weight)) * b.count,
      ),
    [discs],
  );

  // ─── Render (pre-hydration) ────────────────────────────────────────────────

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-canvas">
        <header className="status-strip" data-state="idle">
          <div className="flex items-center gap-3">
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
            <h1 className="font-display italic font-semibold text-lg leading-none tracking-tight">
              Calculadora de Pesos
            </h1>
          </div>
        </header>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-canvas">
      {/* ── Status strip ───────────────────────────────────────────────── */}
      <header className="status-strip" data-state={stripState}>
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
            Calculadora de Pesos
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {fotoState.kind === "analyzing" ? (
            <time
              dateTime={`PT${fotoMinutes}M${fotoSeconds}S`}
              className="flex items-center gap-2 numeric"
            >
              <span
                aria-hidden
                className="font-display italic font-medium text-[0.6875rem] uppercase tracking-[0.16em] text-signal-foreground/70 self-center"
              >
                {stripLabel}
              </span>
              <span aria-hidden className="w-px h-4 bg-signal-foreground/40 self-center" />
              <span className="numeric-display text-xl leading-none tracking-tight">
                {String(fotoMinutes).padStart(2, "0")}
              </span>
              <span aria-hidden className="w-px h-3 bg-signal-foreground/45 self-center" />
              <span className="numeric-display text-xl leading-none tracking-tight">
                {String(fotoSeconds).padStart(2, "0")}
              </span>
            </time>
          ) : (
            <>
              <span className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute">
                {stripLabel}
              </span>
              {(stripState === "preview-ready" || stripState === "idle") && (
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${stripState === "preview-ready" ? "bg-signal" : "bg-hairline-strong"}`}
                />
              )}
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 md:px-8 pt-6 pb-32">
        {/* ── Tabs + Unit toggle (right) ─────────────────────────────── */}
        <div className="flex items-end justify-between gap-4 mb-8 border-b border-hairline">
          <div className="flex gap-0">
            <button
              onClick={() => setActiveTab("manual")}
              aria-pressed={activeTab === "manual"}
              className={`px-4 pb-3 text-sm font-sans font-semibold tracking-wide transition-colors ${
                activeTab === "manual"
                  ? "text-bone border-b-[1px] border-signal"
                  : "text-mute hover:text-bone"
              }`}
            >
              Manual
            </button>
            <button
              onClick={() => setActiveTab("foto")}
              aria-pressed={activeTab === "foto"}
              className={`px-4 pb-3 text-sm font-sans font-semibold tracking-wide transition-colors inline-flex items-center gap-1.5 ${
                activeTab === "foto"
                  ? "text-bone border-b-[1px] border-signal"
                  : "text-mute hover:text-bone"
              }`}
            >
              Foto
              <Sparkles
                aria-hidden
                className={`size-3.5 ${activeTab === "foto" ? "text-signal" : "text-mute/70"}`}
              />
            </button>
          </div>

          {/* Display unit toggle — only meaningful in manual mode, but
              always visible so the coach can flip without context-switching. */}
          <div
            role="group"
            aria-label="Unidad de visualización"
            className="flex items-center gap-1.5 pb-3"
          >
            <span className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute mr-1">
              Unidad
            </span>
            <div className="flex rounded-sm overflow-hidden border border-hairline">
              {(["kg", "lb"] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setDisplayUnit(u)}
                  aria-pressed={displayUnit === u}
                  className={`numeric text-xs px-2.5 py-1 transition-colors ${
                    displayUnit === u
                      ? "bg-signal text-signal-foreground"
                      : "bg-transparent text-mute hover:text-bone"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Manual tab ─────────────────────────────────────────────── */}
        {activeTab === "manual" && (
          <div className="space-y-10">
            {/* BARRA */}
            <section className="space-y-4">
              <div className="flex items-baseline justify-between">
                <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute">
                  Barra
                </p>
                <span className="numeric text-[0.6875rem] text-mute">
                  {formatWeightForDisplay(barKg, displayUnit)} {displayUnit}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {COMMON_BAR_KG.map((w) => (
                  <button
                    key={w}
                    onClick={() => selectBar(w)}
                    aria-pressed={!showCustomBar && barKg === w}
                    className={`numeric text-sm px-3 py-1.5 rounded-sm border transition-colors ${
                      !showCustomBar && barKg === w
                        ? "bg-signal text-signal-foreground border-signal"
                        : "bg-transparent text-mute border-hairline hover:border-hairline-strong hover:text-bone"
                    }`}
                  >
                    {w} kg
                  </button>
                ))}
                <button
                  onClick={() => setShowCustomBar((v) => !v)}
                  aria-pressed={showCustomBar}
                  className={`numeric text-sm px-3 py-1.5 rounded-sm border transition-colors ${
                    showCustomBar
                      ? "bg-signal text-signal-foreground border-signal"
                      : "bg-transparent text-mute border-hairline hover:border-hairline-strong hover:text-bone"
                  }`}
                >
                  Otro…
                </button>
                {showCustomBar && (
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.5"
                    value={customBarKg}
                    onChange={(e) => {
                      const parsed = parseFloat(e.target.value);
                      if (!Number.isNaN(parsed) && parsed > 0) {
                        setCustomBarKg(e.target.value);
                      } else if (e.target.value === "") {
                        setCustomBarKg("");
                      }
                    }}
                    onBlur={handleCustomBarBlur}
                    onKeyDown={(e) => e.key === "Enter" && handleCustomBarBlur()}
                    placeholder="kg"
                    aria-label="Peso de barra personalizado en kg"
                    className="numeric text-sm w-24 px-3 py-1.5 bg-transparent border border-hairline rounded-sm text-bone placeholder:text-mute focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 outline-none"
                  />
                )}
              </div>
            </section>

            {/* DISCOS POR LADO */}
            <section className="space-y-4">
              <div className="flex items-baseline justify-between">
                <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute">
                  Discos por lado
                </p>
                {discs.length > 0 && (
                  <Button
                    variant="ghost"
                    onClick={handleLimpiar}
                    aria-label="Borrar toda la carga"
                    className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute hover:text-destructive rounded-md h-7 px-2.5 gap-1.5"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Limpiar
                  </Button>
                )}
              </div>

              {discs.length === 0 ? (
                <div
                  className="font-sans text-sm text-mute leading-relaxed py-3 px-4 border border-dashed border-hairline rounded-sm"
                >
                  Sumá discos. La barra sola ya carga{" "}
                  <span className="numeric text-bone">
                    {barKg} kg
                  </span>
                  .
                </div>
              ) : (
                <ul className="space-y-2">
                  {discs.map((disc) => (
                    <li
                      key={disc.id}
                      className="disc-row-enter flex items-center gap-2 px-2 py-1.5 border border-hairline rounded-sm bg-panel/40"
                    >
                      {/* Visual width — encodes the weight in pixels so
                          the coach can read "how heavy is this?" at a glance. */}
                      <span
                        aria-hidden
                        className="block bg-hairline-strong rounded-[1px] shrink-0"
                        style={{
                          width: `${discWidthPx(disc.weight, disc.unit)}px`,
                          height: "10px",
                        }}
                      />

                      {/* Weight */}
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.5"
                        value={disc.weight === 0 ? "" : disc.weight}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            updateDisc(disc.id, "weight", 0);
                            return;
                          }
                          const parsed = parseFloat(raw);
                          if (!Number.isNaN(parsed) && parsed >= 0) {
                            updateDisc(disc.id, "weight", parsed);
                          }
                        }}
                        aria-label={`Peso del disco en ${disc.unit}`}
                        className="numeric text-sm w-20 px-2 py-1.5 bg-transparent border border-hairline rounded-sm text-bone focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 outline-none"
                      />

                      {/* Unit toggle */}
                      <div className="flex rounded-sm overflow-hidden border border-hairline shrink-0">
                        {(["kg", "lb"] as const).map((u) => (
                          <button
                            key={u}
                            onClick={() => updateDisc(disc.id, "unit", u)}
                            aria-pressed={disc.unit === u}
                            className={`numeric text-xs px-2 py-1.5 transition-colors ${
                              disc.unit === u
                                ? "bg-signal text-signal-foreground"
                                : "bg-transparent text-mute hover:text-bone"
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>

                      {/* Count */}
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        value={disc.count === 0 ? "" : disc.count}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            updateDisc(disc.id, "count", 0);
                            return;
                          }
                          const parsed = parseInt(raw, 10);
                          if (!Number.isNaN(parsed) && parsed >= 0) {
                            updateDisc(disc.id, "count", parsed);
                          }
                        }}
                        aria-label="Cantidad de discos por lado"
                        className="numeric text-sm w-14 px-2 py-1.5 bg-transparent border border-hairline rounded-sm text-bone focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 outline-none"
                      />

                      <span
                        aria-hidden
                        className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute"
                      >
                        ×lado
                      </span>

                      <div className="flex-1" />

                      <button
                        onClick={() => removeDisc(disc.id)}
                        aria-label="Quitar disco"
                        className="size-7 rounded-md text-mute hover:text-destructive hover:bg-muted transition-colors flex items-center justify-center"
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <Button
                variant="ghost"
                onClick={addDisc}
                className="font-sans text-xs font-semibold uppercase tracking-[0.10em] text-mute hover:text-bone hover:bg-muted rounded-sm h-8 px-3 gap-1.5"
              >
                <Plus className="size-3.5" aria-hidden />
                Agregar disco
              </Button>
            </section>

            {/* BAR VISUALIZATION — the centerpiece. A thin horizontal bar
                with chalk-textured discs stacking on each side. Width of
                each disc-block is proportional to its weight in kg. */}
            <section className="pt-4">
              <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute mb-4">
                Vista de la barra
              </p>
              <BarVisualization
                barKg={barKg}
                discs={sortedDiscs}
                unit={displayUnit}
              />
            </section>

            {/* Saved records — last 5 labeled, plus a link to the full
                history. Only mounted in the Manual tab so the Photo flow's
                attention stays on the preview. */}
            <SavedRecordsPanel onLoad={handleLoadRecord} />
          </div>
        )}

        {/* ── Foto tab ───────────────────────────────────────────────── */}
        {activeTab === "foto" && (
          <FotoTab
            fotoState={fotoState}
            isDragOver={isDragOver}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onPickFile={() => fileInputRef.current?.click()}
            onChangeFile={onFileInput}
            onAccept={acceptFoto}
            onCancel={cancelFoto}
            onRetry={cancelFoto}
            fileInputRef={fileInputRef}
          />
        )}
      </main>

      {/* ── Sticky TOTAL footer ─────────────────────────────────────── */}
      <footer className="sticky bottom-0 bg-canvas border-t border-hairline">

        <div className="mx-auto max-w-2xl px-5 md:px-8 py-4 flex flex-col gap-3">
          {saveFormOpen && (
            <SaveRecordForm
              currentState={{ barKg, discs: discs.map(toPersist) }}
              onSaved={closeSaveForm}
              onCancel={closeSaveForm}
            />
          )}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute leading-none mb-1.5">
                Total · {discs.length === 0 ? "solo barra" : `${discs.length} ${discs.length === 1 ? "tipo" : "tipos"} de disco`}
              </p>
              <p className="numeric-display text-3xl md:text-[2rem] font-medium text-bone leading-none tracking-tight">
                <span className="whitespace-nowrap">
                  {discs.length === 0 && barKg === DEFAULT_BAR_KG && !storeLoaded
                    ? "—"
                    : displayUnit === "kg"
                      ? `${totals.totalKg.toFixed(1)} kg`
                      : `${totals.totalLb.toFixed(1)} lb`}
                </span>
                {displayUnit === "kg" && discs.length > 0 && (
                  <span className="text-mute font-normal text-[0.875rem] ml-3 align-baseline whitespace-nowrap">
                    · {totals.totalLb.toFixed(1)} lb
                  </span>
                )}
                {displayUnit === "lb" && discs.length > 0 && (
                  <span className="text-mute font-normal text-[0.875rem] ml-3 align-baseline whitespace-nowrap">
                    · {totals.totalKg.toFixed(1)} kg
                  </span>
                )}
              </p>
              <p className="numeric text-[0.8125rem] text-mute leading-snug mt-2">
                {discs.length === 0 ? `${barKg}kg` : breakdownLine}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSaveFormOpen(true)}
                disabled={discs.length === 0 && barKg === DEFAULT_BAR_KG}
                aria-label="Guardar carga con etiqueta"
                title={
                  discs.length === 0 && barKg === DEFAULT_BAR_KG
                    ? "Sin carga para guardar"
                    : undefined
                }
                ref={guardarButtonRef}
                className="font-sans text-xs font-semibold uppercase tracking-[0.10em] text-mute hover:text-bone hover:bg-muted rounded-md h-9 px-3 gap-1.5 disabled:opacity-30"
              >
                <BookmarkPlus className="size-3.5" aria-hidden />
                Guardar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const text = displayUnit === "kg"
                    ? `${totals.totalKg.toFixed(1)} kg · ${totals.totalLb.toFixed(1)} lb\n${breakdownLine}`
                    : `${totals.totalLb.toFixed(1)} lb · ${totals.totalKg.toFixed(1)} kg\n${breakdownLine}`;
                  navigator.clipboard.writeText(text).then(
                    () => toast.success("Carga copiada"),
                    () => toast.error("No se pudo copiar"),
                  );
                }}
                disabled={discs.length === 0}
                aria-label="Copiar carga"
                className="font-sans text-xs font-semibold uppercase tracking-[0.10em] text-mute hover:text-bone hover:bg-muted rounded-md h-9 px-3 gap-1.5 disabled:opacity-30"
              >
                <Copy className="size-3.5" aria-hidden />
                Copiar
              </Button>
            </div>
          </div>
        </div>

      </footer>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface BarVisualizationProps {
  barKg: number;
  discs: DiscRowUI[];
  unit: DisplayUnit;
}

function BarVisualization({ barKg, discs, unit }: BarVisualizationProps) {
  // The bar is rendered as a thin bar in the center. Discs attach to the
  // sleeves on each side, sorted heaviest-innermost (gym convention: heavy
  // plates go on the bar first, light bumper plates on the outside). Each
  // disc-block's width is proportional to its kg mass.
  //
  // Layout uses flex so the discs+bar always fit within the panel without
  // overflow on narrow viewports — the bar takes a min-width share and
  // shrinks when the discs would otherwise push it off-screen.
  const totalDiscWidth = discs.reduce(
    (acc, d) => acc + discWidthPx(d.weight, d.unit),
    0,
  );
  // Constrain the bar so the whole row never exceeds the available width.
  // Each side gets at most (panel-inner-width − bar-min) / 2 of disc budget.
  // We use a generous constant; CSS `min-w-0` keeps things tidy.
  return (
    <div className="bg-panel border border-hairline rounded-none px-5 py-8 overflow-x-auto">
      <div className="flex items-center justify-center gap-0 min-h-[88px] min-w-fit w-full">
        {/* LEFT SIDE — discs stacked outer-to-inner, visually mirrored.
            The prop arrives ascending (lightest → heaviest); we iterate
            directly so the lightest disc sits at the outer end (leftmost
            in this flex row) and the heaviest rests against the sleeve,
            matching real gym loading convention. */}
        <div className="flex items-center shrink min-w-0" aria-hidden>
          {discs.length === 0 ? (
            <span className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute/60 mr-3">
              Sin discos
            </span>
          ) : (
            discs.map((d) => (
              <DiscBlock
                key={`l-${d.id}`}
                side="left"
                toneClass={discToneClass(d.weight, d.unit)}
                widthPx={discWidthPx(d.weight, d.unit)}
                label={
                  <DiscLabel
                    weight={d.weight}
                    weightUnit={d.unit}
                    count={d.count}
                    displayUnit={unit}
                    widthPx={discWidthPx(d.weight, d.unit)}
                  />
                }
              />
            ))
          )}
        </div>

        {/* THE BAR — flex-1 so it claims any leftover space but never pushes
            the discs off-screen. min-w-[80px] keeps it from collapsing to
            nothing on small viewports. */}
        <div
          aria-hidden
          className="relative bg-bone/90 rounded-[1px] flex-1 min-w-[80px] max-w-[260px]"
          style={{ height: "6px" }}
        >
          {/* Center knurl markings */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center gap-[2px]">
            {Array.from({ length: 9 }).map((_, i) => (
              <span
                key={i}
                className="block w-px bg-canvas/60"
                style={{ height: i === 4 ? "12px" : "6px" }}
              />
            ))}
          </div>
          {/* End caps (sleeves) — the metal collars where the discs rest.
              Wider than the shaft, slightly extended above/below, with a
              hairline on the inside edge so the seam between collar and
              shaft reads as a deliberate metal-on-metal joint. */}
          <span className="bar-sleeve absolute inset-y-[-4px] left-0 w-[6px] border-r border-canvas/50" />
          <span className="bar-sleeve absolute inset-y-[-4px] right-0 w-[6px] border-l border-canvas/50" />
        </div>

        {/* RIGHT SIDE — discs stacked inner-to-outer (mirror of left).
            On this side the bar is to the left, so the *innermost* disc
            is the leftmost in the flex row. We reverse the ascending prop
            so the heaviest disc renders leftmost (closest to the sleeve)
            and the lightest sits at the rightmost (outer) end. */}
        <div className="flex items-center shrink min-w-0" aria-hidden>
          {[...discs].reverse().map((d) => (
            <DiscBlock
              key={`r-${d.id}`}
              side="right"
              toneClass={discToneClass(d.weight, d.unit)}
              widthPx={discWidthPx(d.weight, d.unit)}
              label={
                <DiscLabel
                  weight={d.weight}
                  weightUnit={d.unit}
                  count={d.count}
                  displayUnit={unit}
                  widthPx={discWidthPx(d.weight, d.unit)}
                />
              }
            />
          ))}
        </div>
      </div>

      {/* Bar mass legend */}
      <div className="mt-6 flex items-baseline justify-center gap-3">
        <span className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute">
          Barra
        </span>
        <span className="numeric text-sm text-bone">
          {formatWeightForDisplay(barKg, unit)} {unit}
        </span>
        <span aria-hidden className="text-mute/40">·</span>
        <span className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute">
          {totalDiscWidth === 0
            ? "0 kg en discos"
            : (() => {
                // Sum the per-side disc mass, round to 1 decimal so the legend
                // reads with the same precision as the TOTAL footer (kg sum
                // is otherwise printed with full float precision because
                // formatWeightForDisplay only rounds when converting to lb).
                const sumKg = discs.reduce(
                  (acc, d) =>
                    acc +
                    2 *
                      (d.unit === "kg"
                        ? d.weight * d.count
                        : lbToKg(d.weight) * d.count),
                  0,
                );
                const display = formatWeightForDisplay(
                  Math.round(sumKg * 10) / 10,
                  unit,
                );
                return `Discos ${display} ${unit}`;
              })()}
        </span>
      </div>
    </div>
  );
}

function DiscBlock({
  widthPx,
  label,
  side,
  toneClass,
}: {
  widthPx: number;
  label: React.ReactNode;
  side: "left" | "right";
  toneClass: string;
}) {
  // Chalk-disc visual: a textured block whose fill is `bone` (the actual
  // chalk line), with a hairline border on top/bottom that reads as the
  // edge of the plate. The number sits inside in mono tabular.
  //
  // Motion: the width IS the encoded weight — when the weight changes,
  // .disc-block transitions `width` over 200ms so the plate visibly
  // "fills" the bar. On mount, .disc-block-enter-{side} slides the plate
  // in from the sleeve (gym convention: heavy plates inside, light bumpers
  // stack outward). See globals.css for the keyframes.
  //
  // Surface: toneClass encodes density (iron/standard/bumper); the inner
  // .disc-chalk-texture overlay adds a chalk-dust grain via SVG noise
  // multiply-blended at low opacity.
  return (
    <div
      className={`disc-block relative ${toneClass} border-y border-canvas/40 first:border-l last:border-r shrink-0 ${
        side === "left" ? "disc-block-enter-left" : "disc-block-enter-right"
      }`}
      style={{
        width: `${widthPx}px`,
        height: "44px",
        marginLeft: "-1px",
      }}
    >
      <div className="disc-chalk-texture absolute inset-0" aria-hidden />
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        {label}
      </div>
    </div>
  );
}

function DiscLabel({
  weight,
  weightUnit,
  count,
  displayUnit,
  widthPx,
}: {
  weight: number;
  weightUnit: "kg" | "lb";
  count: number;
  displayUnit: DisplayUnit;
  widthPx: number;
}) {
  // Inside each disc we render the per-side weight. The disc-block already
  // encodes its weight visually via width, so the label is just confirmation.
  // Below ~32px we drop the label — there's no room to read it.
  //
  // The label shows the weight in the current display unit. The disc's
  // internal weight stays in its entered unit (kg or lb), so we have to
  // convert here — not assume `formatWeightForDisplay(weight, displayUnit)`
  // works on a weight that's already in the target unit. formatWeightForDisplay
  // assumes kg input; here we know the source unit and do the right thing.
  if (widthPx < 32) return null;
  const displayValue =
    weightUnit === displayUnit
      ? weight
      : weightUnit === "kg"
        ? Math.round(weight * KG_PER_LB * 10) / 10
        : Math.round((weight / KG_PER_LB) * 10) / 10;
  return (
    <span className="numeric text-[0.6875rem] leading-none text-canvas font-semibold tracking-tight whitespace-nowrap">
      {displayValue}
      {count > 1 && widthPx >= 56 && <span className="ml-0.5">×{count}</span>}
    </span>
  );
}

// ─── Foto tab ────────────────────────────────────────────────────────────────

interface FotoTabProps {
  fotoState: FotoState;
  isDragOver: boolean;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onPickFile: () => void;
  onChangeFile: (e: ChangeEvent<HTMLInputElement>) => void;
  onAccept: () => void;
  onCancel: () => void;
  onRetry: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

function FotoTab({
  fotoState,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onPickFile,
  onChangeFile,
  onAccept,
  onCancel,
  onRetry,
  fileInputRef,
}: FotoTabProps) {
  // ── Drop zone (idle) ───────────────────────────────────────────────────
  if (fotoState.kind === "idle") {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="font-sans text-base text-bone leading-snug">
            Sacale una foto a la barra y dejamos el cálculo hecho.
          </p>
          <p className="font-sans text-sm text-mute leading-relaxed max-w-md">
            Identificamos la barra y los discos de cada lado. Vas a poder
            revisar antes de aplicar la carga.
          </p>
        </div>

        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={onPickFile}
          role="button"
          tabIndex={0}
          aria-label="Subir foto de la barra"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onPickFile();
            }
          }}
          className={`relative border border-dashed rounded-none py-14 px-6 text-center cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/40 ${
            isDragOver
              ? "border-signal bg-signal/[0.04]"
              : "border-hairline-strong hover:border-bone/40 hover:bg-panel/40"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={onChangeFile}
            className="sr-only"
          />
          <div className="flex flex-col items-center gap-3">
            <span className="size-10 flex items-center justify-center border border-hairline rounded-sm text-mute">
              <ImagePlus className="size-5" aria-hidden />
            </span>
            <p className="font-sans text-sm text-bone">
              {isDragOver ? "Soltá la imagen" : "Subí una imagen o arrastrala acá"}
            </p>
            <p className="font-sans text-xs text-mute">
              JPG · PNG · WEBP — máx. 5 MB
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Analyzing ──────────────────────────────────────────────────────────
  if (fotoState.kind === "analyzing") {
    return (
      <div className="space-y-6">
        <FotoThumbnail src={fotoState.imageDataUrl} alt="Foto de la barra" />
        <div className="chalk-card chalk-card-reveal">
          <div className="flex items-center gap-3">
            <Loader2 className="size-4 animate-spin text-signal" aria-hidden />
            <p className="font-sans text-sm text-bone">
              Leyendo la barra y los discos…
            </p>
          </div>
          <p className="font-sans text-[0.8125rem] text-mute mt-2 leading-relaxed">
            La identificación suele tardar entre 5 y 20 segundos según la
            calidad de la foto.
          </p>
        </div>
      </div>
    );
  }

  // ── Preview ─────────────────────────────────────────────────────────────
  if (fotoState.kind === "preview") {
    const { breakdown, uncertain, model } = fotoState;
    return (
      <div className="space-y-6">
        <FotoThumbnail src={fotoState.imageDataUrl} alt="Foto de la barra" />

        <div className="chalk-card chalk-card-reveal space-y-5">
          <header className="flex items-baseline justify-between gap-3 pb-3 border-b border-hairline">
            <div>
              <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute">
                Lectura del modelo
              </p>
              <p className="font-display italic font-semibold text-2xl leading-tight tracking-tight mt-1">
                {breakdown.barKg} kg{" "}
                <span className="text-mute font-sans not-italic font-normal text-sm">
                  + {(breakdown.totalKg - breakdown.barKg).toFixed(1)} kg en discos
                </span>
              </p>
            </div>
            <span className="numeric-label text-[0.6875rem] text-mute shrink-0">
              {model}
            </span>
          </header>

          {uncertain && (
            <div
              role="status"
              className="px-3 py-2 border border-signal/40 bg-signal/[0.06] text-bone text-xs leading-relaxed flex gap-2"
            >
              <span className="font-display italic font-semibold shrink-0">!</span>
              <span>
                Algún disco o la barra no se identificaron con certeza. Revisá
                antes de aplicar.
              </span>
            </div>
          )}

          <div>
            <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute mb-3">
              Discos por lado
            </p>
            {breakdown.discs.length === 0 ? (
              <p className="font-sans text-sm text-mute leading-relaxed">
                No detectamos discos. Solo la barra.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {breakdown.discs.map((d, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 numeric text-sm text-bone px-2 py-1.5 border border-hairline rounded-sm bg-canvas/40"
                  >
                    <span
                      aria-hidden
                      className="block bg-hairline-strong rounded-[1px] shrink-0"
                      style={{
                        width: `${discWidthPx(d.weight, d.unit)}px`,
                        height: "8px",
                      }}
                    />
                    <span>{d.weight}</span>
                    <span className="text-mute">{d.unit}</span>
                    <span className="text-mute">×</span>
                    <span>{d.count}</span>
                    <span className="text-mute text-[0.6875rem] uppercase tracking-[0.10em] font-sans font-semibold">
                      por lado
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className="pt-3 border-t border-hairline flex flex-wrap items-center gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={onCancel}
              className="font-sans text-xs font-semibold uppercase tracking-[0.10em] text-mute hover:text-bone bg-transparent hover:bg-muted rounded-md h-9 px-3"
            >
              Descartar
            </Button>
            <Button
              onClick={onAccept}
              className="font-sans text-xs font-semibold uppercase tracking-[0.10em] bg-signal text-signal-foreground hover:bg-signal-deep rounded-md h-9 px-3.5 gap-1.5"
            >
              <Check className="size-3.5" aria-hidden />
              Aplicar a la carga
            </Button>
          </footer>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <FotoThumbnail src={fotoState.imageDataUrl} alt="Foto de la barra" />
      <div className="chalk-card chalk-card-reveal border-destructive/40">
        <div className="flex items-start gap-3">
          <span className="size-7 flex items-center justify-center border border-destructive/40 text-destructive rounded-sm shrink-0">
            <X className="size-4" aria-hidden />
          </span>
          <div className="flex-1">
            <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-destructive">
              No pudimos leer la imagen
            </p>
            <p className="font-sans text-sm text-bone mt-1 leading-relaxed">
              {fotoState.message}
            </p>
          </div>
        </div>
        <footer className="mt-5 pt-3 border-t border-hairline flex flex-wrap items-center gap-2 justify-end">
          <Button
            variant="ghost"
            onClick={onRetry}
            className="font-sans text-xs font-semibold uppercase tracking-[0.10em] text-mute hover:text-bone bg-transparent hover:bg-muted rounded-md h-9 px-3"
          >
            Volver
          </Button>
          <Button
            onClick={onPickFile}
            className="font-sans text-xs font-semibold uppercase tracking-[0.10em] bg-signal text-signal-foreground hover:bg-signal-deep rounded-md h-9 px-3.5 gap-1.5"
          >
            <ImagePlus className="size-3.5" aria-hidden />
            Probar con otra foto
          </Button>
        </footer>
      </div>
    </div>
  );
}

function FotoThumbnail({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="border border-hairline rounded-none overflow-hidden bg-panel">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="block w-full max-h-[280px] object-contain bg-canvas"
      />
    </figure>
  );
}
