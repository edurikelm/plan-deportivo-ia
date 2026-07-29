import type { Metadata } from "next";
import { Inter, Archivo_Narrow, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const archivoNarrow = Archivo_Narrow({
  variable: "--font-archivo-narrow",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Plan Deportivo IA",
  description: "Generador de planes deportivos con IA",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${archivoNarrow.variable} ${geistMono.variable} h-full dark antialiased`}
    >
      <body className="min-h-full bg-background text-foreground font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
