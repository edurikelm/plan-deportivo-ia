"use client";

import Link from "next/link";
import { ArrowLeft, Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClaseForm } from "@/components/clase-form";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Clase } from "@/lib/types";

export function EditClassPageClient({ id }: { id: string }) {
  const [classes] = useLocalStorage<Clase[]>("pd:classes", []);
  const clase = classes.find((c) => c.id === id) ?? null;

  if (!clase) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="mx-auto max-w-3xl px-6 py-4 flex items-center gap-4">
            <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/classes" />} aria-label="Volver a clases">
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-lg font-semibold">Editar Clase</h1>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-6 py-16 text-center">
          <Dumbbell className="size-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-6">
            Esta clase no existe o fue eliminada.
          </p>
          <Button nativeButton={false} render={<Link href="/classes" />}>
            Volver a Mis Clases
          </Button>
        </main>
      </div>
    );
  }

  return <ClaseForm initialClase={clase} />;
}
