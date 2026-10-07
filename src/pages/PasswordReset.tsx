import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { completeAuthRedirect, getAccessToken } from "../lib/auth.js";
import { supabaseClient } from "../lib/supabase-client.js";
import {
  evaluatePasswordStrength,
  MIN_PASSWORD_LENGTH,
} from "../lib/passwordStrength.js";
import { AuthShell } from "../components/auth/AuthShell.js";
import { Button } from "../design-system/Button.js";
import { Input } from "../design-system/Input.js";

export function PasswordReset() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await completeAuthRedirect();
        if (!cancelled) setReady(Boolean(getAccessToken()));
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "The reset link could not be verified.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const strength = evaluatePasswordStrength(password);
  const confirmError =
    confirm.length > 0 && confirm !== password
      ? "Passwords do not match."
      : undefined;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessage(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }
    const token = getAccessToken();
    if (!token) {
      setMessage("This reset link is missing or expired. Request a new one.");
      return;
    }
    setPending(true);
    try {
      await supabaseClient.updatePassword(token, password);
      setPassword("");
      setConfirm("");
      setDone(true);
      setMessage(
        "Password reset successfully. You can now continue in AppForge.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to reset password.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Pick something strong — you will use it to sign in and to verify your account."
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
        <div>
          <Input
            id="reset-new-password"
            label="New password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {password.length > 0 && (
            <p className="mt-2 text-xs text-forge-text-muted">
              Password strength:{" "}
              <span className="font-semibold text-forge-text-primary">
                {strength.level}
              </span>
            </p>
          )}
        </div>
        <Input
          id="reset-confirm-password"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          error={confirmError}
        />
        {message && (
          <p
            role="status"
            className={
              done
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
          disabled={
            !ready ||
            pending ||
            password.length < MIN_PASSWORD_LENGTH ||
            confirm.length < MIN_PASSWORD_LENGTH
          }
        >
          Set new password
        </Button>
        {!ready && !message && (
          <p role="status" className="text-xs text-forge-text-muted">
            Verifying your reset link…
          </p>
        )}
      </form>
    </AuthShell>
  );
}
