"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Trash2, History as HistoryIcon } from "lucide-react";
import { toast } from "sonner";
import type { GeneratedPlan } from "@/lib/types";
import { LEVEL_LABELS } from "@/lib/types";
import { useLocalStorage } from "@/hooks/use-local-storage";

const EMPTY: GeneratedPlan[] = [];

export function HistoryList() {
  const [items, setItems] = useLocalStorage<GeneratedPlan[]>(
    "pd:history",
    EMPTY,
  );
  const [expanded, setExpanded] = useLocalStorage<string | null>(
    "pd:expandedHistory",
    null,
  );

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id));
    toast.success("Eliminado del historial");
  }

  function handleClearAll() {
    if (!confirm("¿Borrar todo el historial?")) return;
    setItems([]);
    setExpanded(null);
    toast.success("Historial vaciado");
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <HistoryIcon className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Todavía no guardaste ningún plan.
          </p>
          <p className="text-xs text-muted-foreground">
            Andá a <span className="font-medium">Generar</span> y usá el botón
            Guardar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} plan{items.length === 1 ? "" : "es"} guardado
          {items.length === 1 ? "" : "s"}.
        </p>
        <Button variant="outline" size="sm" onClick={handleClearAll}>
          <Trash2 />
          Limpiar todo
        </Button>
      </div>
      {items.map((plan) => {
        const isOpen = expanded === plan.id;
        return (
          <Card key={plan.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-2">
                  <CardTitle className="text-base">
                    {plan.input.sport} —{" "}
                    <span className="text-muted-foreground font-normal text-sm">
                      {new Date(plan.createdAt).toLocaleString("es-AR")}
                    </span>
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {LEVEL_LABELS[plan.input.level]}
                    </Badge>
                    <Badge variant="outline">
                      {plan.input.daysPerWeek} días/sem
                    </Badge>
                    <Badge variant="outline">
                      {plan.input.sessionMinutes} min
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setExpanded(isOpen ? null : plan.id)
                    }
                  >
                    {isOpen ? "Cerrar" : "Ver"}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDelete(plan.id)}
                    aria-label="Eliminar"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {isOpen && (
              <CardContent>
                <Separator className="mb-4" />
                <ScrollArea className="h-96 rounded-md border border-border bg-muted/30 p-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {plan.content}
                    </ReactMarkdown>
                  </div>
                </ScrollArea>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
