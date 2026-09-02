"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, Download, FileUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  BACKUP_VERSION,
  clearAllData,
  exportAllData,
  importAllData,
  type BackupShape,
} from "@/lib/storage";
import { downloadAsFile } from "@/lib/clipboard";
import { MODEL, PROVIDER } from "@/lib/modalities/crossfit-schemas";
import { BackupShapeSchema } from "@/lib/settings-schema";
import pkg from "../../../../package.json";

/**
 * Stack summary surfaced in the "Acerca de" section. Kept inline (not
 * computed from package.json) because some entries (e.g. "MiniMax-Text-01")
 * aren't direct dependencies and the order matters for the visual.
 */
const STACK = [
  "Next.js 16 (App Router)",
  "React 19",
  "Tailwind CSS v4 + shadcn/ui (base-nova)",
  "OpenAI SDK → MiniMax-Text-01",
  "TypeScript 5",
] as const;

const REPO_URL = "https://github.com/edurikelm/plan-deportivo-ia";

/**
 * Settings page (issue 0025). Resolves the historical "out of scope" of
 * the coach not being able to export / import / clear their data.
 *
 * Three `<details>` sections:
 * - **Datos** (open by default): export, import, clear-all actions.
 * - **Modelo** (closed by default): read-only provider + model display.
 * - **Acerca de** (closed by default): version, stack, repo link.
 *
 * The destructive actions (Import, Clear) prompt with `window.confirm`
 * before mutating localStorage. Import validates the outer shape with Zod
 * (`BackupShapeSchema`) before touching storage.
 */
export function SettingsClient() {
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleExport() {
    const backup = exportAllData();
    const json = JSON.stringify(backup, null, 2);
    const date = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    const filename = `plan-deportivo-backup-${date}.json`;
    downloadAsFile(filename, "application/json", json);
    toast.success("Backup exportado", {
      description: `${backup.data.sessions.length} sesiones, ${backup.data.calculatorRecords.length} registros`,
    });
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Always reset the input so picking the same file twice fires `change`
    e.target.value = "";

    if (!file) return;
    if (importing) return;
    setImporting(true);

    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        toast.error("Archivo inválido", {
          description: "El archivo no es un JSON válido",
        });
        return;
      }

      const result = BackupShapeSchema.safeParse(parsed);
      if (!result.success) {
        toast.error("Backup inválido", {
          description: "El archivo no tiene la forma esperada",
        });
        return;
      }

      const shape = result.data as unknown as BackupShape;

      // Forward-compat light: warn but allow if version is ahead
      if (shape.version > BACKUP_VERSION) {
        const ok = window.confirm(
          `Este backup es de una versión más nueva (v${shape.version}). La actual es v${BACKUP_VERSION}. ¿Continuar?`,
        );
        if (!ok) return;
      }

      const ok = window.confirm(
        "Esto sobrescribirá tus datos actuales. ¿Continuar?",
      );
      if (!ok) return;

      const outcome = importAllData(shape);
      if (outcome.ok) {
        toast.success("Backup importado correctamente", {
          description: `${outcome.imported.length} claves restauradas`,
        });
      } else {
        toast.warning("Backup importado con errores", {
          description: `${outcome.imported.length} ok, ${outcome.errors.length} con error: ${outcome.errors.join("; ")}`,
        });
      }
    } catch (err) {
      toast.error("Error al importar", {
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setImporting(false);
    }
  }

  function handleClear() {
    const first = window.confirm(
      "¿Borrar TODOS los datos? Esto incluye sesiones guardadas, registros de la calculadora y drafts.",
    );
    if (!first) return;
    const second = window.confirm(
      "¿Estás seguro? Esta acción no se puede deshacer.",
    );
    if (!second) return;
    clearAllData();
    toast.success("Todos los datos eliminados");
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="status-strip" data-state="idle">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<Link href="/classes" />}
            aria-label="Volver al catálogo"
            className="rounded-md text-mute hover:text-bone hover:bg-transparent"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="font-display italic font-semibold text-lg leading-none tracking-tight truncate">
            Configuración
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 md:px-8 py-10 space-y-4">
        {/* ── Datos (open by default) ─────────────────────────────── */}
        <details open className="group">
          <Summary>Datos</Summary>
          <div className="chalk-card mt-2 space-y-4">
            <p className="text-sm text-mute leading-relaxed">
              Exportá una copia de todas tus sesiones, registros de la
              calculadora y drafts. Importá un backup previo para restaurar.
              Limpiar elimina todo de forma permanente.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleExport}
                className="numeric text-[0.6875rem] font-semibold uppercase tracking-[0.10em] bg-signal text-signal-foreground hover:bg-signal-deep rounded-md h-8 px-3 gap-1.5 inline-flex items-center"
              >
                <Download className="size-3.5" />
                Exportar todo
              </Button>

              <Button
                variant="ghost"
                onClick={handleImportClick}
                disabled={importing}
                className="numeric text-[0.6875rem] font-semibold uppercase tracking-[0.10em] border border-hairline text-bone hover:border-hairline-strong rounded-md h-8 px-3 gap-1.5 inline-flex items-center"
              >
                <FileUp className="size-3.5" />
                {importing ? "Importando…" : "Importar backup"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportFile}
                className="sr-only"
                aria-hidden
                tabIndex={-1}
              />

              <Button
                variant="ghost"
                onClick={handleClear}
                className="numeric text-[0.6875rem] font-semibold uppercase tracking-[0.10em] border border-destructive/30 text-destructive hover:bg-destructive/10 rounded-md h-8 px-3 gap-1.5 inline-flex items-center"
              >
                <Trash2 className="size-3.5" />
                Limpiar todos los datos
              </Button>
            </div>
          </div>
        </details>

        {/* ── Modelo (closed by default) ─────────────────────────── */}
        <details className="group">
          <Summary>Modelo</Summary>
          <dl className="chalk-card mt-2 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <dt className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute self-center">
              Provider
            </dt>
            <dd className="numeric text-sm text-bone self-center">
              {PROVIDER}
            </dd>
            <dt className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute self-center">
              Modelo activo
            </dt>
            <dd className="numeric text-sm text-bone self-center">{MODEL}</dd>
          </dl>
        </details>

        {/* ── Acerca de (closed by default) ───────────────────────── */}
        <details className="group">
          <Summary>Acerca de</Summary>
          <dl className="chalk-card mt-2 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <dt className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute self-center">
              Versión
            </dt>
            <dd className="numeric text-sm text-bone self-center">
              {pkg.version}
            </dd>
            <dt className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute self-start">
              Stack
            </dt>
            <dd className="text-sm text-bone">
              <ul className="space-y-1">
                {STACK.map((entry) => (
                  <li
                    key={entry}
                    className="numeric-label text-[0.8125rem] text-bone"
                  >
                    {entry}
                  </li>
                ))}
              </ul>
            </dd>
            <dt className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute self-center">
              Repositorio
            </dt>
            <dd className="text-sm self-center">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="numeric text-mute hover:text-bone underline-offset-4 hover:underline"
              >
                {REPO_URL.replace("https://", "")}
              </a>
            </dd>
          </dl>
        </details>
      </main>
    </div>
  );
}

function Summary({ children }: { children: React.ReactNode }) {
  return (
    <summary className="font-sans text-sm font-semibold uppercase tracking-[0.10em] text-bone cursor-pointer hover:text-foreground list-none flex items-center gap-2 [&::-webkit-details-marker]:hidden">
      <span
        aria-hidden
        className="text-mute text-xs group-open:rotate-90 transition-transform"
      >
        ▶
      </span>
      {children}
    </summary>
  );
}
