import { StructureEditor } from "@/components/structure-editor";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Estructura de respuesta
        </h1>
        <p className="text-sm text-muted-foreground">
          Definí cómo querés que la IA te responda siempre. Esta estructura se
          guarda en tu navegador y se usa para todos los planes que generes.
        </p>
      </header>
      <StructureEditor />
    </div>
  );
}
