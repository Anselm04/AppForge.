import { FormEvent, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { supabaseClient } from "../lib/supabase-client.js";
import { isValidEmail } from "../lib/passwordStrength.js";
import { AuthShell } from "../components/auth/AuthShell.js";
import { Button } from "../design-system/Button.js";
import { Input } from "../design-system/Input.js";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [touched, setTouched] = useState(false);

  const emailError =
    touched && email.length > 0 && !isValidEmail(email)
      ? "Enter a valid email address."
      : undefined;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    if (!isValidEmail(email)) {
      setTouched(true);
      return;
    }
    submitting.current = true;
    setPending(true);
    setMessage(null);
    try {
      await supabaseClient.requestPasswordReset(email.trim());
      setSent(true);
      setMessage(
        "If that email belongs to an AppForge account, a password-reset link has been sent.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to request a password reset.",
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your sign-in email and AppForge will send a secure reset link."
      footer={
        <Link
          to="/login"
          className="font-medium text-forge-cyan hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Input
          id="forgot-email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          required
          value={email}
          error={emailError}
          onChange={(event) => setEmail(event.target.value)}
          onBlur={() => setTouched(true)}
        />
        {message && (
          <p
            role="status"
            className={
              sent
                ? "rounded-lg border border-forge-cyan/25 bg-forge-cyan/10 px-3 py-2 text-sm text-forge-cyan"
                : "rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-200"
            }
          >
            {message}
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          loading={pending}
          disabled={pending || !email.trim()}
        >
          {sent ? "Resend reset link" : "Send reset link"}
        </Button>
      </form>
    </AuthShell>
  );
}
