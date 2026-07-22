"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Dumbbell, Clock, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Clase } from "@/lib/types";
import { getClasses } from "@/lib/storage";

interface Props {
  initialClasses: Clase[];
}

export function ClassesListClient({ initialClasses }: Props) {
  const [classes, setClasses] = useState(initialClasses);

  useEffect(() => {
    const handler = () => setClasses(getClasses());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Mis Clases</h1>
          <Button render={<Link href="/classes/new" />}>
            <Plus className="size-4" />
            Nueva Clase
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {classes.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <CardContent className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-muted p-4">
                <Dumbbell className="size-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground max-w-xs">
                Todavía no creaste ninguna Clase. Empezá creando Crossfit o la que
                prefieras.
              </p>
              <Button render={<Link href="/classes/new" />}>
                <Plus className="size-4" />
                Nueva Clase
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {classes.map((clase) => (
              <Card key={clase.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                  <div className="flex flex-col gap-1 min-w-0">
                    <CardTitle className="truncate">{clase.name}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {clase.durationMinutes} min
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FileText className="size-3" />
                        {clase.exercises.length} ejercicio
                        {clase.exercises.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" render={<Link href={`/classes/${clase.id}`} />}>
                      Editar
                    </Button>
                    <Button variant="secondary" size="sm" render={<Link href={`/classes/${clase.id}/generate`} />}>
                      Generar
                    </Button>
                  </div>
                </CardHeader>
                {clase.exercises.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1">
                      {clase.exercises.slice(0, 5).map((ex, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {ex}
                        </Badge>
                      ))}
                      {clase.exercises.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{clase.exercises.length - 5} más
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
