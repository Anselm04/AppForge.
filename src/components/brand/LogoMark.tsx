import { cn } from "../../lib/cn.js";

type Size = "sm" | "md" | "lg" | "hero";

const SIZE_MAP: Record<Size, { tile: string; text: string; px: number }> = {
  sm: { tile: "h-8 w-8", text: "text-lg", px: 32 },
  md: { tile: "h-10 w-10", text: "text-xl", px: 40 },
  lg: { tile: "h-14 w-14", text: "text-2xl", px: 56 },
  hero: { tile: "h-28 w-28", text: "text-4xl", px: 112 },
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
    <img
      src="/appforge-logo.png"
      alt=""
      width={s.px}
      height={s.px}
      className={cn(
        "object-contain shrink-0",
        showTile ? s.tile : "h-auto w-auto",
        glow ? "forge-logo-glow" : "",
        className,
      )}
    />
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
        "inline-flex items-center gap-2.5 font-display font-medium text-[color:var(--forge-heading)]",
        className,
      )}
    >
      <LogoMark size={size} glow />
      <span className={s.text}>AppForge</span>
    </span>
  );
}
