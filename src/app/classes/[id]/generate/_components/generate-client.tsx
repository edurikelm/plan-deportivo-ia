"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Copy, Download, Loader2, Pencil, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { addIdea, updateIdea } from "@/lib/storage";
import type { Clase, Idea } from "@/lib/types";

interface GenerateClientProps {
  ideaId: string;
}

export function GenerateClient({ ideaId }: GenerateClientProps) {
  const [classes] = useLocalStorage<Clase[]>("pd:classes", []);
  const clase = classes.find((c) => c.id === ideaId) ?? null;

  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Idea | null>(null);

  // Edit mode state
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [editedContent, setEditedContent] = useState<string | null>(null);

  const hasPendingEdit =
    mode === "edit" &&
    editedContent !== null &&
    editedContent !== (result?.content ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clase) return;

    setBusy(true);
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

      addIdea(idea);
      setResult(idea);
      toast.success("Plan generado y guardado en el historial");
    } catch {
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
    updateIdea(updated);
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

    setBusy(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clase, focus: result.focus ?? (focus.trim() || undefined) }),
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

      addIdea(updated);
      setResult(updated);
      setEditedContent(null);
      setMode("view");
      toast.success("Plan regenerado y guardado");
    } catch {
      toast.error("No se pudo regenerar el plan. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (!clase) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="mx-auto max-w-3xl px-6 py-4 flex items-center gap-4">
            <Button variant="ghost" size="icon" render={<Link href="/classes" />} aria-label="Volver a clases">
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-lg font-semibold">Generar Idea</h1>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-6 py-16 text-center">
          <p className="text-muted-foreground mb-6">
            Esta clase no existe o fue eliminada.
          </p>
          <Button render={<Link href="/classes" />}>Volver a Mis Clases</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" render={<Link href="/classes" />} aria-label="Volver a clases">
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-lg font-semibold">
            Generar Idea — {clase.name}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8 space-y-6">
        {/* Form Card */}
        <Card>
          {/* Loading overlay */}
          {busy && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-xl pointer-events-none">
              <Loader2 className="size-8 animate-spin text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Esperando respuesta de la IA&hellip;
              </p>
            </div>
          )}

          <CardContent className="pt-6">
            <form onSubmit={handleSubmit}>
              <fieldset disabled={busy} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="focus">
                    Foco de la sesi&oacute;n{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      (opcional)
                    </span>
                  </Label>
                  <Input
                    id="focus"
                    placeholder="Pecho, piernas, wod larga, técnica…"
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Generando plan&hellip; (no se puede interrumpir)
                    </>
                  ) : (
                    "Generar plan"
                  )}
                </Button>
              </fieldset>
            </form>
          </CardContent>
        </Card>

        {/* Result Card */}
        {result && (
          <Card>
            <CardContent className="pt-6">
              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-muted-foreground">
                <span>{clase.name}</span>
                <span>{clase.durationMinutes} min</span>
                <span>
                  {clase.exercises.length} ejercicio
                  {clase.exercises.length !== 1 ? "s" : ""}
                </span>
                {result.focus && (
                  <span className="font-medium text-foreground">
                    Foco: {result.focus}
                  </span>
                )}
              </div>

              {/* View mode: rendered markdown */}
              {mode === "view" ? (
                <>
                  <ScrollArea className="max-h-96 w-full rounded-md border p-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {editedContent ?? result.content}
                      </ReactMarkdown>
                    </div>
                  </ScrollArea>

                  {/* Action buttons — view mode */}
                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busy}
                      onClick={handleCopy}
                      aria-label="Copiar"
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busy}
                      onClick={handleExport}
                      aria-label="Exportar como markdown"
                    >
                      <Download className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busy}
                      onClick={handleRegenerate}
                      aria-label="Regenerar"
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setEditedContent(result.content);
                        setMode("edit");
                      }}
                      aria-label="Editar"
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Edit mode: textarea + live preview split */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="editor" className="text-xs text-muted-foreground">
                        Editor
                      </Label>
                      <Textarea
                        id="editor"
                        value={editedContent ?? result.content}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="font-mono text-sm min-h-64 resize-y"
                        aria-label="Contenido de la idea"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Vista previa</p>
                      <ScrollArea className="h-64 w-full rounded-md border p-4">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {editedContent ?? result.content}
                          </ReactMarkdown>
                        </div>
                      </ScrollArea>
                    </div>
                  </div>

                  {/* Action buttons — edit mode */}
                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || !hasPendingEdit}
                      onClick={handleSave}
                    >
                      <Save className="size-4" />
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setEditedContent(null);
                        setMode("view");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busy}
                      onClick={handleRegenerate}
                      aria-label="Regenerar"
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busy}
                      onClick={handleCopy}
                      aria-label="Copiar"
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busy}
                      onClick={handleExport}
                      aria-label="Exportar como markdown"
                    >
                      <Download className="size-4" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
