"use client";

import { useState } from "react";
import { PlanForm } from "@/components/plan-form";
import { PlanResult } from "@/components/plan-result";
import { addToHistory } from "@/lib/storage";
import { toast } from "sonner";
import type { GeneratedPlan, PlanInput } from "@/lib/types";

export function GenerateClient() {
  const [content, setContent] = useState<string | null>(null);
  const [model, setModel] = useState<string>("");
  const [lastInput, setLastInput] = useState<PlanInput | null>(null);
  const [busy, setBusy] = useState(false);

  async function runGenerate(
    input: PlanInput,
    options: { onSuccess: string; errorPrefix?: string } = {
      onSuccess: "Plan generado y guardado en el historial",
    },
  ) {
    setBusy(true);
    setContent(null);

    const structure = localStorage.getItem("pd:structure");
    if (!structure?.trim()) {
      toast.error("Primero definí una estructura en /");
      setBusy(false);
      return;
    }

    try {
      localStorage.setItem("pd:lastInput", JSON.stringify(input));

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structure, planInput: input }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error ?? "Error desconocido");
        return;
      }

      const plan: GeneratedPlan = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        input,
        content: json.content,
        model: json.model,
      };

      setContent(plan.content);
      setModel(plan.model);
      setLastInput(input);
      addToHistory(plan);

      toast.success(options.onSuccess);
    } catch {
      toast.error(
        options.errorPrefix ??
          "No se pudo conectar con el servidor",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(input: PlanInput) {
    await runGenerate(input, {
      onSuccess: "Plan generado y guardado en el historial",
    });
  }

  async function handleRegenerate() {
    if (!lastInput) return;
    await runGenerate(lastInput, {
      onSuccess: "Plan regenerado y guardado en el historial",
      errorPrefix: "No se pudo regenerar",
    });
  }

  return (
    <div className="space-y-6">
      <PlanForm onSubmit={handleSubmit} busy={busy} />
      {content && lastInput && (
        <PlanResult
          content={content}
          model={model}
          input={lastInput}
          onRegenerate={handleRegenerate}
          busy={busy}
        />
      )}
    </div>
  );
}
