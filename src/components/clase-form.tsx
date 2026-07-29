"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addClass, updateClass, removeClass } from "@/lib/storage";
import type { Clase } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

interface FormErrors {
  name?: string;
  structure?: string;
  durationMinutes?: string;
}

interface Props {
  initialClase?: Clase;
}

export function ClaseForm({ initialClase }: Props) {
  const router = useRouter();
  const isEditing = Boolean(initialClase);

  const [name, setName] = useState(initialClase?.name ?? "");
  const [structure, setStructure] = useState(initialClase?.structure ?? "");
  const [exercisesRaw, setExercisesRaw] = useState(
    initialClase?.exercises.join("\n") ?? "",
  );
  const [durationMinutes, setDurationMinutes] = useState(
    String(initialClase?.durationMinutes ?? 60),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!name.trim()) newErrors.name = "El nombre es obligatorio.";
    if (!structure.trim())
      newErrors.structure = "La estructura es obligatoria.";
    const dur = Number(durationMinutes);
    if (!durationMinutes || isNaN(dur) || dur <= 0)
      newErrors.durationMinutes =
        "La duración debe ser un número mayor a 0.";
    if (!isNaN(dur) && dur > 300)
      newErrors.durationMinutes =
        "La duración no puede superar 300 minutos.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const exercises = exercisesRaw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    try {
      if (isEditing && initialClase) {
        updateClass({
          ...initialClase,
          name: name.trim(),
          structure: structure.trim(),
          exercises,
          durationMinutes: Number(durationMinutes),
        });
        toast.success("Clase guardada");
      } else {
        const nueva: Clase = {
          id: crypto.randomUUID(),
          name: name.trim(),
          structure: structure.trim(),
          exercises,
          durationMinutes: Number(durationMinutes),
          createdAt: new Date().toISOString(),
        };
        addClass(nueva);
        toast.success("Clase creada");
      }
      router.push("/classes");
    } catch (err) {
      console.error("clase-form: storage error", err);
      if (isEditing) {
        toast.error("No se pudo guardar la Clase. Intenta de nuevo.");
      } else {
        toast.error("No se pudo crear la Clase. Intenta de nuevo.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete() {
    if (!initialClase) return;
    if (
      window.confirm(
        "¿Eliminar esta clase y todas sus ideas? Esta acción no se puede deshacer.",
      )
    ) {
      try {
        removeClass(initialClase.id);
        toast.success("Clase eliminada");
        router.push("/classes");
      } catch (err) {
        console.error("clase-form: storage error", err);
        toast.error("No se pudo eliminar la Clase. Intenta de nuevo.");
      }
    }
  }

  const isValid =
    name.trim() &&
    structure.trim() &&
    Number(durationMinutes) > 0 &&
    Number(durationMinutes) <= 300;

  const isDirty =
    isEditing && initialClase
      ? name.trim() !== initialClase.name ||
        structure.trim() !== initialClase.structure ||
        exercisesRaw
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .join("\n") !==
          initialClase.exercises.join("\n") ||
        String(initialClase.durationMinutes) !== durationMinutes
      : true;

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
            aria-label="Volver a Mis Clases"
            className="size-7 rounded-md text-mute hover:text-bone hover:bg-transparent"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="font-display italic font-semibold text-lg leading-none tracking-tight truncate">
            {isEditing ? `Editar · ${initialClase?.name}` : "Nueva Clase"}
          </h1>
        </div>
        <div className="font-mono tabular text-[0.6875rem] tracking-[0.04em] text-mute uppercase shrink-0">
          {isEditing ? "Editar" : "Nueva"} · {submitting ? "…" : "01"}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 md:px-8 py-10">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Identidad */}
          <fieldset className="chalk-card space-y-5" disabled={submitting}>
            <legend className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute -mt-1 mb-1">
              Identidad
            </legend>

            <div className="space-y-2">
              <label
                htmlFor="name"
                className="block font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute"
              >
                Nombre
              </label>
              <Input
                id="name"
                placeholder="Crossfit, Bodybuild, Gymnastics…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={Boolean(errors.name)}
                aria-describedby="name-error"
                className="h-10 px-3.5 bg-transparent border border-hairline rounded-sm text-bone placeholder:text-mute focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 transition-colors"
              />
              {errors.name && (
                <p id="name-error" className="font-sans text-[0.8125rem] text-destructive">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="duration"
                className="block font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute"
              >
                Duración (minutos)
              </label>
              <Input
                id="duration"
                type="number"
                min={1}
                max={300}
                placeholder="60"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                aria-invalid={Boolean(errors.durationMinutes)}
                aria-describedby="duration-error"
                className="h-10 px-3.5 bg-transparent border border-hairline rounded-sm text-bone font-mono tabular placeholder:text-mute focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 transition-colors w-32"
              />
              {errors.durationMinutes && (
                <p id="duration-error" className="font-sans text-[0.8125rem] text-destructive">
                  {errors.durationMinutes}
                </p>
              )}
            </div>
          </fieldset>

          {/* Estructura */}
          <fieldset className="chalk-card space-y-4" disabled={submitting}>
            <legend className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute -mt-1 mb-1">
              Estructura
            </legend>

            <div
              role="tablist"
              aria-label="Modo de edición de estructura"
              className="flex items-center gap-6 border-b border-hairline pb-2"
            >
              <button
                type="button"
                role="tab"
                id="structure-tab-edit"
                aria-selected={activeTab === "edit"}
                aria-controls="structure-panel-edit"
                onClick={() => setActiveTab("edit")}
                className={`font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] pb-2 -mb-2 border-b transition-colors ${
                  activeTab === "edit"
                    ? "text-bone border-signal"
                    : "text-mute border-transparent hover:text-bone"
                }`}
              >
                Editor
              </button>
              <button
                type="button"
                role="tab"
                id="structure-tab-preview"
                aria-selected={activeTab === "preview"}
                aria-controls="structure-panel-preview"
                onClick={() => setActiveTab("preview")}
                className={`font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] pb-2 -mb-2 border-b transition-colors ${
                  activeTab === "preview"
                    ? "text-bone border-signal"
                    : "text-mute border-transparent hover:text-bone"
                }`}
              >
                Vista previa
              </button>
            </div>

            {activeTab === "edit" ? (
              <div
                role="tabpanel"
                id="structure-panel-edit"
                aria-labelledby="structure-tab-edit"
              >
                <Textarea
                  id="structure"
                  placeholder={"## Skill\n\n## Strength\n\n## WOD"}
                  value={structure}
                  onChange={(e) => setStructure(e.target.value)}
                  aria-invalid={Boolean(errors.structure)}
                  aria-describedby="structure-error"
                  className="min-h-56 px-3.5 py-3 bg-transparent border border-hairline rounded-sm text-bone font-mono text-sm leading-relaxed placeholder:text-mute focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 resize-y"
                />
              </div>
            ) : (
              <div
                role="tabpanel"
                id="structure-panel-preview"
                aria-labelledby="structure-tab-preview"
                className="min-h-56 px-4 py-4 bg-transparent border border-hairline rounded-sm text-sm overflow-auto"
              >
                <div className="prose prose-invert max-w-prose prose-headings:font-display prose-headings:italic prose-headings:tracking-tight prose-code:font-mono prose-code:text-bone prose-strong:text-bone">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {structure || "_Sin contenido todavía_"}
                  </ReactMarkdown>
                </div>
              </div>
            )}
            {errors.structure && (
              <p id="structure-error" className="font-sans text-[0.8125rem] text-destructive">
                {errors.structure}
              </p>
            )}
          </fieldset>

          {/* Ejercicios */}
          <fieldset className="chalk-card space-y-3" disabled={submitting}>
            <legend className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute -mt-1 mb-1">
              Pool de ejercicios
              <span className="ml-2 text-[0.6875rem] font-normal normal-case tracking-normal text-mute">
                — uno por línea
              </span>
            </legend>

            <Textarea
              id="exercises"
              placeholder={"Front Squat\nWall Ball\nBox Jump\nDeadlift"}
              value={exercisesRaw}
              onChange={(e) => setExercisesRaw(e.target.value)}
              className="min-h-36 px-3.5 py-3 bg-transparent border border-hairline rounded-sm text-bone font-mono text-sm leading-relaxed placeholder:text-mute focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/30 resize-y"
            />

            {exercisesRaw.trim() && (
              <p className="font-mono tabular text-xs text-mute tracking-[0.04em]">
                {exercisesRaw
                  .split("\n")
                  .map((l) => l.trim())
                  .filter(Boolean).length}{" "}
                {exercisesRaw.split("\n").filter((l) => l.trim()).length === 1
                  ? "ejercicio"
                  : "ejercicios"}{" "}
                cargados
              </p>
            )}
          </fieldset>

          {/* Acciones */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pt-2">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                nativeButton={false}
                render={<Link href="/classes" />}
                className="font-sans text-xs font-semibold uppercase tracking-[0.10em] text-mute hover:text-bone bg-transparent hover:bg-muted rounded-md h-9 px-3"
              >
                Cancelar
              </Button>
              {isEditing && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDelete}
                  className="font-sans text-xs font-semibold uppercase tracking-[0.10em] text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-md h-9 px-3"
                >
                  Eliminar clase
                </Button>
              )}
            </div>
            <Button
              type="submit"
              disabled={!isValid || (isEditing && !isDirty) || submitting}
              className="font-sans text-xs font-semibold uppercase tracking-[0.10em] bg-signal text-signal-foreground hover:bg-signal-deep rounded-md h-9 px-4 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              {submitting
                ? isEditing
                  ? "Guardando…"
                  : "Creando…"
                : isEditing
                  ? "Guardar cambios"
                  : "Crear clase"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
