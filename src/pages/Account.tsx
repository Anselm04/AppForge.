import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAccessToken, ensureFreshSession } from "../lib/auth.js";
import { supabaseClient } from "../lib/supabase-client.js";
import { trpc } from "../utils/trpc.js";
import { Button } from "../design-system/Button.js";
import { GlassCard } from "../design-system/GlassCard.js";
import { Input } from "../design-system/Input.js";

export function Account() {
  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 0,
  });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
    setPending(true);
    try {
      await ensureFreshSession();
      const token = getAccessToken();
      if (!token) {
        throw new Error(
          "Your secure session needs to be renewed. Use Forgot password to set a new password.",
        );
      }
      await supabaseClient.updatePassword(token, password);
      setPassword("");
      setConfirm("");
      setMessage("Password changed successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to change password.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-forge-mesh px-4 py-12">
      <div className="mx-auto max-w-lg">
        <h1 className="forge-h2 text-forge-text-primary mb-2">Account</h1>
        <p className="text-forge-text-muted mb-8">
          Signed in as {me?.email ?? "your AppForge account"}.
        </p>
        <GlassCard hover={false} padding="lg">
          <h2 className="text-xl font-semibold text-forge-text-primary mb-4">
            Change password
          </h2>
          <form onSubmit={submit} className="space-y-4">
            <Input id="account-new-password" label="New password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
            <Input id="account-confirm-password" label="Confirm new password" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
            {message && <p className="text-sm text-forge-text-muted" role="status">{message}</p>}
            <Button type="submit" className="w-full" loading={pending} disabled={pending || password.length < 8 || confirm.length < 8}>
              Change password
            </Button>
          </form>
          <a href="/forgot-password" className="mt-5 inline-block text-sm text-forge-cyan hover:underline">
            Forgot your password? Send a reset email
          </a>
        </GlassCard>
      </div>
    </div>
  );
}
