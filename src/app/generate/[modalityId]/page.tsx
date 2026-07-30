import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GenerateClient } from "./_components/generate-client";
import { getModality } from "@/lib/modalities/modalities";

interface Props {
  params: Promise<{ modalityId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { modalityId } = await params;
  const modality = getModality(modalityId);
  return {
    title: modality
      ? `Generar ${modality.label} — Plan Deportivo IA`
      : "Modalidad — Plan Deportivo IA",
  };
}

export default async function GeneratePage({ params }: Props) {
  const { modalityId } = await params;
  const modality = getModality(modalityId);
  if (!modality) {
    notFound();
  }
  return <GenerateClient modalityId={modalityId} />;
}
