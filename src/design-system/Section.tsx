import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

type Props = {
  id?: string;
  title?: string;
  subtitle?: string;
  className?: string;
  children?: ReactNode;
};

export function Section({ id, title, subtitle, className, children }: Props) {
  return (
    <section id={id} className={cn("forge-section", className)}>
      <div className="forge-container">
        {(title || subtitle) && (
          <div className="text-center mb-10">
            {title && <h2 className="forge-h2">{title}</h2>}
            {subtitle && (
              <p className="mt-3 forge-body max-w-2xl mx-auto">{subtitle}</p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
