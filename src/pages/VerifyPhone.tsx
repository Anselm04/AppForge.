import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthShell } from "../components/auth/AuthShell.js";
import { Button } from "../design-system/Button.js";
import { Input } from "../design-system/Input.js";
import { loginPathWithReturn, safeAuthDestination } from "../lib/auth.js";
import { trpc } from "../utils/trpc.js";

export function VerifyPhone() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const next = useMemo(
    () => safeAuthDestination(searchParams.get("next"), "/dashboard"),
    [searchParams],
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  const { data: me, isFetched } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
    retry: false,
    staleTime: 0,
  });

  const requestCode = useMutation({
    mutationFn: () => trpc.auth.requestPhoneVerification.mutate(),
    onSuccess: () => setError(null),
    onError: (err) =>
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send the SMS verification code.",
      ),
  });

  const verifyCode = useMutation({
    mutationFn: (value: string) => trpc.auth.verifyPhone.mutate({ code: value }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      navigate(next, { replace: true });
    },
    onError: (err) =>
      setError(
        err instanceof Error
          ? err.message
          : "That verification code could not be confirmed.",
      ),
  });

  useEffect(() => {
    if (!isFetched) return;
    if (!me) {
      navigate(loginPathWithReturn(`/verify-phone?next=${encodeURIComponent(next)}`), {
        replace: true,
      });
      return;
    }
    if (me.phoneVerified) {
      navigate(next, { replace: true });
      return;
    }
    if (!me.phone) {
      setError("No mobile number is attached to this account.");
      return;
    }
    if (!requested.current) {
      requested.current = true;
      requestCode.mutate();
    }
  }, [isFetched, me, navigate, next, requestCode]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const normalized = code.trim();
    if (!/^\d{6}$/.test(normalized)) {
      setError("Enter the six-digit SMS verification code.");
      return;
    }
    verifyCode.mutate(normalized);
  };

  return (
    <AuthShell
      title="Verify your mobile number"
      subtitle={`We sent a six-digit code to ${me?.maskedPhone ?? "your mobile number"}. This confirms the phone belongs to the same AppForge account as your email.`}
    >
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-200"
        >
          {error}
        </p>
      )}

      <form onSubmit={submit} className="space-y-5">
        <Input
          id="phone-verification-code"
          label="Six-digit SMS code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          required
        />
        <Button
          type="submit"
          className="w-full"
          loading={verifyCode.isPending}
          disabled={verifyCode.isPending || code.length !== 6}
        >
          Verify mobile number
        </Button>
      </form>

      <Button
        type="button"
        variant="secondary"
        className="mt-3 w-full"
        loading={requestCode.isPending}
        disabled={requestCode.isPending}
        onClick={() => requestCode.mutate()}
      >
        Send a new code
      </Button>
    </AuthShell>
  );
}
