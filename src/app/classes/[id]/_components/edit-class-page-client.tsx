"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClaseForm } from "@/components/clase-form";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Clase } from "@/lib/types";

export function EditClassPageClient({ id }: { id: string }) {
  const [classes] = useLocalStorage<Clase[]>("pd:classes", []);
  const clase = classes.find((c) => c.id === id) ?? null;

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
              Volvé a la lista para elegir otra Clase o crear una nueva.
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

  return <ClaseForm initialClase={clase} />;
}
