"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addClass, updateClass, removeClass } from "@/lib/storage";
import type { Clase } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!name.trim()) newErrors.name = "El nombre es obligatorio.";
    if (!structure.trim())
      newErrors.structure = "La estructura es obligatoria.";
    const dur = Number(durationMinutes);
    if (!durationMinutes || isNaN(dur) || dur <= 0)
      newErrors.durationMinutes =
        "La duración debe ser un número mayor a 0.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const exercises = exercisesRaw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (isEditing && initialClase) {
      updateClass({
        ...initialClase,
        name: name.trim(),
        structure: structure.trim(),
        exercises,
        durationMinutes: Number(durationMinutes),
      });
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
    }
    router.push("/classes");
  }

  function handleDelete() {
    if (!initialClase) return;
    if (
      window.confirm(
        "¿Eliminar esta clase? Esta acción no se puede deshacer.",
      )
    ) {
      removeClass(initialClase.id);
      router.push("/classes");
    }
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
            {isEditing ? "Editar Clase" : "Nueva Clase"}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  placeholder="Crossfit, Bodybuild, Gymnastics…"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={Boolean(errors.name)}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label htmlFor="duration">Duración (minutos)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  max={300}
                  placeholder="60"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  aria-invalid={Boolean(errors.durationMinutes)}
                />
                {errors.durationMinutes && (
                  <p className="text-sm text-destructive">
                    {errors.durationMinutes}
                  </p>
                )}
              </div>

              {/* Structure */}
              <div className="space-y-2">
                <Label htmlFor="structure">Estructura</Label>
                <Tabs
                  value={activeTab}
                  onValueChange={(v) =>
                    setActiveTab(v as "edit" | "preview")
                  }
                >
                  <TabsList>
                    <TabsTrigger value="edit">Editar</TabsTrigger>
                    <TabsTrigger value="preview">Vista previa</TabsTrigger>
                  </TabsList>
                  <TabsContent value="edit" className="mt-2">
                    <Textarea
                      id="structure"
                      placeholder={"## Skill\n\n## Strength\n\n## WOD"}
                      value={structure}
                      onChange={(e) => setStructure(e.target.value)}
                      className="font-mono text-sm min-h-48"
                      aria-invalid={Boolean(errors.structure)}
                    />
                  </TabsContent>
                  <TabsContent value="preview" className="mt-2">
                    <Card className="min-h-48 p-4 text-sm">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {structure || "_Sin contenido todavía_"}
                        </ReactMarkdown>
                      </div>
                    </Card>
                  </TabsContent>
                </Tabs>
                {errors.structure && (
                  <p className="text-sm text-destructive">
                    {errors.structure}
                  </p>
                )}
              </div>

              {/* Exercises */}
              <div className="space-y-2">
                <Label htmlFor="exercises">
                  Ejercicios{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (uno por línea)
                  </span>
                </Label>
                <Textarea
                  id="exercises"
                  placeholder={"Front Squat\nWall Ball\nBox Jump\nDeadlift"}
                  value={exercisesRaw}
                  onChange={(e) => setExercisesRaw(e.target.value)}
                  className="font-mono text-sm min-h-32"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-4 pt-2">
                {isEditing ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                  >
                    Eliminar clase
                  </Button>
                ) : (
                  <div />
                )}
                <div className="flex gap-2">
                  <Button variant="outline" render={<Link href="/classes" />}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {isEditing ? "Guardar cambios" : "Crear clase"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
