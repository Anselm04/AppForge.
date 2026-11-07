import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthShell } from "../components/auth/AuthShell.js";
import { Button } from "../design-system/Button.js";
import { Input } from "../design-system/Input.js";
import {
  loginPathWithReturn,
  normalizePhone,
  safeAuthDestination,
} from "../lib/auth.js";
import { trpc } from "../utils/trpc.js";

export function VerifyPhone() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const next = useMemo(
    () => safeAuthDestination(searchParams.get("next"), "/dashboard"),
    [searchParams],
  );
  const [phone, setPhone] = useState("");
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  const { data: me, isFetched } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
    retry: false,
    staleTime: 0,
  });

  const requestCode = useMutation({
    mutationFn: (value?: string) =>
      trpc.auth.requestPhoneVerification.mutate(
        value ? { phone: normalizePhone(value) } : undefined,
      ),
    onSuccess: async (result) => {
      setError(null);
      if (result.alreadyVerified) {
        await queryClient.invalidateQueries({ queryKey: ["auth"] });
        navigate(next, { replace: true });
        return;
      }
      setMaskedPhone(result.maskedPhone ?? null);
      setCodeSent(true);
      setEditingPhone(false);
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
    onError: (err) => {
      // Automatic delivery is attempted once. Resetting this ref on failure
      // creates a render/retry loop that repeatedly sends or rate-limits SMS.
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send the SMS verification code.",
      );
    },
  });

  const verifyCode = useMutation({
    mutationFn: (value: string) =>
      trpc.auth.verifyPhone.mutate({ code: value }),
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
      navigate(
        loginPathWithReturn(`/verify-phone?next=${encodeURIComponent(next)}`),
        {
          replace: true,
        },
      );
      return;
    }
    if (me.phoneVerified) {
      navigate(next, { replace: true });
      return;
    }
    if (me.phone && !requested.current && !codeSent && !editingPhone) {
      requested.current = true;
      requestCode.mutate(undefined);
    }
  }, [codeSent, editingPhone, isFetched, me, navigate, next, requestCode]);

  const requestForEnteredPhone = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    let normalized: string;
    try {
      normalized = normalizePhone(phone);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Enter a valid mobile number in international format.",
      );
      return;
    }
    requested.current = true;
    requestCode.mutate(normalized);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const normalized = code.trim();
    if (!/^\d{4,10}$/.test(normalized)) {
      setError("Enter the 4–10 digit SMS verification code.");
      return;
    }
    verifyCode.mutate(normalized);
  };

  const destination = maskedPhone ?? me?.maskedPhone ?? "your mobile number";

  return (
    <AuthShell
      title="Verify your mobile number"
      subtitle={
        codeSent && !editingPhone
          ? `Enter the code sent to ${destination}. This phone is linked to the same AppForge account as your email.`
          : "Add your mobile number to this AppForge account. We will send an SMS verification code before giving access to the app."
      }
    >
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-200"
        >
          {error}
        </p>
      )}

      {editingPhone || (!me?.phone && !codeSent) ? (
        <form onSubmit={requestForEnteredPhone} className="space-y-5">
          <Input
            id="phone-enrollment-number"
            label="Mobile number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+6421…"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
          <p className="text-xs text-forge-text-muted">
            Use international format including the country code. For New
            Zealand, use +64 and omit the first 0 of the mobile number.
          </p>
          <Button
            type="submit"
            className="w-full"
            loading={requestCode.isPending}
            disabled={requestCode.isPending || !phone.trim()}
          >
            Send SMS verification code
          </Button>
        </form>
      ) : (
        <>
          <form onSubmit={submit} className="space-y-5">
            <Input
              id="phone-verification-code"
              label="SMS verification code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 10))
              }
              required
            />
            <Button
              type="submit"
              className="w-full"
              loading={verifyCode.isPending}
              disabled={verifyCode.isPending || !/^\d{4,10}$/.test(code)}
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
            onClick={() => {
              requested.current = true;
              requestCode.mutate(undefined);
            }}
          >
            Send a new code
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="mt-3 w-full"
            disabled={requestCode.isPending || verifyCode.isPending}
            onClick={() => {
              setPhone(me?.phone ?? "");
              setCode("");
              setError(null);
              setEditingPhone(true);
            }}
          >
            Use a different mobile number
          </Button>
        </>
      )}
    </AuthShell>
  );
}
