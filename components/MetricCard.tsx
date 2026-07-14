import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: "default" | "accent" | "cyber";
}

const accentText: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  default: "text-zinc-50",
  accent: "text-accent",
  cyber: "text-cyber",
};

export function MetricCard({ label, value, hint, accent = "default" }: MetricCardProps) {
  return (
    <div className="card animate-fade-up">
      <p className="metric-label">{label}</p>
      <p className={`metric-value mt-3 ${accentText[accent]}`}>{value}</p>
      {hint ? <p className="mt-2 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}
