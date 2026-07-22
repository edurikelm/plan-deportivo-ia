"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Dumbbell } from "lucide-react";
import {
  GOAL_OPTIONS,
  type Level,
  type PlanInput,
} from "@/lib/types";
import { useLocalStorage } from "@/hooks/use-local-storage";

const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: "beginner", label: "Principiante" },
  { value: "intermediate", label: "Intermedio" },
  { value: "advanced", label: "Avanzado" },
];

const EMPTY: PlanInput = {
  sport: "",
  level: "intermediate",
  daysPerWeek: 3,
  sessionMinutes: 60,
  goals: [],
  equipment: "",
  notes: "",
};

interface PlanFormProps {
  onSubmit: (input: PlanInput) => Promise<void> | void;
  busy: boolean;
}

export function PlanForm({ onSubmit, busy }: PlanFormProps) {
  const [lastInput, setLastInput] = useLocalStorage<PlanInput>(
    "pd:lastInput",
    EMPTY,
  );

  function update<K extends keyof PlanInput>(
    key: K,
    value: PlanInput[K],
  ) {
    setLastInput((prev) => ({ ...prev, [key]: value }));
  }

  function toggleGoal(g: string) {
    setLastInput((prev) => ({
      ...prev,
      goals: prev.goals.includes(g)
        ? prev.goals.filter((x) => x !== g)
        : [...prev.goals, g],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (!lastInput.sport.trim()) {
      return;
    }
    if (lastInput.goals.length === 0) {
      return;
    }

    const input: PlanInput = {
      ...lastInput,
      sport: lastInput.sport.trim(),
      equipment: lastInput.equipment.trim(),
      notes: lastInput.notes?.trim() || undefined,
    };

    await onSubmit(input);
  }

  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <CardTitle>Datos del entrenamiento</CardTitle>
        <CardDescription>
          Completá estos datos para generar el plan. Se guarda tu última
          entrada automáticamente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-6">
          <fieldset disabled={busy} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sport">Deporte</Label>
                <Input
                  id="sport"
                  placeholder="gym, fútbol, running, yoga…"
                  value={lastInput.sport}
                  onChange={(e) => update("sport", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="level">Nivel</Label>
                <Select
                  value={lastInput.level}
                  onValueChange={(v) => update("level", v as Level)}
                >
                  <SelectTrigger id="level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="days">Días por semana</Label>
                <Input
                  id="days"
                  type="number"
                  min={1}
                  max={7}
                  value={lastInput.daysPerWeek}
                  onChange={(e) =>
                    update("daysPerWeek", Number(e.target.value))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minutes">Minutos por sesión</Label>
                <Input
                  id="minutes"
                  type="number"
                  min={15}
                  max={180}
                  step={5}
                  value={lastInput.sessionMinutes}
                  onChange={(e) =>
                    update("sessionMinutes", Number(e.target.value))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Objetivos</Label>
              <div className="flex flex-wrap gap-2">
                {GOAL_OPTIONS.map((g) => {
                  const active = lastInput.goals.includes(g);
                  return (
                    <Badge
                      key={g}
                      variant={active ? "default" : "outline"}
                      className="cursor-pointer select-none"
                      onClick={() => toggleGoal(g)}
                    >
                      {g}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="equipment">Equipo disponible</Label>
              <Textarea
                id="equipment"
                placeholder="Mancuernas, barra, bandas, máquina de poleas…"
                value={lastInput.equipment}
                onChange={(e) => update("equipment", e.target.value)}
                className="min-h-20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas / lesiones (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Lesión de rodilla derecha, no puedo hacer sentadilla profunda…"
                value={lastInput.notes}
                onChange={(e) => update("notes", e.target.value)}
                className="min-h-20"
              />
            </div>
          </fieldset>

          <Button type="submit" disabled={busy} className="w-full" size="lg">
            {busy ? (
              <>
                <Loader2 className="animate-spin" />
                Generando plan… (no se puede interrumpir)
              </>
            ) : (
              <>
                <Dumbbell />
                Generar plan
              </>
            )}
          </Button>
        </form>
      </CardContent>

      {busy && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px] pointer-events-none"
          aria-hidden="true"
        >
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />
            <p className="text-sm font-medium">
              Esperando respuesta de la IA…
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
