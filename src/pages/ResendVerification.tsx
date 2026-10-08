import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resendVerification, safeAuthDestination } from "../lib/auth.js";
import { isValidEmail } from "../lib/passwordStrength.js";
import { AuthShell } from "../components/auth/AuthShell.js";
import { Button } from "../design-system/Button.js";
import { Input } from "../design-system/Input.js";

export function ResendVerification() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const availableAt = useRef(0);
  const next = safeAuthDestination(params.get("next"));
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => {
      setCooldown(
        Math.max(0, Math.ceil((availableAt.current - Date.now()) / 1000)),
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      submitting.current ||
      Date.now() < availableAt.current ||
      !isValidEmail(email.trim())
    )
      return;
    submitting.current = true;
    setPending(true);
    setMessage("");
    // Reserve the cooldown before awaiting to protect double submissions and failures.
    availableAt.current = Date.now() + 60_000;
    setCooldown(60);
    try {
      await resendVerification(email, next);
      setMessage(
        "If this address has an account awaiting confirmation, a verification email has been requested. Check your inbox and spam folder.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to request a verification email.",
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  return (
    <AuthShell
      title="Verify your email"
      subtitle="Request a new confirmation link to finish signing up."
      footer={
        <Link
          to={`/login?next=${encodeURIComponent(next)}`}
          className="text-forge-cyan hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <Input
          id="verification-email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          loading={pending}
          disabled={pending || cooldown > 0 || !isValidEmail(email.trim())}
        >
          {cooldown > 0
            ? `Try again in ${cooldown}s`
            : "Resend verification email"}
        </Button>
      </form>
    </AuthShell>
  );
}
