import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

type Props = {
  children: ReactNode;
  tone?: "default" | "gold" | "cyan" | "success";
  className?: string;
};

const tones = {
  default: "bg-white/[0.06] text-forge-text-muted border-white/[0.08]",
  gold: "bg-forge-gold/10 text-forge-gold border-forge-gold/30",
  cyan: "bg-forge-cyan/10 text-forge-cyan border-forge-cyan/30",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

export function Badge({ children, tone = "default", className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
