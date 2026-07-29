"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Clase } from "@/lib/types";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useHydrated } from "@/hooks/use-hydrated";

export function ClassesListClient() {
  const hydrated = useHydrated();
  const [classes] = useLocalStorage<Clase[]>("pd:classes", []);

  const empty = classes.length === 0;
  const days = ["L", "M", "M", "J", "V", "S", "D"];

  // Avoid flashing the empty state (pizarra semanal) before localStorage has
  // been read on the client. The server returns `classes = []` because it
  // can't see the browser; rendering the empty state immediately would show
  // the pizarra to users who actually have Clases.
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-canvas">
        <header className="status-strip" data-state="idle">
          <h1 className="font-display italic font-semibold text-lg leading-none tracking-tight">
            Mis Clases
          </h1>
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
      {/* Status strip — navegación primaria */}
      <header className="status-strip" data-state="idle">
        <div className="flex items-baseline gap-4">
          <h1 className="font-display italic font-semibold text-lg leading-none tracking-tight">
            Mis Clases
          </h1>
        </div>
        <Button
          nativeButton={false}
          render={<Link href="/classes/new" />}
          className="rounded-md text-[0.6875rem] font-semibold uppercase tracking-[0.10em] border border-signal bg-transparent text-signal hover:bg-signal hover:text-signal-foreground transition-colors"
        >
          <Plus className="size-3.5" />
          Nueva Clase
        </Button>
      </header>

      <main className="mx-auto max-w-3xl px-5 md:px-8 py-10">
        {empty ? (
          <section
            role="status"
            className="space-y-8"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.10em] text-mute mb-3">
                Tu pizarra semanal — vacía
              </p>
              <p className="text-sm text-mute max-w-md leading-relaxed">
                Todavía no creaste ninguna Clase. Empezá creando{" "}
                <span className="text-bone font-medium">Crossfit</span>,{" "}
                <span className="text-bone font-medium">Bodybuild</span>, o la
                que prefieras. Cada una vive en su propia celda — y se reusa
                para todas tus Ideas.
              </p>
            </div>

            {/* Pizarra semanal — 7 casillas */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.10em] text-mute mb-2">
                Semana tipo
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-4 md:grid-cols-7 gap-px bg-hairline rounded-none overflow-hidden">
                {days.map((day, i) => (
                  <div
                    key={`${day}-${i}`}
                    className="bg-panel md:aspect-[3/4] min-h-16 md:min-h-0 flex flex-col items-start justify-between p-3"
                  >
                    <span className="font-mono tabular text-[0.6875rem] tracking-[0.04em] text-mute">
                      {day}{i > 0 ? i : ""}
                    </span>
                    <span className="text-[0.6875rem] text-mute italic">
                      sin clase
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Button
                nativeButton={false}
                render={<Link href="/classes/new" />}
                className="rounded-md text-xs font-semibold uppercase tracking-[0.10em] border border-signal bg-transparent text-signal hover:bg-signal hover:text-signal-foreground transition-colors h-9 px-4"
              >
                <Plus className="size-4" />
                Crear la primera Clase
              </Button>
            </div>
          </section>
        ) : (
          <section className="space-y-6" aria-label="Lista de Clases">
            <header className="flex items-baseline justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-[0.10em] text-mute">
                Catálogo de Clases
              </p>
              <p className="font-mono tabular text-xs text-mute tracking-[0.04em]">
                {classes.length >= 5
                  ? `Mostrando ${classes.length} Clases`
                  : classes.length === 1
                    ? "1 clase"
                    : `${classes.length} clases`}
              </p>
            </header>

            <ul className="space-y-px bg-hairline rounded-none overflow-hidden">
              {classes.map((clase) => (
                <li key={clase.id} className="bg-panel">
                  <article className="chalk-card border-0 hover:border-l-signal transition-colors">
                    <header
                      aria-label={`Detalles de ${clase.name}`}
                      className="flex items-baseline justify-between gap-4 pb-3 border-b border-hairline"
                    >
                      <h2 className="font-display italic font-semibold text-2xl leading-none tracking-tight text-bone">
                        {clase.name}
                      </h2>
                      <div className="font-mono tabular text-[0.6875rem] tracking-[0.04em] text-mute flex items-center gap-3 shrink-0">
                        <span>
                          {clase.durationMinutes}
                          <span className="ml-1 text-[0.6rem] tracking-[0.10em]">
                            MIN
                          </span>
                        </span>
                        <span aria-hidden="true" className="text-hairline-strong">
                          ·
                        </span>
                        <span>
                          {clase.exercises.length}
                          <span className="ml-1 text-[0.6rem] tracking-[0.10em]">
                            EJ
                          </span>
                        </span>
                      </div>
                    </header>

                    {clase.exercises.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {clase.exercises.slice(0, 5).map((ex, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-2 py-0.5 font-mono text-[0.6875rem] tracking-[0] text-mute border border-hairline rounded-sm"
                          >
                            {ex}
                          </span>
                        ))}
                        {clase.exercises.length > 5 && (
                          <span className="inline-flex items-center px-2 py-0.5 font-mono text-[0.6875rem] tracking-[0] text-mute border border-hairline rounded-sm">
                            +{clase.exercises.length - 5} más
                          </span>
                        )}
                      </div>
                    )}

                    <footer
                      aria-label={`Acciones de ${clase.name}`}
                      className="mt-4 pt-3 border-t border-hairline flex items-center justify-end gap-5"
                    >
                      <Link
                        href={`/classes/${clase.id}`}
                        className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute hover:text-bone transition-colors"
                      >
                        Editar
                      </Link>
                      <Link
                        href={`/classes/${clase.id}/generate`}
                        className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-signal hover:text-signal-deep transition-colors inline-flex items-center gap-1.5"
                      >
                        Generar
                        <span aria-hidden="true">→</span>
                      </Link>
                    </footer>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
