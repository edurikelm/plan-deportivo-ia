import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ClaseForm } from "@/components/clase-form";
import { getClasses } from "@/lib/storage";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const classes = getClasses();
  const clase = classes.find((c) => c.id === id);
  return {
    title: clase ? `Editar ${clase.name} — Plan Deportivo IA` : "Editar Clase",
  };
}

export default async function EditClassPage({ params }: Props) {
  const { id } = await params;
  const classes = getClasses();
  const clase = classes.find((c) => c.id === id);

  if (!clase) {
    redirect("/classes");
  }

  return <ClaseForm initialClase={clase} />;
}
