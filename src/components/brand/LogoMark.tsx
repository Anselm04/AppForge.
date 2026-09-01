import { cn } from "../../lib/cn.js";

type Size = "sm" | "md" | "lg" | "hero";

const SIZE_MAP: Record<Size, { tile: string; icon: string; text: string }> = {
  sm: { tile: "h-8 w-8", icon: "h-4 w-4", text: "text-lg" },
  md: { tile: "h-10 w-10", icon: "h-5 w-5", text: "text-xl" },
  lg: { tile: "h-14 w-14", icon: "h-7 w-7", text: "text-2xl" },
  hero: { tile: "h-20 w-20", icon: "h-10 w-10", text: "text-4xl" },
};

type LogoMarkProps = {
  size?: Size;
  showTile?: boolean;
  glow?: boolean;
  className?: string;
};

export function LogoMark({
  size = "md",
  showTile = true,
  glow = false,
  className,
}: LogoMarkProps) {
  const s = SIZE_MAP[size];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-xl bg-forge-gradient text-white",
        showTile ? s.tile : "",
        glow ? "shadow-glow" : "",
        className,
      )}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={s.icon}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4 14l4-10h8l4 10-8 8-8-8z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill="currentColor"
          fillOpacity="0.15"
        />
      </svg>
    </span>
  );
}

type LogoLockupProps = {
  size?: Size;
  className?: string;
};

export function LogoLockup({ size = "md", className }: LogoLockupProps) {
  const s = SIZE_MAP[size];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-display font-semibold text-forge-text-primary",
        className,
      )}
    >
      <LogoMark size={size} />
      <span className={s.text}>AppForge</span>
    </span>
  );
}
