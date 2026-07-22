"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, RefreshCw, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { PlanInput } from "@/lib/types";

interface PlanResultProps {
  content: string;
  model: string;
  input: PlanInput;
  onRegenerate: () => void;
  busy: boolean;
}

export function PlanResult({
  content,
  model,
  input,
  onRegenerate,
  busy,
}: PlanResultProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Copiado al portapapeles");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <CardTitle>Plan generado</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{input.sport}</Badge>
              <Badge variant="outline">
                {input.daysPerWeek} días/sem
              </Badge>
              <Badge variant="outline">{input.sessionMinutes} min</Badge>
              <Badge variant="outline" className="font-mono text-xs">
                {model}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Guardado en tu historial automáticamente.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={copy}
              disabled={busy}
              aria-label="Copiar"
            >
              {copied ? <Check /> : <Copy />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onRegenerate}
              disabled={busy}
              aria-label="Regenerar"
            >
              {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] rounded-md border border-border bg-muted/30 p-6">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
