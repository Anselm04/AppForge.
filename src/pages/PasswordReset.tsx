import { FormEvent, useEffect, useState } from "react";
import { completeAuthRedirect, getAccessToken } from "../lib/auth.js";
import { supabaseClient } from "../lib/supabase-client.js";
import { Button } from "../design-system/Button.js";
import { GlassCard } from "../design-system/GlassCard.js";
import { Input } from "../design-system/Input.js";

export function PasswordReset() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await completeAuthRedirect();
        if (!cancelled) setReady(Boolean(getAccessToken()));
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "The reset link could not be verified.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
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
      setMessage("Password reset successfully. You can now continue in AppForge.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to reset password.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-forge-mesh px-4 py-12">
      <div className="mx-auto max-w-md">
        <h1 className="forge-h2 text-forge-text-primary mb-8">Choose a new password</h1>
        <GlassCard hover={false} padding="lg">
          <form onSubmit={submit} className="space-y-4">
            <Input id="reset-new-password" label="New password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
            <Input id="reset-confirm-password" label="Confirm new password" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
            {message && <p className="text-sm text-forge-text-muted" role="status">{message}</p>}
            <Button type="submit" className="w-full" loading={pending} disabled={!ready || pending || password.length < 8 || confirm.length < 8}>
              Set new password
            </Button>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}
