import type { Metadata } from "next";
import { HistoryPageClient } from "../_components/history-page-client";

export const metadata: Metadata = {
  title: "Historial — Calculadora de Pesos — Plan Deportivo IA",
};

export default function WeightCalculatorHistoryPage() {
  return <HistoryPageClient />;
}
