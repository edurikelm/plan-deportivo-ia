import type { Metadata } from "next";
import { EditClassPageClient } from "./_components/edit-class-page-client";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params;
  return {
    title: `Editar Clase — Plan Deportivo IA`,
  };
}

export default async function EditClassPage({ params }: Props) {
  const { id } = await params;
  return <EditClassPageClient id={id} />;
}
