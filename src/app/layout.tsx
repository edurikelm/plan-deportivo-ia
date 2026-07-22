import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Nav } from "@/components/nav";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Plan IA — Generador de planes deportivos",
  description:
    "App minimalista para generar planes de ejercicio deportivo con inteligencia artificial.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground font-sans flex">
        <Nav />
        <main className="flex-1 min-w-0">
          <div className="mx-auto max-w-3xl px-6 py-10">{children}</div>
        </main>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
