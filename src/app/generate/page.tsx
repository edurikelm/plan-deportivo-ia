import type { Metadata } from "next";
import Link from "next/link";
import { GenerateClient } from "./_components/generate-client";

export const metadata: Metadata = {
  title: "Generar plan — Plan IA",
  description: "Generá un plan de entrenamiento personalizado con IA.",
};

export default function GeneratePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Generar plan
        </h1>
        <p className="text-sm text-muted-foreground">
          Completá los datos y generá un plan siguiendo la estructura que
          definiste en{" "}
          <Link href="/" className="underline underline-offset-2">
            Estructura
          </Link>
          .
        </p>
      </header>
      <GenerateClient />
    </div>
  );
}
