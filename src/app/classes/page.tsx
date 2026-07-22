import type { Metadata } from "next";
import { ClassesListClient } from "./_components/classes-list-client";

export const metadata: Metadata = {
  title: "Clases — Plan Deportivo IA",
};

export default function ClassesPage() {
  return <ClassesListClient />;
}
