import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LogoLockup } from "../brand/LogoMark.js";

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Replaces the default brand panel on wide screens. */
  aside?: ReactNode;
};

const HIGHLIGHTS = [
  "Agent pipeline plans, codes, reviews, and deploys",
  "Production builds with tests and evidence attached",
  "Templates, credits, and team tools included",
];

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-1 shrink-0 text-forge-cyan"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function BrandPanel() {
  return (
    <div className="max-w-md">
      <LogoLockup size="lg" className="mb-10" />
      <h2 className="forge-h2 mb-4">
        Forge production apps from a single prompt
      </h2>
      <p className="forge-body mb-8">
        AppForge turns your idea into a planned, tested, deployable application
        — with the evidence to prove it works.
      </p>
      <ul className="space-y-3">
        {HIGHLIGHTS.map((item) => (
          <li key={item} className="flex gap-3 text-sm text-forge-text-primary">
            <CheckIcon />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="forge-badge mt-10">
        <span className="dot" aria-hidden="true" />
        Verified accounts
      </div>
    </div>
  );
}

/**
 * Shared chrome for every auth screen: branded split layout on desktop, a
 * single centred card on mobile.
 */
export function AuthShell({
  title,
  subtitle,
  eyebrow,
  children,
  footer,
  aside,
}: Props) {
  return (
    <div className="relative isolate overflow-hidden bg-forge-mesh">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(196,163,90,0.20),transparent_70%)] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(110,201,208,0.18),transparent_70%)] blur-3xl"
      />

      <div className="relative mx-auto flex w-full max-w-6xl items-center gap-12 px-4 py-12 lg:min-h-[calc(100vh-4rem)] lg:py-16">
        <div className="hidden w-1/2 lg:block">{aside ?? <BrandPanel />}</div>

        <div className="w-full lg:w-1/2">
          <div className="mx-auto w-full max-w-md">
            <Link
              to="/"
              className="mb-8 inline-flex lg:hidden"
              aria-label="AppForge home"
            >
              <LogoLockup size="sm" />
            </Link>

            {eyebrow && (
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-forge-cyan">
                {eyebrow}
              </p>
            )}
            <h1 className="forge-h2 mb-2">{title}</h1>
            {subtitle && (
              <p className="mb-8 text-sm leading-relaxed text-forge-text-muted">
                {subtitle}
              </p>
            )}

            <div className="forge-glass rounded-card p-6 sm:p-8 forge-noise">
              {children}
            </div>

            {footer && (
              <div className="mt-6 text-center text-sm text-forge-text-muted">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
