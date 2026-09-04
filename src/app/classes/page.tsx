import type { Metadata } from "next";
import Link from "next/link";
import { MODALITIES } from "@/lib/modalities/modalities";
import { Button } from "@/components/ui/button";
import { RecentActivityBanner } from "./_components/recent-activity-banner";

export const metadata: Metadata = {
  title: "Inicio — Plan Deportivo IA",
};

export default function ClassesPage() {
  return (
    <div className="min-h-screen bg-canvas">
      {/* Status strip */}
      <header className="status-strip" data-state="idle">
        <h1 className="font-display italic font-semibold text-lg leading-none tracking-tight">
          Inicio
        </h1>
      </header>

      <main className="mx-auto max-w-3xl px-5 md:px-8 py-10 space-y-8">
        <RecentActivityBanner />

        {/* Unified tools list — Modalidades + Utilidades + Historial share the same visual rhythm. */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.10em] text-mute mb-3">
            Herramientas
          </p>
          <ul className="space-y-2">
            {MODALITIES.map((modality) => (
              <li key={modality.id} className="bg-panel">
                <article className="chalk-card border-0 hover:border-l-hairline-strong transition-colors">
                  <header
                    aria-label={`Modalidad: ${modality.label}`}
                    className="flex items-baseline justify-between gap-4 pb-3 border-b border-hairline"
                  >
                    <h2 className="font-display italic font-semibold text-2xl leading-none tracking-tight text-bone">
                      {modality.label}
                    </h2>
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute shrink-0">
                      Modalidad
                    </span>
                  </header>

                  <p className="mt-4 text-sm text-mute leading-relaxed">
                    {modality.description}
                  </p>

                  <footer
                    aria-label={`Acciones para ${modality.label}`}
                    className="mt-4 pt-3 border-t border-hairline flex items-center justify-end"
                  >
                    <Button
                      nativeButton={false}
                      render={<Link href={`/generate/${modality.id}`} />}
                      className="rounded-md text-[0.6875rem] font-semibold uppercase tracking-[0.10em] border border-signal bg-transparent text-signal hover:bg-signal hover:text-signal-foreground transition-colors h-8 px-4 inline-flex items-center gap-1.5"
                    >
                      Generar sesión
                      <span aria-hidden="true">→</span>
                    </Button>
                  </footer>
                </article>
              </li>
            ))}

            <li className="bg-panel border border-hairline">
              <article className="chalk-card border-0 hover:border-l-hairline-strong transition-colors">
                <header className="flex items-baseline justify-between gap-4 pb-3 border-b border-hairline">
                  <h2 className="font-display italic font-semibold text-2xl leading-none tracking-tight text-bone">
                    Calculadora de Pesos
                  </h2>
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute shrink-0">
                    Utilidad
                  </span>
                </header>
                <p className="mt-4 text-sm text-mute leading-relaxed">
                  Calcula el peso total de una sesión de levantamiento. Soporta barra + discos
                  por lado con mezcla de kg y lb.
                </p>
                <footer className="mt-4 pt-3 border-t border-hairline flex items-center justify-end">
                  <Button
                    nativeButton={false}
                    render={<Link href="/tools/weight-calculator" />}
                    className="rounded-md text-[0.6875rem] font-semibold uppercase tracking-[0.10em] border border-signal bg-transparent text-signal hover:bg-signal hover:text-signal-foreground transition-colors h-8 px-4 inline-flex items-center gap-1.5"
                  >
                    Abrir calculadora
                    <span aria-hidden="true">→</span>
                  </Button>
                </footer>
              </article>
            </li>
            <li className="bg-panel border border-hairline">
              <article className="chalk-card border-0 hover:border-l-hairline-strong transition-colors">
                <header className="flex items-baseline justify-between gap-4 pb-3 border-b border-hairline">
                  <h2 className="font-display italic font-semibold text-2xl leading-none tracking-tight text-bone">
                    Lista de ejercicios
                  </h2>
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute shrink-0">
                    Ejercicios
                  </span>
                </header>
                <p className="mt-4 text-sm text-mute leading-relaxed">
                  Visualiza progresión, 1RM estimado y tabla de RM por ejercicio.
                </p>
                <footer className="mt-4 pt-3 border-t border-hairline flex items-center justify-end">
                  <Button
                    nativeButton={false}
                    render={<Link href="/tools/weight-calculator/history" />}
                    className="rounded-md text-[0.6875rem] font-semibold uppercase tracking-[0.10em] border border-signal bg-transparent text-signal hover:bg-signal hover:text-signal-foreground transition-colors h-8 px-4 inline-flex items-center gap-1.5"
                  >
                    Ver ejercicios
                    <span aria-hidden="true">→</span>
                  </Button>
                </footer>
              </article>
            </li>
          </ul>
        </div>

        {/* Settings link — discrete, below the catalog (issue 0025) */}
        <div className="border-t border-hairline pt-4 flex justify-end">
          <Link
            href="/settings"
            className="numeric-label text-[0.6875rem] text-mute hover:text-bone transition-colors"
          >
            Configuración →
          </Link>
        </div>
      </main>
    </div>
  );
}
