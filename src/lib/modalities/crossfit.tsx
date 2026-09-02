"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  CrossFitPlan,
  CrossFitSessionInput,
} from "./crossfit-schemas";
import type { Modality } from "./modalities";

export type { Modality };

// Re-export types for consumers
export type { CrossFitPlan, CrossFitSessionInput };

// ─── Plan view component ──────────────────────────────────────────────────────

interface CrossFitPlanViewProps {
  plan: CrossFitPlan;
}

function PhaseBlock({
  label,
  durationMin,
  description,
  exercises,
  number,
}: {
  label: string;
  durationMin: number;
  description: string;
  exercises: readonly string[];
  number: string;
}) {
  return (
    <section
      aria-label={`${number} — ${label}`}
      className="py-4 border-b border-hairline last:border-0"
    >
      <header className="flex items-baseline gap-3 mb-2">
        <span
          aria-hidden
          className="numeric-label text-[0.6875rem] text-signal shrink-0 mt-0.5"
        >
          {number}
        </span>
        <h3 className="font-display italic font-semibold text-base tracking-tight text-bone flex-1 leading-none">
          {label}
        </h3>
        <span className="numeric-label text-[0.6875rem] text-mute shrink-0">
          {durationMin} min
        </span>
      </header>
      <div
        className="prose prose-invert prose-chalk"
        style={{ fontSize: "0.9375rem", lineHeight: 1.55 }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {description}
        </ReactMarkdown>
        {exercises.length > 0 && (
          <ul className="mt-1">
            {exercises.map((ex, i) => (
              <li key={i}>{ex}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function CrossFitPlanView({ plan }: CrossFitPlanViewProps) {
  return (
    <article
      className="chalk-card"
      aria-label={`Plan de clase: ${plan.class_title}`}
    >
      <header className="pb-4 border-b border-hairline">
        <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute">
          CrossFit · {plan.estimated_duration_min} min estimadas
        </p>
        {plan.focus_movement && (
          <p className="numeric-label text-[0.6875rem] text-mute mt-1">
            Enfoque: {plan.focus_movement}
          </p>
        )}
      </header>

      <PhaseBlock
        number="01"
        label="Warm-Up"
        durationMin={plan.sections.warm_up.duration_min}
        description={plan.sections.warm_up.description}
        exercises={plan.sections.warm_up.exercises}
      />
      <PhaseBlock
        number="02"
        label="Strength / Skill"
        durationMin={plan.sections.strength_skill.duration_min}
        description={plan.sections.strength_skill.description}
        exercises={plan.sections.strength_skill.exercises}
      />
      <PhaseBlock
        number="03"
        label={`WOD — ${plan.sections.wod.format}`}
        durationMin={plan.sections.wod.time_cap_min}
        description={`**Tipo de score:** ${plan.sections.wod.score_type}\n\n${plan.sections.wod.description}`}
        exercises={plan.sections.wod.exercises}
      />
      <PhaseBlock
        number="04"
        label="Cool Down"
        durationMin={plan.sections.cool_down.duration_min}
        description={plan.sections.cool_down.description}
        exercises={plan.sections.cool_down.exercises}
      />
    </article>
  );
}
