import { getClasses } from "@/lib/storage";
import { ClassesListClient } from "./_components/classes-list-client";

export const metadata = {
  title: "Clases — Plan Deportivo IA",
};

export default function ClassesPage() {
  const classes = getClasses();
  return <ClassesListClient initialClasses={classes} />;
}
