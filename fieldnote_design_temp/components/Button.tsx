import * as React from "react";

type Variant = "primary" | "secondary" | "ghost";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base = "px-4 py-2 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2";
  const variants: Record<Variant,string> = {
    primary: "bg-[var(--color-primary)] text-white hover:brightness-110 focus:ring-[var(--color-primary)]",
    secondary: "border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-secondary)] focus:ring-[var(--color-primary)]",
    ghost: "text-[var(--color-primary)] hover:bg-[var(--color-secondary)] focus:ring-[var(--color-primary)]",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}