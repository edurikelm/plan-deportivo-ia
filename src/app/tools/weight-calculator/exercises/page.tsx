import type { Metadata } from "next";
import { ExercisesPageClient } from "./_components/exercises-page-client";

/**
 * Server shell for the exercises catalog (issue 0042).
 *
 * The actual list — storage subscription, derivation, and per-exercise
 * cards — lives in `ExercisesPageClient` (a "use client" component).
 * The server shell only sets the document title; rendering happens
 * entirely on the client because the page is driven by
 * `pd:calculator-records` (a browser-localStorage key).
 *
 * The route replaces the older `/tools/weight-calculator/history`
 * surface, which used the same data but a different shape (flat
 * `ExerciseSummary` via `aggregateByExercise`). See `next.config.ts`
 * for the permanent redirect from the old URL.
 */
export const metadata: Metadata = {
  title: "Ejercicios — Calculadora de Pesos — Plan Deportivo IA",
};

export default function ExercisesPage() {
  return <ExercisesPageClient />;
}
