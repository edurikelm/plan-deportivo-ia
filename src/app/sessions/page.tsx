import type { Metadata } from "next";
import { SessionsClient } from "./_components/sessions-client";

export const metadata: Metadata = {
  title: "Sesiones guardadas — Plan Deportivo IA",
};

export default function SessionsPage() {
  return <SessionsClient />;
}
