import * as React from "react";

type Tone = "success" | "warning" | "error" | "neutral";

export function Badge({
  children,
  tone = "neutral",
  className = "",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  const base = "inline-flex items-center rounded-lg px-2 py-1 text-xs font-medium";
  const tones: Record<Tone,string> = {
    success: "bg-[var(--color-accent)]/15 text-[var(--color-accent)]",
    warning: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
    error: "bg-[var(--color-error)]/15 text-[var(--color-error)]",
    neutral: "bg-[var(--color-secondary)] text-[var(--color-text)]",
  };
  return (
    <span className={`${base} ${tones[tone]} ${className}`} {...props}>
      {children}
    </span>
  );
}