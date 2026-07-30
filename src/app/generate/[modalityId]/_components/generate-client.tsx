"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Copy, Download, Pencil, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  addSession,
  getRecentSessions,
  updateSession,
} from "@/lib/storage";
import {
  CrossFitPlanView,
  type CrossFitSessionInput,
  type CrossFitPlan,
} from "@/lib/modalities/crossfit";
import { getModality } from "@/lib/modalities/modalities";
import type { SavedSession } from "@/lib/types";

interface GenerateClientProps {
  modalityId: string;
}

interface FormErrors {
  strengthSkill?: string;
  wodFormat?: string;
}

type WodFormat = "AMRAP" | "EMOM" | "For Time" | "Tabata" | "Intervalos" | "Aleatorio";

const WOD_FORMAT_OPTIONS: WodFormat[] = [
  "AMRAP",
  "EMOM",
  "For Time",
  "Tabata",
  "Intervalos",
  "Aleatorio",
];

export function GenerateClient({ modalityId }: GenerateClientProps) {
  const hydrated = useHydrated();
  const modality = getModality(modalityId) ?? null;

  // Form state
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [strengthSkill, setStrengthSkill] = useState("");
  const [wodFormat, setWodFormat] = useState<WodFormat>("AMRAP");
  const [focusMovement, setFocusMovement] = useState("");
  const [considerations, setConsiderations] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  // Generation state
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  // Result state (SavedSession — the "active idea")
  const [result, setResult] = useState<SavedSession | null>(null);
  const [persisted, setPersisted] = useState(false);

  // Edit mode
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [editedMarkdown, setEditedMarkdown] = useState<string | null>(null);

  // Mini-history — loaded lazily on mount, refreshed after save
  const [recentSessions, setRecentSessions] = useState<SavedSession[]>(() =>
    hydrated ? getRecentSessions(5) : [],
  );

  const refreshRecentSessions = useCallback(() => {
    setRecentSessions(getRecentSessions(5));
  }, []);

  // Accessibility
  const [announcement, setAnnouncement] = useState("");
  const prevBusyRef = useRef(false);
  const lastOutcomeRef = useRef<"ok" | "error">("ok");

  const hasPendingEdit =
    mode === "edit" &&
    editedMarkdown !== null &&
    editedMarkdown !== (result?.markdown ?? "");

  // Cronómetro
  useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [busy]);

  // A11y announcements
  useEffect(() => {
    if (busy && !prevBusyRef.current) {
      setAnnouncement("Generando plan");
    } else if (!busy && prevBusyRef.current) {
      setAnnouncement(
        lastOutcomeRef.current === "ok"
          ? "Plan generado"
          : "No se pudo generar el plan",
      );
    }
    prevBusyRef.current = busy;
  }, [busy]);

  // Autofoco editor
  useEffect(() => {
    if (mode === "edit" && editorRef.current) {
      editorRef.current.focus();
    }
  }, [mode]);

  // Cleanup AbortController
  useEffect(() => {
    const controller = abortRef.current;
    return () => {
      controller?.abort();
      abortRef.current = null;
    };
  }, []);

  // Pure check — safe to call during render (no setState).
  // Used by `disabled` props to gate the Regenerar button.
  function validate(): boolean {
    if (!strengthSkill.trim()) return false;
    if (!wodFormat) return false;
    return true;
  }

  // Side-effecting variant — mutates `errors` state. Use only inside event handlers.
  function validateAndSetErrors(): boolean {
    const newErrors: FormErrors = {};
    if (!strengthSkill.trim()) {
      newErrors.strengthSkill = "Strength/Skill es obligatorio";
    }
    if (!wodFormat) {
      newErrors.wodFormat = "El formato WOD es obligatorio";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function buildInput(): CrossFitSessionInput {
    return {
      durationMinutes: durationMinutes as CrossFitSessionInput["durationMinutes"],
      strengthSkill: strengthSkill.trim(),
      wodFormat,
      focusMovement: focusMovement.trim() || undefined,
      considerations: considerations.trim() || undefined,
    };
  }

  /**
   * Extracts the session title from the first `# Heading` line of the
   * provider's markdown output. Returns null if no `#` line is found.
   */
  function extractTitle(markdown: string): string | null {
    const match = markdown.match(/^#\s+(.+?)\s*$/m);
    return match ? match[1].trim() : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAndSetErrors()) return;

    setElapsed(0);
    setBusy(true);
    lastOutcomeRef.current = "ok";
    const controller = new AbortController();
    abortRef.current = controller;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      timeoutId = setTimeout(() => controller.abort(), 60_000);
      const input = buildInput();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modalityId, input }),
        signal: controller.signal,
      });

      const data = (await res.json()) as {
        ok: boolean;
        content?: string;
        structured?: CrossFitPlan | null;
        model?: string;
        error?: string;
      };

      if (!data.ok || !data.content) {
        throw new Error(data.error ?? "Error generando la sesión");
      }

      // Title comes from the structured plan (issue 0011 — Text-01 returns
      // reliable JSON). Fallback to markdown first line, then to date.
      const title =
        data.structured?.class_title ??
        extractTitle(data.content) ??
        `CrossFit ${new Date().toLocaleDateString("es-AR")}`;

      const session: SavedSession = {
        id: crypto.randomUUID(),
        modalityId,
        createdAt: new Date().toISOString(),
        model: data.model ?? "MiniMax-Text-01",
        markdown: data.content,
        structured: data.structured ?? null,
        input,
        title,
      };

      setResult(session);
      setEditedMarkdown(null);
      setMode("view");
      setPersisted(false);
      toast.success("Plan generado");
    } catch {
      lastOutcomeRef.current = "error";
      toast.error("No se pudo generar el plan. Intenta de nuevo.");
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      abortRef.current = null;
      setBusy(false);
    }
  }

  function handleCopy() {
    if (!result) return;
    const text = editedMarkdown ?? result.markdown;
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copiado al portapapeles"),
      () => toast.error("No se pudo copiar"),
    );
  }

  function handleExport() {
    if (!result) return;
    const text = editedMarkdown ?? result.markdown;
    const slug = modality?.label.toLowerCase().replace(/\s+/g, "-") ?? "session";
    const date = new Date().toLocaleDateString("en-CA");
    const filename = `${slug}-${date}.md`;
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSave() {
    if (!result) return;
    const markdown = editedMarkdown ?? result.markdown;
    // Re-validate markdown if it was edited (basic sanity check)
    const updated: SavedSession = {
      ...result,
      markdown,
      // structured stays as-is; if the user edited markdown in a way that
      // breaks the structured data, markdown is the source of truth
      structured: result.structured,
    };
    if (persisted) {
      updateSession(updated);
    } else {
      addSession(updated);
      setPersisted(true);
      refreshRecentSessions();
    }
    setResult(updated);
    setEditedMarkdown(null);
    setMode("view");
    toast.success("Sesión guardada");
  }

  async function handleRegenerate() {
    if (!validateAndSetErrors()) return;

    if (hasPendingEdit) {
      if (!window.confirm("Tenés cambios sin guardar. ¿Descartarlos?")) return;
      setEditedMarkdown(null);
      setMode("view");
    }

    setElapsed(0);
    setBusy(true);
    lastOutcomeRef.current = "ok";
    const controller = new AbortController();
    abortRef.current = controller;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      timeoutId = setTimeout(() => controller.abort(), 60_000);
      const input = buildInput();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modalityId, input }),
        signal: controller.signal,
      });

      const data = (await res.json()) as {
        ok: boolean;
        content?: string;
        structured?: CrossFitPlan | null;
        model?: string;
        error?: string;
      };

      if (!data.ok || !data.content) {
        throw new Error(data.error ?? "Error generando la sesión");
      }

      const title =
        data.structured?.class_title ??
        extractTitle(data.content) ??
        `CrossFit ${new Date().toLocaleDateString("es-AR")}`;

      const updated: SavedSession = {
        ...(result ?? {
          id: crypto.randomUUID(),
          modalityId,
          createdAt: new Date().toISOString(),
          model: data.model ?? "MiniMax-Text-01",
          input: buildInput(),
          title: "",
        }),
        model: data.model ?? "MiniMax-Text-01",
        markdown: data.content,
        structured: data.structured ?? null,
        input: buildInput(),
        title,
        createdAt: new Date().toISOString(),
      };

      setResult(updated);
      setEditedMarkdown(null);
      setMode("view");
      toast.success("Plan regenerado");
    } catch {
      lastOutcomeRef.current = "error";
      toast.error("No se pudo regenerar el plan. Intenta de nuevo.");
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      abortRef.current = null;
      setBusy(false);
    }
  }

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  // ─── Render ────────────────────────────────────────────────────────────────

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
        <main className="mx-auto max-w-3xl px-5 md:px-8 py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.10em] text-mute">
            Cargando…
          </p>
        </main>
      </div>
    );
  }

  if (!modality) {
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
            <h1 className="font-display italic font-semibold text-lg tracking-tight">
              Modalidad no encontrada
            </h1>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-5 md:px-8 py-20">
          <div className="chalk-card max-w-md">
            <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute mb-3">
              Estado · 404
            </p>
            <p className="text-bone mb-1">Esta modalidad no existe.</p>
            <p className="text-sm text-mute leading-relaxed mb-6">
              Volvé al catálogo para elegir una modalidad.
            </p>
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link href="/classes" />}
              className="font-sans text-xs font-semibold uppercase tracking-[0.10em] text-bone bg-transparent hover:bg-muted rounded-md h-9 px-4"
            >
              Volver al catálogo
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Status strip */}
      <header
        className="status-strip"
        data-state={busy ? "active" : "idle"}
      >
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
            {busy
              ? "Generando"
              : result
                ? `Generar — ${modality.label}`
                : modality.label}
          </h1>
        </div>

        {busy ? (
          <time
            dateTime={`PT${minutes}M${seconds}S`}
            className="flex items-center gap-2 font-mono tabular-nums"
          >
            <span
              aria-hidden
              className="font-display italic font-medium text-[0.6875rem] uppercase tracking-[0.16em] text-signal-foreground/70 self-center"
            >
              Generando
            </span>
            <span aria-hidden className="w-px h-4 bg-signal-foreground/40 self-center" />
            <span className="text-2xl leading-none tabular-nums tracking-tight">
              {String(minutes).padStart(2, "0")}
            </span>
            <span aria-hidden className="w-px h-3 bg-signal-foreground/45 self-center" />
            <span className="text-2xl leading-none tabular-nums tracking-tight">
              {String(seconds).padStart(2, "0")}
            </span>
          </time>
        ) : result ? (
          <Button
            onClick={handleRegenerate}
            disabled={busy || !validate()}
            className="font-mono tabular text-[0.6875rem] font-semibold uppercase tracking-[0.10em] border border-signal bg-transparent text-signal hover:bg-signal hover:text-signal-foreground rounded-md px-3 h-8 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Regenerar
          </Button>
        ) : (
          <Button
            type="submit"
            form="generate-form"
            disabled={busy}
            className="font-mono tabular text-[0.6875rem] font-semibold uppercase tracking-[0.10em] border border-signal bg-transparent text-signal hover:bg-signal hover:text-signal-foreground rounded-md px-3 h-8 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Generar
          </Button>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-5 md:px-8 py-10 space-y-8">
        {/* A11y live region */}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </div>

        {/* Session form */}
        <form
          id="generate-form"
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          {/* Duración */}
          <div className="space-y-2">
            <label
              id="duration-label"
              htmlFor="duration"
              className="block font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute"
            >
              Duración
            </label>
            <Select
              value={durationMinutes}
              onValueChange={(v) => { if (v != null) setDurationMinutes(v); }}
              disabled={busy}
              aria-labelledby="duration-label"
            >
              <SelectTrigger
                id="duration"
                className="h-10 px-3.5 bg-transparent border border-hairline rounded-sm text-bone font-mono tabular focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 data-[placeholder]:text-mute"
              >
                <SelectValue placeholder="60 min" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-hairline text-bone">
                <SelectItem value="45">45 min</SelectItem>
                <SelectItem value="60">60 min</SelectItem>
                <SelectItem value="75">75 min</SelectItem>
                <SelectItem value="90">90 min</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Strength / Skill */}
          <div className="space-y-2">
            <label
              htmlFor="strengthSkill"
              className="block font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute"
            >
              Strength / Skill{" "}
              <span className="text-destructive normal-case tracking-normal font-normal">
                *
              </span>
            </label>
            <Textarea
              id="strengthSkill"
              placeholder="p. ej. Back Squat 5x5 @ 70% 1RM — técnica de sentadilla"
              value={strengthSkill}
              onChange={(e) => setStrengthSkill(e.target.value)}
              disabled={busy}
              aria-invalid={Boolean(errors.strengthSkill)}
              aria-describedby={errors.strengthSkill ? "strengthSkill-error" : undefined}
              className="min-h-24 px-3.5 py-3 bg-transparent border border-hairline rounded-sm text-bone placeholder:text-mute focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 resize-y disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {errors.strengthSkill && (
              <p
                id="strengthSkill-error"
                className="font-sans text-[0.8125rem] text-destructive"
              >
                {errors.strengthSkill}
              </p>
            )}
          </div>

          {/* WOD Format */}
          <div className="space-y-2">
            <label
              id="wodFormat-label"
              htmlFor="wodFormat"
              className="block font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute"
            >
              Formato WOD{" "}
              <span className="text-destructive normal-case tracking-normal font-normal">
                *
              </span>
            </label>
            <Select
              value={wodFormat}
              onValueChange={(v) => setWodFormat(v as WodFormat)}
              disabled={busy}
              aria-labelledby="wodFormat-label"
              aria-describedby={errors.wodFormat ? "wodFormat-error" : undefined}
            >
              <SelectTrigger
                id="wodFormat"
                aria-invalid={Boolean(errors.wodFormat)}
                className="h-10 px-3.5 bg-transparent border border-hairline rounded-sm text-bone font-mono tabular focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 data-[placeholder]:text-mute"
              >
                <SelectValue placeholder="Seleccionar formato…" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-hairline text-bone">
                {WOD_FORMAT_OPTIONS.map((fmt) => (
                  <SelectItem key={fmt} value={fmt}>
                    {fmt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.wodFormat && (
              <p
                id="wodFormat-error"
                className="font-sans text-[0.8125rem] text-destructive"
              >
                {errors.wodFormat}
              </p>
            )}
          </div>

          {/* Foco de movimiento */}
          <div className="space-y-2">
            <label
              htmlFor="focusMovement"
              className="block font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute"
            >
              Foco de movimiento{" "}
              <span className="ml-2 text-[0.6875rem] font-normal normal-case tracking-normal text-mute">
                (opcional)
              </span>
            </label>
            <Textarea
              id="focusMovement"
              placeholder="p. ej. Double Unders, Pull-Ups, Thrusters…"
              value={focusMovement}
              onChange={(e) => setFocusMovement(e.target.value)}
              disabled={busy}
              className="min-h-16 px-3.5 py-3 bg-transparent border border-hairline rounded-sm text-bone placeholder:text-mute focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 resize-y disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Consideraciones */}
          <div className="space-y-2">
            <label
              htmlFor="considerations"
              className="block font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute"
            >
              Consideraciones del entrenador{" "}
              <span className="ml-2 text-[0.6875rem] font-normal normal-case tracking-normal text-mute">
                (opcional)
              </span>
            </label>
            <Textarea
              id="considerations"
              placeholder="Lesiones, nivel del grupo, equipamiento disponible…"
              value={considerations}
              onChange={(e) => setConsiderations(e.target.value)}
              disabled={busy}
              className="min-h-16 px-3.5 py-3 bg-transparent border border-hairline rounded-sm text-bone placeholder:text-mute focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 resize-y disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </form>

        {/* Result card */}
        {result && (
          <>
            <article
              className="chalk-card"
              data-edit={mode === "edit" ? "true" : undefined}
              aria-labelledby="session-title"
            >
              {/* Card header */}
              <header
                aria-label="Encabezado de la sesión"
                className="flex items-start justify-between gap-4 pb-4 border-b border-hairline"
              >
                <div className="min-w-0">
                  <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute mb-1">
                    {result.model} · {modality.label}
                  </p>
                  <h2
                    id="session-title"
                    className="font-display italic font-semibold text-2xl md:text-[1.875rem] leading-[1.1] tracking-tight text-bone line-clamp-3 break-words"
                  >
                    {result.title}
                  </h2>
                </div>
                <div className="font-mono tabular text-[0.6875rem] tracking-[0.04em] text-mute text-right shrink-0">
                  <div className="text-bone">
                    {new Date(result.createdAt).toLocaleDateString("es-AR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                    })}
                  </div>
                  <div className="mt-1">
                    ID {result.id.slice(0, 6)}
                  </div>
                </div>
              </header>

              {/* View mode */}
              {mode === "view" ? (
                <>
                  {result.structured ? (
                    <CrossFitPlanView plan={result.structured} />
                  ) : (
                    <div
                      className="prose prose-invert max-w-prose prose-headings:font-display prose-headings:italic prose-headings:tracking-tight prose-h1:text-2xl prose-h2:text-xl prose-h3:text-base prose-h3:font-display prose-h3:not-italic prose-strong:text-bone prose-code:font-mono prose-code:text-bone prose-code:before:content-none prose-code:after:content-none prose-li:my-1 prose-p:my-3 prose-headings:mt-5 prose-headings:mb-2"
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {editedMarkdown ?? result.markdown}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* View-mode actions */}
                  <footer
                    aria-label="Acciones de la sesión"
                    className="mt-6 pt-4 border-t border-hairline flex flex-wrap items-center gap-2"
                  >
                    <Button
                      variant="ghost"
                      onClick={handleCopy}
                      disabled={busy}
                      className="font-mono tabular text-xs text-mute hover:text-bone hover:bg-muted rounded-sm h-8 px-2.5 gap-1.5"
                      aria-label="Copiar"
                    >
                      <Copy className="size-3.5" />
                      Copiar
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleExport}
                      disabled={busy}
                      className="font-mono tabular text-xs text-mute hover:text-bone hover:bg-muted rounded-sm h-8 px-2.5 gap-1.5"
                      aria-label="Exportar como markdown"
                    >
                      <Download className="size-3.5" />
                      Exportar
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleRegenerate}
                      disabled={busy || !validate()}
                      className="font-mono tabular text-xs text-mute hover:text-bone hover:bg-muted rounded-sm h-8 px-2.5 gap-1.5"
                      aria-label="Regenerar"
                    >
                      <RefreshCw className="size-3.5" />
                      Regenerar
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditedMarkdown(result.markdown);
                        setMode("edit");
                      }}
                      disabled={busy}
                      className="font-mono tabular text-xs text-mute hover:text-bone hover:bg-muted rounded-sm h-8 px-2.5 gap-1.5"
                      aria-label="Editar"
                    >
                      <Pencil className="size-3.5" />
                      Editar
                    </Button>
                  </footer>
                </>
              ) : (
                <>
                  {/* Edit mode: split editor + preview */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute">
                        Editor
                      </p>
                      <Textarea
                        id="editor"
                        ref={editorRef}
                        value={editedMarkdown ?? result.markdown}
                        onChange={(e) => setEditedMarkdown(e.target.value)}
                        disabled={busy}
                        className="min-h-96 px-3.5 py-3 bg-transparent border border-hairline rounded-sm text-bone font-mono text-sm leading-relaxed focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 resize-y"
                        aria-label="Contenido de la sesión"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute">
                        Vista previa
                      </p>
                      <div className="min-h-96 w-full border border-hairline rounded-sm px-4 py-3 overflow-auto">
                        <div className="prose prose-invert max-w-prose prose-headings:font-display prose-headings:italic prose-headings:tracking-tight prose-strong:text-bone prose-code:font-mono prose-code:text-bone prose-code:before:content-none prose-code:after:content-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {editedMarkdown ?? result.markdown}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Edit-mode actions */}
                  <footer
                    aria-label="Acciones de la sesión"
                    className="mt-6 pt-4 border-t border-hairline flex flex-wrap items-center gap-2"
                  >
                    <Button
                      onClick={handleSave}
                      disabled={busy}
                      className="font-sans text-xs font-semibold uppercase tracking-[0.10em] bg-signal text-signal-foreground hover:bg-signal-deep rounded-md h-8 px-3 gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="size-3.5" />
                      Guardar
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditedMarkdown(null);
                        setMode("view");
                      }}
                      disabled={busy}
                      className="font-sans text-xs font-semibold uppercase tracking-[0.10em] text-mute hover:text-bone bg-transparent hover:bg-muted rounded-md h-8 px-3"
                    >
                      Cancelar
                    </Button>
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      onClick={handleRegenerate}
                      disabled={busy || !validate()}
                      className="font-mono tabular text-xs text-mute hover:text-bone hover:bg-muted rounded-sm h-8 px-2.5 gap-1.5"
                      aria-label="Regenerar"
                    >
                      <RefreshCw className="size-3.5" />
                      Regenerar
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleCopy}
                      disabled={busy}
                      className="font-mono tabular text-xs text-mute hover:text-bone hover:bg-muted rounded-sm h-8 px-2.5 gap-1.5"
                      aria-label="Copiar"
                    >
                      <Copy className="size-3.5" />
                      Copiar
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleExport}
                      disabled={busy}
                      className="font-mono tabular text-xs text-mute hover:text-bone hover:bg-muted rounded-sm h-8 px-2.5 gap-1.5"
                      aria-label="Exportar como markdown"
                    >
                      <Download className="size-3.5" />
                      Exportar
                    </Button>
                  </footer>
                </>
              )}
            </article>

            {/* Mini-history */}
            {recentSessions.length > 0 && (
              <section aria-label="Sesiones recientes">
                <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute mb-3">
                  Sesiones recientes
                </p>
                <ul className="space-y-px bg-hairline rounded-none overflow-hidden">
                  {recentSessions.map((s) => (
                    <li key={s.id} className="bg-panel">
                      <article className="chalk-card border-0 px-4 py-3">
                        <header className="flex items-baseline justify-between gap-4">
                          <h3 className="font-display italic font-semibold text-sm leading-none tracking-tight text-bone truncate">
                            {s.title}
                          </h3>
                          <span className="font-mono tabular-nums text-[0.6875rem] tracking-[0.04em] text-mute shrink-0">
                            {new Date(s.createdAt).toLocaleDateString("es-AR", {
                              day: "2-digit",
                              month: "2-digit",
                            })}
                            {" · "}
                            {s.input.durationMinutes} min
                          </span>
                        </header>
                        <footer className="mt-2 flex items-center gap-3">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(s.markdown).then(
                                () => toast.success("Copiado al portapapeles"),
                                () => toast.error("No se pudo copiar"),
                              );
                            }}
                            className="font-mono tabular text-[0.6875rem] tracking-[0.04em] text-mute hover:text-bone transition-colors flex items-center gap-1"
                            aria-label={`Copiar sesión: ${s.title}`}
                          >
                            <Copy className="size-3" />
                            Copiar
                          </button>
                          <button
                            onClick={() => {
                              const slug = modality.label.toLowerCase().replace(/\s+/g, "-");
                              const date = new Date(s.createdAt).toLocaleDateString("en-CA");
                              const filename = `${slug}-${date}.md`;
                              const blob = new Blob([s.markdown], {
                                type: "text/markdown",
                              });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = filename;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            className="font-mono tabular text-[0.6875rem] tracking-[0.04em] text-mute hover:text-bone transition-colors flex items-center gap-1"
                            aria-label={`Exportar sesión: ${s.title}`}
                          >
                            <Download className="size-3" />
                            Exportar
                          </button>
                        </footer>
                      </article>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
