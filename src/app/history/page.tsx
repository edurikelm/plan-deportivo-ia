import type { Metadata } from "next";
import { HistoryList } from "@/components/history-list";

export const metadata: Metadata = {
  title: "Historial — Plan IA",
  description: "Tus últimos planes generados.",
};

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Historial</h1>
        <p className="text-sm text-muted-foreground">
          Últimos planes que guardaste. Se almacenan solo en este navegador.
        </p>
      </header>
      <HistoryList />
    </div>
  );
}
