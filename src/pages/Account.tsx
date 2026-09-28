import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ensureFreshSession,
  getAccessToken,
  signOutAllDevices,
  signOutOtherDevices,
} from "../lib/auth.js";
import { supabaseClient } from "../lib/supabase-client.js";
import { trpc } from "../utils/trpc.js";
import { Button } from "../design-system/Button.js";
import { GlassCard } from "../design-system/GlassCard.js";
import { Input } from "../design-system/Input.js";

export function Account() {
  const navigate = useNavigate();
  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 0,
  });
  const { data: diagnostics } = useQuery({
    queryKey: ["system", "diagnostics"],
    queryFn: () => trpc.system.diagnostics.query(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [sessionAction, setSessionAction] = useState<
    "others" | "global" | null
  >(null);

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

  const revokeOtherDevices = async () => {
    setSessionMessage(null);
    setSessionAction("others");
    try {
      await signOutOtherDevices();
      setSessionMessage(
        "Other AppForge sessions have been signed out. This device remains signed in.",
      );
    } catch (error) {
      setSessionMessage(
        error instanceof Error
          ? error.message
          : "Unable to sign out other devices.",
      );
    } finally {
      setSessionAction(null);
    }
  };

  const revokeAllDevices = async () => {
    setSessionMessage(null);
    setSessionAction("global");
    try {
      await signOutAllDevices();
      navigate("/login", { replace: true });
    } catch (error) {
      setSessionMessage(
        error instanceof Error
          ? error.message
          : "Unable to sign out all devices.",
      );
      setSessionAction(null);
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
            <Input
              id="account-new-password"
              label="New password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Input
              id="account-confirm-password"
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
            {message && (
              <p className="text-sm text-forge-text-muted" role="status">
                {message}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              loading={pending}
              disabled={pending || password.length < 8 || confirm.length < 8}
            >
              Change password
            </Button>
          </form>
          <a
            href="/forgot-password"
            className="mt-5 inline-block text-sm text-forge-cyan hover:underline"
          >
            Forgot your password? Send a reset email
          </a>
        </GlassCard>

        <div className="mt-6">
          <GlassCard hover={false} padding="lg">
            <h2 className="text-xl font-semibold text-forge-text-primary mb-2">
              System diagnostics
            </h2>
            <p className="text-sm text-forge-text-muted mb-4">
              Live AppForge service status for troubleshooting.
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-forge-text-muted">Status</span>
                <div className="font-semibold capitalize">
                  {diagnostics?.status ?? "checking"}
                </div>
              </div>
              <div>
                <span className="text-forge-text-muted">Startup</span>
                <div className="font-semibold">
                  {diagnostics?.startup ?? "checking"}
                </div>
              </div>
              <div>
                <span className="text-forge-text-muted">Uptime</span>
                <div className="font-semibold">
                  {diagnostics
                    ? `${Math.floor(diagnostics.uptimeSeconds / 60)} min`
                    : "—"}
                </div>
              </div>
              <div>
                <span className="text-forge-text-muted">Memory</span>
                <div className="font-semibold">
                  {diagnostics
                    ? `${Math.round(diagnostics.process.rssBytes / 1024 / 1024)} MB`
                    : "—"}
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="mt-6">
          <GlassCard hover={false} padding="lg">
            <h2 className="text-xl font-semibold text-forge-text-primary mb-2">
              Sessions
            </h2>
            <p className="text-sm text-forge-text-muted mb-5">
              End sessions on devices you no longer use. Signing out all devices
              also signs out this browser.
            </p>
            <div className="space-y-3">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                loading={sessionAction === "others"}
                disabled={sessionAction !== null}
                onClick={() => void revokeOtherDevices()}
              >
                Sign out other devices
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                loading={sessionAction === "global"}
                disabled={sessionAction !== null}
                onClick={() => void revokeAllDevices()}
              >
                Sign out all devices
              </Button>
            </div>
            {sessionMessage && (
              <p className="mt-4 text-sm text-forge-text-muted" role="status">
                {sessionMessage}
              </p>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
