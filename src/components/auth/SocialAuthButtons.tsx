import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listSocialSignInProviders,
  startSocialSignIn,
} from "../../lib/auth.js";
import type { SocialSignInProvider } from "../../lib/supabase-client.js";
import { useLocale } from "../../i18n/LocaleContext.js";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.86c2.26-2.09 3.57-5.17 3.57-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a11.98 11.98 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.23 0 12 0 7.7 0 3.99 2.47 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12.02c0 5.09 3.29 9.4 7.86 10.93.58.1.79-.25.79-.55v-2.1c-3.2.7-3.88-1.36-3.88-1.36-.53-1.35-1.29-1.71-1.29-1.71-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.2 1.77 1.2 1.03 1.78 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.72 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a10.9 10.9 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.12 3.06.74.81 1.18 1.84 1.18 3.1 0 4.45-2.69 5.42-5.25 5.71.41.36.78 1.06.78 2.14v3.17c0 .3.2.66.8.55A11.51 11.51 0 0 0 23.5 12.02C23.5 5.66 18.35.5 12 .5Z" />
    </svg>
  );
}

function providerLabel(
  provider: SocialSignInProvider,
  t: (key: string) => string,
): string {
  return provider === "google"
    ? t("common.continueWithGoogle")
    : t("common.continueWithGitHub");
}

/**
 * Google/GitHub sign-in. Buttons are rendered only for providers the Supabase
 * project reports as enabled, so nothing here can dead-end the visitor.
 */
export function SocialAuthButtons({ next = "/" }: { next?: string }) {
  const { t } = useLocale();
  const [error, setError] = useState<string | null>(null);

  const { data: providers } = useQuery({
    queryKey: ["auth", "socialProviders"],
    queryFn: () => listSocialSignInProviders(),
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!providers || providers.length === 0) return null;

  const start = (provider: SocialSignInProvider) => {
    setError(null);
    try {
      startSocialSignIn(provider, next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("login.oauthUnavailable"),
      );
    }
  };

  return (
    <div data-testid="social-auth-buttons">
      <div className="space-y-3">
        {providers.map((provider) => (
          <button
            key={provider}
            type="button"
            onClick={() => start(provider)}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-full border border-forge-border bg-forge-surface px-4 text-sm font-medium text-forge-text-primary shadow-(--forge-shadow-soft) transition-[box-shadow,border-color] duration-forge hover:border-forge-gold/50 hover:shadow-(--forge-shadow) focus:outline-hidden focus-visible:ring-2 focus-visible:ring-forge-cyan/50"
          >
            {provider === "google" ? <GoogleIcon /> : <GitHubIcon />}
            {providerLabel(provider, t)}
          </button>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200"
        >
          {error}
        </p>
      )}

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-forge-border" aria-hidden="true" />
        <span className="text-xs uppercase tracking-[0.18em] text-forge-text-muted">
          {t("common.orContinueWithEmail")}
        </span>
        <span className="h-px flex-1 bg-forge-border" aria-hidden="true" />
      </div>
    </div>
  );
}
