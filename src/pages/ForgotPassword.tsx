import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { supabaseClient } from "../lib/supabase-client.js";
import { Button } from "../design-system/Button.js";
import { GlassCard } from "../design-system/GlassCard.js";
import { Input } from "../design-system/Input.js";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      await supabaseClient.requestPasswordReset(email.trim());
      setMessage("If that email belongs to an AppForge account, a password-reset link has been sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to request a password reset.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-forge-mesh px-4 py-12">
      <div className="mx-auto max-w-md">
        <h1 className="forge-h2 text-forge-text-primary mb-2">Reset your password</h1>
        <p className="text-forge-text-muted mb-8">
          Enter your sign-in email and AppForge will send a secure reset link.
        </p>
        <GlassCard hover={false} padding="lg">
          <form onSubmit={submit} className="space-y-5">
            <Input id="forgot-email" label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            {message && <p className="text-sm text-forge-text-muted" role="status">{message}</p>}
            <Button type="submit" className="w-full" loading={pending} disabled={pending || !email.trim()}>
              Send reset link
            </Button>
          </form>
          <Link to="/login" className="mt-5 inline-block text-sm text-forge-cyan hover:underline">
            Back to sign in
          </Link>
        </GlassCard>
      </div>
    </div>
  );
}
