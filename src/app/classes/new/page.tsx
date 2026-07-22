import type { Metadata } from "next";
import { ClaseForm } from "@/components/clase-form";

export const metadata: Metadata = {
  title: "Nueva Clase — Plan Deportivo IA",
};

export default function NewClassPage() {
  return <ClaseForm />;
}
