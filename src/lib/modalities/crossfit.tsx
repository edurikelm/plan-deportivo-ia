"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CrossFitPlan, CrossFitSessionInput } from "./crossfit-schemas";
import { type Modality } from "./modalities";

// Re-export types for consumers
export type { Modality };

// ─── Plan view component ──────────────────────────────────────────────────────

interface CrossFitPlanViewProps {
  plan: CrossFitPlan;
}

function PhaseBlock({
  label,
  durationMin,
  description,
}: {
  label: string;
  durationMin: number;
  description: string;
}) {
  return (
    <section
      aria-label={label}
      className="py-4 border-b border-hairline last:border-0"
    >
      <header className="flex items-baseline justify-between gap-4 mb-2">
        <h3 className="font-display italic font-semibold text-base tracking-tight text-bone">
          {label}
        </h3>
        <span className="font-mono tabular-nums text-[0.6875rem] tracking-[0.04em] text-mute shrink-0">
          {durationMin} min
        </span>
      </header>
      <div
        className="prose prose-invert max-w-prose prose-headings:font-display prose-headings:italic prose-headings:tracking-tight prose-strong:text-bone prose-code:font-mono prose-code:text-bone prose-code:before:content-none prose-code:after:content-none prose-li:my-1"
        style={{ fontSize: "0.9375rem", lineHeight: 1.55 }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {description}
        </ReactMarkdown>
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
        <p className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-mute mb-1">
          CrossFit · {plan.estimated_duration_min} min estimadas
        </p>
        <h2 className="font-display italic font-semibold text-2xl md:text-[1.875rem] leading-[1.1] tracking-tight text-bone">
          {plan.class_title}
        </h2>
        {plan.focus_movement && (
          <p className="font-mono tabular text-[0.6875rem] tracking-[0.04em] text-mute mt-1">
            Enfoque: {plan.focus_movement}
          </p>
        )}
      </header>

      <PhaseBlock
        label="Warm-Up"
        durationMin={plan.sections.warm_up.duration_min}
        description={plan.sections.warm_up.description}
      />
      <PhaseBlock
        label="Strength / Skill"
        durationMin={plan.sections.strength_skill.duration_min}
        description={plan.sections.strength_skill.description}
      />
      <PhaseBlock
        label={`WOD — ${plan.sections.wod.format}`}
        durationMin={plan.sections.wod.time_cap_min}
        description={`**Tipo de score:** ${plan.sections.wod.score_type}\n\n${plan.sections.wod.description}`}
      />
      <PhaseBlock
        label="Cool Down"
        durationMin={plan.sections.cool_down.duration_min}
        description={plan.sections.cool_down.description}
      />
    </article>
  );
}

// Re-export types for convenience
export type { CrossFitPlan, CrossFitSessionInput };
