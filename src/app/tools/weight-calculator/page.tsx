import type { Metadata } from "next";
import { CalculatorClient } from "./_components/calculator-client";

export const metadata: Metadata = {
  title: "Calculadora de Pesos — Plan Deportivo IA",
};

export default function WeightCalculatorPage() {
  return <CalculatorClient />;
}
