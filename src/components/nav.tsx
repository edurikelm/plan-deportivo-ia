"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Dumbbell, FileText, History } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Estructura", icon: FileText },
  { href: "/generate", label: "Generar", icon: Dumbbell },
  { href: "/history", label: "Historial", icon: History },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex flex-col w-56 shrink-0 border-r border-border min-h-dvh p-6 gap-1">
      <Link
        href="/"
        className="text-sm font-semibold tracking-tight mb-6 px-3"
      >
        Plan IA
      </Link>
      {ITEMS.map((item) => {
        const Active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              Active
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
