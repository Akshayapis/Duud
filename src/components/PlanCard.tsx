import { Check, Sparkles, Zap } from "lucide-react";
import type { Plan } from "@/data/catalog";
import { inr } from "@/lib/store";
import { buttonClass } from "@/components/ui";
import { cn } from "@/utils/cn";

export function PlanCard({
  plan,
  current,
  onChoose,
  ctaLabel,
  compact,
}: {
  plan: Plan;
  current?: boolean;
  onChoose: () => void;
  ctaLabel?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border bg-panel p-5 transition-all duration-300 hover:-translate-y-0.5",
        plan.highlight ? "border-lime/50 shadow-[0_20px_60px_-30px_rgba(201,246,91,.5)]" : "border-line hover:border-ink/20"
      )}
    >
      {plan.highlight && (
        <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-lime px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.12em] text-limeink">
          <Sparkles className="h-3 w-3" /> Most popular
        </span>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-[17px] font-semibold text-ink">{plan.name}</h3>
          <p className="mt-1 text-[11.5px] text-muted">{plan.duration}</p>
        </div>
        {current && <span className="rounded-full border border-lime/30 bg-lime/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-limeink dark:text-lime">Current</span>}
      </div>
      <div className="mt-4 flex items-end gap-1.5">
        <span className="font-display text-[30px] font-bold leading-none tracking-tight text-ink">{plan.price === 0 ? "Free" : inr(plan.price)}</span>
        {plan.price > 0 && <span className="pb-1 text-[11px] text-muted">/ {plan.days} days</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md bg-panel2 px-2 py-1 text-[10.5px] font-semibold text-ink">
          <Zap className="h-3 w-3 text-lime" /> {plan.credits} app credits
        </span>
        <span className="rounded-md bg-panel2 px-2 py-1 text-[10.5px] font-medium text-muted">{plan.maxProjectMb} MB</span>
        <span className="rounded-md bg-panel2 px-2 py-1 text-[10.5px] font-medium text-muted">{plan.ads ? "Ads enabled" : "No ads"}</span>
        <span className="rounded-md bg-panel2 px-2 py-1 text-[10.5px] font-medium text-muted">{plan.api ? "API access" : "No API"}</span>
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-muted">{plan.description}</p>
      <ul className={cn("mt-4 space-y-2 border-t border-line pt-4", compact && "space-y-1.5")}>
        {plan.features.slice(0, compact ? 5 : 8).map((f) => (
          <li key={f} className="flex items-start gap-2 text-[11.5px] leading-relaxed text-ink/85">
            <Check className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", plan.ads ? "text-lime" : "text-muted")} />
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onChoose}
        className={buttonClass(plan.highlight ? "lime" : current ? "secondary" : "primary", "md", "mt-5 w-full")}
        disabled={current}
      >
        {current ? "Your current plan" : ctaLabel ?? (plan.price === 0 ? "Start free" : `Choose ${plan.name}`)}
      </button>
    </div>
  );
}
