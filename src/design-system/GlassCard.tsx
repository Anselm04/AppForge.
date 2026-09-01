import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.js";

type Padding = "sm" | "md" | "lg";

type Props = HTMLAttributes<HTMLDivElement> & {
  hover?: boolean;
  padding?: Padding;
  children?: ReactNode;
};

const PADDINGS: Record<Padding, string> = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function GlassCard({
  hover = true,
  padding = "md",
  className,
  children,
  ...rest
}: Props) {
  return (
    <div
      className={cn(
        "forge-glass rounded-card transition-shadow duration-forge",
        PADDINGS[padding],
        hover ? "hover:shadow-card-hover" : "",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
