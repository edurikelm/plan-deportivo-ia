"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_STRUCTURE } from "@/lib/types";
import { useLocalStorage } from "@/hooks/use-local-storage";

const STORAGE_KEY = "pd:structure";

export function StructureEditor() {
  const [stored, setStored] = useLocalStorage<string>(
    STORAGE_KEY,
    DEFAULT_STRUCTURE,
  );

  const value = stored;
  const dirty = value !== stored;

  function save() {
    setStored(value);
    toast.success("Estructura guardada", {
      description: "Se usará para los próximos planes.",
    });
  }

  function reset() {
    setStored(DEFAULT_STRUCTURE);
    toast.info("Estructura restablecida al ejemplo", {
      description: "Hacé clic en Guardar para aplicar.",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estructura de respuesta</CardTitle>
        <CardDescription>
          Definí cómo querés que la IA te responda siempre. Podés usar
          placeholders como <code className="text-xs">{"{sport}"}</code>,{" "}
          <code className="text-xs">{"{level}"}</code>,{" "}
          <code className="text-xs">{"{goals}"}</code> y{" "}
          <code className="text-xs">{"{notes}"}</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="editor" className="w-full">
          <TabsList>
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="editor" className="mt-4">
            <Textarea
              value={value}
              onChange={(e) =>
                setStored(e.target.value)
              }
              className="font-mono text-sm min-h-96"
              placeholder="Escribí tu estructura en markdown..."
            />
          </TabsContent>
          <TabsContent value="preview" className="mt-4">
            <ScrollArea className="h-96 rounded-md border border-border bg-muted/30 p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {value || "_Sin contenido todavía_"}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
        <Separator />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {dirty ? "Cambios sin guardar" : "Todo guardado"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset}>
              <RotateCcw />
              Restablecer
            </Button>
            <Button onClick={save} disabled={!dirty}>
              <Save />
              Guardar estructura
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
