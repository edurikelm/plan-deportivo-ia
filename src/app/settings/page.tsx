import type { Metadata } from "next";
import { SettingsClient } from "./_components/settings-client";

export const metadata: Metadata = {
  title: "Configuración — Plan Deportivo IA",
};

export default function SettingsPage() {
  return <SettingsClient />;
}
