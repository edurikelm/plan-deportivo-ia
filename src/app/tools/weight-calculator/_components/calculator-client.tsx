"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type CalculatorState, formatBreakdownLine } from "@/lib/calculator";
import {
  getCalculatorState,
  setCalculatorState,
} from "@/lib/storage";
import { useHydrated } from "@/hooks/use-hydrated";

// ─── Types ───────────────────────────────────────────────────────────────────

type ActiveTab = "manual" | "foto";
type FotoState = "idle" | "photo-loaded" | "analyzing" | "preview-ready";

interface DiscRowUI {
  id: string;
  weight: number;
  unit: "kg" | "lb";
  count: number;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_BAR_KG = 20;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strips the UI-only `id` field from a DiscRowUI to produce a persistable disc. */
function toPersist(disc: DiscRowUI): { weight: number; unit: "kg" | "lb"; count: number } {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- id is intentionally discarded
  const { id: _id, ...rest } = disc;
  return rest;
}

function computeTotal(state: { barKg: number; discs: Array<{ weight: number; unit: "kg" | "lb"; count: number }> }): { kg: number; lb: number } {
  const lbToKg = (lb: number) => lb / 2.20462;
  const discKg = state.discs.reduce(
    (acc, d) =>
      acc +
      2 *
        (d.unit === "kg" ? d.weight * d.count : lbToKg(d.weight) * d.count),
    0,
  );
  const kg = state.barKg + discKg;
  return { kg, lb: kg * 2.20462 };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CalculatorClient() {
  const hydrated = useHydrated();

  // Calculator state
  const [barKg, setBarKg] = useState(DEFAULT_BAR_KG);
  const [discs, setDiscs] = useState<DiscRowUI[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<ActiveTab>("manual");
  const [fotoState] = useState<FotoState>("idle");

  // Bar "Otro" custom value
  const [customBarKg, setCustomBarKg] = useState<string>("");
  const [showCustomBar, setShowCustomBar] = useState(false);

  // ─── Hydration ─────────────────────────────────────────────────────────────

  // Use a ref to track if we've already synced from localStorage to avoid re-running.
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

  // ─── Bar handlers ──────────────────────────────────────────────────────────

  function selectBar(value: number) {
    setBarKg(value);
    setShowCustomBar(false);
    setCustomBarKg("");
  }

  function handleCustomBarBlur() {
    const parsed = parseFloat(customBarKg);
    if (!isNaN(parsed) && parsed > 0) {
      setBarKg(parsed);
      setShowCustomBar(true);
    } else {
      setShowCustomBar(false);
      setCustomBarKg("");
    }
  }

  // ─── Disc handlers ─────────────────────────────────────────────────────────

  function addDisc() {
    setDiscs((prev) => [
      ...prev,
      { id: `disc-${Date.now()}`, weight: 20, unit: "kg", count: 1 },
    ]);
  }

  function removeDisc(id: string) {
    setDiscs((prev) => prev.filter((d) => d.id !== id));
  }

  function updateDisc(id: string, key: keyof DiscRowUI, value: number | string) {
    setDiscs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [key]: value } : d)),
    );
  }

  // ─── Limpiar ──────────────────────────────────────────────────────────────

  function handleLimpiar() {
    if (!window.confirm("¿Borrar la carga actual?")) return;
    setBarKg(DEFAULT_BAR_KG);
    setDiscs([]);
    setShowCustomBar(false);
    setCustomBarKg("");
  }

  // ─── Derived ─────────────────────────────────────────────────────────────

  const calculatorState: CalculatorState = { barKg, discs };
  const total = computeTotal({ barKg, discs: discs.map(toPersist) });
  const breakdownLine = formatBreakdownLine(calculatorState);

  // Status strip state
  const stripState: "idle" | "active" | "preview-ready" =
    fotoState === "analyzing"
      ? "active"
      : fotoState === "preview-ready"
        ? "preview-ready"
        : "idle";

  // ─── Render ─────────────────────────────────────────────────────────────

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
              Calculadora de Pesos
            </h1>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* ── Status strip ─────────────────────────────────────────────── */}
      <header className="status-strip" data-state={stripState}>
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
            Calculadora de Pesos
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {stripState === "idle" && (
            <span className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute">
              LISTO
            </span>
          )}
          {stripState === "active" && (
            <span className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-signal">
              Analizando…
            </span>
          )}
          {stripState === "preview-ready" && (
            <>
              <span className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute">
                REVISAR PREVIEW
              </span>
              <span className="size-1.5 rounded-full bg-signal" aria-hidden />
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 md:px-8 py-6 pb-36">
        {/* ── Tabs ───────────────────────────────────────────────────── */}
        <div className="flex gap-0 mb-8 border-b border-hairline">
          <button
            onClick={() => setActiveTab("manual")}
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
            className={`px-4 pb-3 text-sm font-sans font-semibold tracking-wide transition-colors ${
              activeTab === "foto"
                ? "text-bone border-b-[1px] border-signal"
                : "text-mute hover:text-bone"
            }`}
          >
            Foto
          </button>
        </div>

        {/* ── Manual tab ─────────────────────────────────────────────── */}
        {activeTab === "manual" && (
          <div className="space-y-8">
            {/* Limpiar */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                onClick={handleLimpiar}
                className="font-sans text-xs font-semibold uppercase tracking-[0.10em] text-mute hover:text-bone hover:bg-muted rounded-sm h-7 px-3"
              >
                Limpiar
              </Button>
            </div>

            {/* BARRA */}
            <section className="space-y-3">
              <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute">
                Barra
              </p>
              <div className="flex flex-wrap gap-2">
                {[15, 20].map((w) => (
                  <button
                    key={w}
                    onClick={() => selectBar(w)}
                    className={`font-mono tabular-nums text-sm px-3 py-1.5 rounded-sm border transition-colors ${
                      !showCustomBar && barKg === w
                        ? "bg-signal text-signal-foreground border-signal"
                        : "bg-transparent text-mute border-hairline hover:border-hairline-strong"
                    }`}
                  >
                    {w} kg
                  </button>
                ))}
                <button
                  onClick={() => setShowCustomBar((v) => !v)}
                  className={`font-mono tabular-nums text-sm px-3 py-1.5 rounded-sm border transition-colors ${
                    showCustomBar
                      ? "bg-signal text-signal-foreground border-signal"
                      : "bg-transparent text-mute border-hairline hover:border-hairline-strong"
                  }`}
                >
                  Otro…
                </button>
              </div>
              {showCustomBar && (
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={customBarKg}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value);
                    if (isNaN(parsed) || parsed <= 0) return;
                    setCustomBarKg(e.target.value);
                  }}
                  onBlur={handleCustomBarBlur}
                  onKeyDown={(e) => e.key === "Enter" && handleCustomBarBlur()}
                  placeholder="kg"
                  className="font-mono tabular-nums text-sm w-28 px-3 py-1.5 bg-transparent border border-hairline rounded-sm text-bone placeholder:text-mute focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 outline-none"
                />
              )}
            </section>

            {/* DISCOS POR LADO */}
            <section className="space-y-3">
              <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute">
                Discos por lado
              </p>

              {discs.length === 0 ? (
                <p className="font-sans text-sm text-mute py-2">
                  Agregá discos usando el botón de abajo.
                </p>
              ) : (
                <ul className="space-y-2">
                  {discs.map((disc) => (
                    <li key={disc.id} className="flex items-center gap-2">
                      {/* Weight */}
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={disc.weight}
                        onChange={(e) => {
                          const parsed = parseFloat(e.target.value);
                          if (!isNaN(parsed) && parsed > 0) {
                            updateDisc(disc.id, "weight", parsed);
                          }
                        }}
                        className="font-mono tabular-nums text-sm w-20 px-2 py-1.5 bg-transparent border border-hairline rounded-sm text-bone focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 outline-none"
                      />

                      {/* Unit toggle */}
                      <div className="flex rounded-sm overflow-hidden border border-hairline">
                        {(["kg", "lb"] as const).map((u) => (
                          <button
                            key={u}
                            onClick={() => updateDisc(disc.id, "unit", u)}
                            className={`font-mono tabular-nums text-xs px-2 py-1.5 transition-colors ${
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
                        min="1"
                        step="1"
                        value={disc.count}
                        onChange={(e) =>
                          updateDisc(disc.id, "count", parseInt(e.target.value) || 1)
                        }
                        className="font-mono tabular-nums text-sm w-14 px-2 py-1.5 bg-transparent border border-hairline rounded-sm text-bone focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 outline-none"
                      />

                      {/* Remove */}
                      <button
                        onClick={() => removeDisc(disc.id)}
                        className="size-7 rounded-md text-mute hover:text-destructive hover:bg-muted transition-colors flex items-center justify-center"
                        aria-label="Quitar disco"
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
                className="font-sans text-xs font-semibold uppercase tracking-[0.10em] text-mute hover:text-bone hover:bg-muted rounded-sm h-8 px-3 gap-1.5 mt-2"
              >
                <Plus className="size-3.5" />
                Agregar disco
              </Button>
            </section>
          </div>
        )}

        {/* ── Foto tab (placeholder) ──────────────────────────────────── */}
        {activeTab === "foto" && (
          <div className="py-12 text-center">
            <p className="font-sans text-sm text-mute leading-relaxed max-w-xs mx-auto">
              Próximamente: identificación de barra con foto. Mientras tanto, usá la tab
              Manual.
            </p>
          </div>
        )}
      </main>

      {/* ── Sticky bottom total ──────────────────────────────────────── */}
      <footer className="sticky bottom-0 bg-canvas border-t border-hairline">
        <div className="mx-auto max-w-xl px-5 md:px-8 py-4 flex gap-4">
          <div className="border-l-[1px] border-signal pl-4 flex flex-col gap-1">
              <p className="font-mono tabular-nums text-2xl font-medium text-bone leading-none tracking-tight">
              TOTAL ·{" "}
              {discs.length === 0 && barKg === DEFAULT_BAR_KG
                ? "— · —"
                : `${total.kg.toFixed(1)} kg · ${total.lb.toFixed(1)} lb`}
            </p>
            <p className="font-mono tabular-nums text-sm text-mute leading-none">
              {breakdownLine}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
