import type { Metadata } from "next";
import { GenerateClient } from "./_components/generate-client";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Generar Idea — Plan Deportivo IA",
  };
}

export default async function GeneratePage({ params }: Props) {
  const { id } = await params;
  return <GenerateClient ideaId={id} />;
}
