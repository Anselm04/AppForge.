import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getSession, updatePassword } from "../lib/auth.js";
import { LogoLockup } from "../components/brand/LogoMark.js";
import { Button } from "../design-system/Button.js";
import { GlassCard } from "../design-system/GlassCard.js";
import { Input } from "../design-system/Input.js";

export function SetPassword() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const session = getSession();
  if (!session?.accessToken) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
        <GlassCard className="p-8">
          <LogoLockup className="mb-6 justify-center" />
          <h1 className="mb-2 text-center text-xl font-semibold">
            Set a new password
          </h1>
          <p className="mb-6 text-center text-sm text-white/60">
            Open the reset link from your email again, then choose a password
            here.
          </p>
          <Link
            to="/login"
            className="block text-center text-sm text-violet-300 underline"
          >
            Back to log in
          </Link>
        </GlassCard>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      await updatePassword(password);
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update password.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <GlassCard className="p-8">
        <LogoLockup className="mb-6 justify-center" />
        <h1 className="mb-2 text-center text-xl font-semibold">
          Choose a new password
        </h1>
        <p className="mb-6 text-center text-sm text-white/60">
          This lets you sign in with email on any device.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {error ? (
            <p className="text-sm text-rose-400" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Save password"}
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}
