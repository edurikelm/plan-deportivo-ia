import type { Metadata } from "next";
import { AnalysisPageClient } from "../_components/analysis-page-client";

interface Props {
  params: Promise<{ name: string }>;
}

/**
 * Server shell for the per-exercise analysis view (issue 0039).
 *
 * The actual logic — storage subscription, chart rendering, record
 * mutations — lives in `AnalysisPageClient` (a "use client" component).
 * The server shell only decodes the `name` URL segment and sets the
 * document title; rendering happens entirely on the client because the
 * page is driven by `pd:calculator-records` (a browser-localStorage key).
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  return {
    title: `${decoded} — Análisis — Plan Deportivo IA`,
  };
}

export default async function ExerciseAnalysisPage({ params }: Props) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  return <AnalysisPageClient name={decoded} />;
}
