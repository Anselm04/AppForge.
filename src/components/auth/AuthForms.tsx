import { FormEvent, useState } from "react";
import {
  emailLogin,
  emailSignUp,
  sendPhoneOtp,
  verifyPhoneOtp,
  type AppForgeSession,
} from "../../lib/auth";

function authMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Authentication failed.";
}

type FormProps = {
  disabled?: boolean;
};

export function EmailSignupForm({ disabled = false }: FormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await emailSignUp(email.trim().toLowerCase(), password, "/account");
      setMessage("Check your email to confirm your AppForge account.");
    } catch (error) {
      setMessage(authMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <label>
        Email
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label>
        Confirm password
        <input
          type="password"
          name="confirm-password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </label>
      <button type="submit" disabled={disabled || busy}>
        {busy ? "Creating account…" : "Create account"}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}

export function EmailLoginForm({ disabled = false }: FormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      await emailLogin(email.trim().toLowerCase(), password);
      window.location.assign("/account");
    } catch (error) {
      setMessage(authMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <label>
        Email
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <button type="submit" disabled={disabled || busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      {message ? <p role="alert">{message}</p> : null}
    </form>
  );
}

type PhoneOtpRequestFormProps = FormProps & {
  onCodeSent: (phone: string) => void;
};

export function PhoneOtpRequestForm({
  onCodeSent,
  disabled = false,
}: PhoneOtpRequestFormProps) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const normalized = phone.trim().replace(/[\s()-]/g, "");
      await sendPhoneOtp(normalized);
      onCodeSent(normalized);
      setMessage("Verification code sent.");
    } catch (error) {
      setMessage(authMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <label>
        Mobile number
        <input
          type="tel"
          name="phone"
          autoComplete="tel"
          inputMode="tel"
          placeholder="+64221234567"
          required
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </label>
      <button type="submit" disabled={disabled || busy}>
        {busy ? "Sending…" : "Send SMS code"}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}

type PhoneOtpVerificationFormProps = FormProps & {
  phone: string;
  onAuthenticated?: (session: AppForgeSession | null) => void;
};

export function PhoneOtpVerificationForm({
  phone,
  onAuthenticated,
  disabled = false,
}: PhoneOtpVerificationFormProps) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const data = await verifyPhoneOtp(phone, code);
      const session: AppForgeSession | null = data.session
        ? {
            accessToken: data.session.access_token,
            user: {
              id: data.session.user.id,
              email: data.session.user.email ?? undefined,
              phone: data.session.user.phone ?? phone,
            },
          }
        : null;
      onAuthenticated?.(session);
      if (!onAuthenticated) window.location.assign("/account");
    } catch (error) {
      setMessage(authMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <p>Code sent to {phone}</p>
      <label>
        Verification code
        <input
          type="text"
          name="otp"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]*"
          minLength={6}
          maxLength={10}
          required
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
        />
      </label>
      <button type="submit" disabled={disabled || busy || code.length < 6}>
        {busy ? "Verifying…" : "Verify code"}
      </button>
      {message ? <p role="alert">{message}</p> : null}
    </form>
  );
}
