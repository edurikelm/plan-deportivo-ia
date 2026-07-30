"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Copy, Download, Pencil, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/hooks/use-hydrated";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { addIdea, updateIdea } from "@/lib/storage";
import type { Clase, Idea } from "@/lib/types";

interface GenerateClientProps {
  ideaId: string;
}

export function GenerateClient({ ideaId }: GenerateClientProps) {
  const hydrated = useHydrated();
  const [classes] = useLocalStorage<Clase[]>("pd:classes", []);
  const clase = classes.find((c) => c.id === ideaId) ?? null;

  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Idea | null>(null);
  const [persisted, setPersisted] = useState(false);

  // Visual / UX state
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  // Edit mode state
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [editedContent, setEditedContent] = useState<string | null>(null);

  // B9: aria-live announcement (screen reader only, visually hidden)
  const [announcement, setAnnouncement] = useState("");

  const hasPendingEdit =
    mode === "edit" &&
    editedContent !== null &&
    editedContent !== (result?.content ?? "");

  // Cronómetro: ticking mientras busy
  useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [busy]);

  // B9: one-shot announcements para screen readers, distinguen éxito vs error.
  // Fires only on busy transitions (false→true and true→false).
  const prevBusyRef = useRef(false);
  const lastOutcomeRef = useRef<"ok" | "error">("ok");
  useEffect(() => {
    if (busy && !prevBusyRef.current) {
      setAnnouncement("Generando plan");
    } else if (!busy && prevBusyRef.current) {
      setAnnouncement(
        lastOutcomeRef.current === "ok" ? "Plan generado" : "No se pudo generar el plan",
      );
    }
    prevBusyRef.current = busy;
  }, [busy]);

  // Autofoco del editor al entrar en edit mode
  useEffect(() => {
    if (mode === "edit" && editorRef.current) {
      editorRef.current.focus();
    }
  }, [mode]);

  // Cleanup del AbortController al desmontar
  useEffect(() => {
    const controller = abortRef.current;
    return () => {
      controller?.abort();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clase) return;

    setElapsed(0);                                          // B12: cronómetro reset
    setBusy(true);
    lastOutcomeRef.current = "ok";
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clase, focus: focus.trim() || undefined }),
      });

      const data = (await res.json()) as { ok: boolean; content?: string; model?: string; error?: string };

      if (!data.ok || !data.content) {
        throw new Error(data.error ?? "Error generando la idea");
      }

      const idea: Idea = {
        id: crypto.randomUUID(),
        classId: clase.id,
        content: data.content,
        model: data.model ?? "MiniMax-M3",
        focus: focus.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      setResult(idea);
      toast.success("Plan generado");
    } catch {
      lastOutcomeRef.current = "error";                     // B9: el screen reader sabrá que falló
      toast.error("No se pudo generar el plan. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  function handleCopy() {
    if (!result) return;
    const text = editedContent ?? result.content;
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copiado al portapapeles"),
      () => toast.error("No se pudo copiar"),
    );
  }

  function handleExport() {
    if (!result || !clase) return;
    const slug = clase.name.toLowerCase().replace(/\s+/g, "-");
    const date = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
    const filename = `${slug}-${date}.md`;
    const blob = new Blob([editedContent ?? result.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSave() {
    if (!result || !hasPendingEdit || editedContent === null) return;
    const updated: Idea = { ...result, content: editedContent };
    if (persisted) {
      updateIdea(updated);
    } else {
      addIdea(updated);
      setPersisted(true);
    }
    setResult(updated);
    setEditedContent(null);
    setMode("view");
    toast.success("Idea guardada");
  }

  async function handleRegenerate() {
    if (!result || !clase) return;

    if (hasPendingEdit) {
      if (!window.confirm("Tenés cambios sin guardar. ¿Descartarlos?")) return;
      setEditedContent(null);
      setMode("view");
    }

    setElapsed(0);                                          // B12: cronómetro reset
    setBusy(true);
    lastOutcomeRef.current = "ok";
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // El textarea manda sobre result.focus cuando el Entrenador lo edita
        // antes de regenerar (decisión de producto documentada en el brief).
        body: JSON.stringify({ clase, focus: focus.trim() || result.focus || undefined }),
      });

      const data = (await res.json()) as { ok: boolean; content?: string; model?: string; error?: string };

      if (!data.ok || !data.content) {
        throw new Error(data.error ?? "Error generando la idea");
      }

      const updated: Idea = {
        ...result,
        content: data.content,
        model: data.model ?? result.model,
        createdAt: new Date().toISOString(),
      };

      setResult(updated);
      setEditedContent(null);
      setMode("view");
      toast.success("Plan regenerado");
    } catch {
      lastOutcomeRef.current = "error";                     // B9: el screen reader sabrá que falló
      toast.error("No se pudo regenerar el plan. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  if (!clase) {
    return (
      <div className="min-h-screen bg-canvas">
        <header className="status-strip" data-state="idle">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              nativeButton={false}
              render={<Link href="/classes" />}
              aria-label="Volver a Mis Clases"
              className="size-7 rounded-md text-mute hover:text-bone hover:bg-transparent"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="font-display italic font-semibold text-lg tracking-tight">
              Clase no encontrada
            </h1>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-5 md:px-8 py-20">
          <div className="chalk-card max-w-md">
            <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute mb-3">
              Estado · 404
            </p>
            <p className="text-bone mb-1">Esta clase no existe o fue eliminada.</p>
            <p className="text-sm text-mute leading-relaxed mb-6">
              Volvé a la lista para elegir o crear otra.
            </p>
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link href="/classes" />}
              className="font-sans text-xs font-semibold uppercase tracking-[0.10em] text-bone bg-transparent hover:bg-muted rounded-md h-9 px-4"
            >
              Volver a Mis Clases
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Avoid flashing content before localStorage hydrates
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
              aria-label="Volver a Mis Clases"
              className="size-7 rounded-md text-mute hover:text-bone hover:bg-transparent"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="font-display italic font-semibold text-lg leading-none tracking-tight">
              Generar Idea — {clase.name}
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
            aria-label="Volver a Mis Clases"
            className="size-7 rounded-md text-mute hover:text-bone hover:bg-transparent"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="font-display italic font-semibold text-lg leading-none tracking-tight truncate">
            {busy ? "Generando" : `Generar Idea — ${clase.name}`}
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
            disabled={busy}
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
        {/* B9: screen-reader-only live region for generation status */}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </div>
        <form id="generate-form" onSubmit={handleSubmit} className="space-y-4">
          <label
            htmlFor="focus"
            className="block font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute"
          >
            Foco de la sesi&oacute;n
            <span className="ml-2 text-[0.6875rem] font-normal normal-case tracking-normal text-mute">
              (opcional)
            </span>
          </label>
          <Textarea
            id="focus"
            placeholder="foco de hoy…"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            disabled={busy}
            className="min-h-32 px-3.5 py-3 bg-transparent border border-hairline rounded-sm text-bone placeholder:text-mute focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 resize-y disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="font-mono tabular text-[0.6875rem] tracking-[0.04em] text-mute">
            {clase.durationMinutes}
            <span className="ml-1 text-mute">MIN</span>
            <span className="mx-2 text-hairline-strong">·</span>
            {clase.exercises.length}
            <span className="ml-1 text-mute">EJ</span>
            <span className="mx-2 text-hairline-strong">·</span>
            {clase.structure
              ? clase.structure.split("\n").filter((l) => l.trim()).length
              : 0}
            <span className="ml-1 text-mute">BLOQUES</span>
          </p>
        </form>

        {/* Result card */}
        {result && (
          <article
            className="chalk-card chalk-card-reveal"
            data-edit={mode === "edit"}
            aria-labelledby="idea-title"
          >
            {/* Card header */}
            <header
              aria-label="Encabezado de la idea"
              className="flex items-start justify-between gap-4 pb-3 border-b border-hairline"
            >
              <div className="min-w-0">
                <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute mb-1">
                  {result.model} · {clase.name}
                </p>
                <h2
                  id="idea-title"
                  className="font-display italic font-semibold text-2xl md:text-[1.875rem] leading-[1.1] tracking-tight text-bone line-clamp-3 break-words"
                >
                  {result.focus ? result.focus : "Idea sin foco"}
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
                <div className="mt-1">ID {result.id.slice(0, 6)}</div>
              </div>
            </header>

            {/* View mode */}
            {mode === "view" ? (
              <>
                <div className="prose prose-invert max-w-prose prose-headings:font-display prose-headings:italic prose-headings:tracking-tight prose-h1:text-2xl prose-h2:text-xl prose-h3:text-base prose-h3:font-display prose-h3:not-italic prose-strong:text-bone prose-code:font-mono prose-code:text-bone prose-code:before:content-none prose-code:after:content-none prose-li:my-1 prose-p:my-3 prose-headings:mt-5 prose-headings:mb-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {editedContent ?? result.content}
                  </ReactMarkdown>
                </div>

                {/* View-mode actions */}
                <footer
                  aria-label="Acciones de la idea"
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
                    disabled={busy}
                    className="font-mono tabular text-xs text-mute hover:text-bone hover:bg-muted rounded-sm h-8 px-2.5 gap-1.5"
                    aria-label="Regenerar"
                  >
                    <RefreshCw className="size-3.5" />
                    Regenerar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditedContent(result.content);
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
                      value={editedContent ?? result.content}
                      onChange={(e) => setEditedContent(e.target.value)}
                      disabled={busy}
                      className="min-h-96 px-3.5 py-3 bg-transparent border border-hairline rounded-sm text-bone font-mono text-sm leading-relaxed focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 resize-y"
                      aria-label="Contenido de la idea"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute">
                      Vista previa
                    </p>
                    <div className="min-h-96 w-full border border-hairline rounded-sm px-4 py-3 overflow-auto">
                      <div className="prose prose-invert max-w-prose prose-headings:font-display prose-headings:italic prose-headings:tracking-tight prose-strong:text-bone prose-code:font-mono prose-code:text-bone prose-code:before:content-none prose-code:after:content-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {editedContent ?? result.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Edit-mode actions */}
                <footer
                  aria-label="Acciones de la idea"
                  className="mt-6 pt-4 border-t border-hairline flex flex-wrap items-center gap-2"
                >
                  <Button
                    onClick={handleSave}
                    disabled={busy || !hasPendingEdit}
                    className="font-sans text-xs font-semibold uppercase tracking-[0.10em] bg-signal text-signal-foreground hover:bg-signal-deep rounded-md h-8 px-3 gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="size-3.5" />
                    Guardar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditedContent(null);
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
                    disabled={busy}
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
        )}
      </main>
    </div>
  );
}
