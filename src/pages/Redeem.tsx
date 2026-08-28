import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";
import { getAccessToken } from "../lib/auth.js";

export function Redeem() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  const { data: user, isFetched } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
  });

  const requestOtp = useMutation({
    mutationFn: () =>
      trpc.admin.requestRedeemOtp.mutate({
        code: code.trim(),
        phone: phone.trim(),
      }),
    onSuccess: () => {
      setOtpSent(true);
      setMessage("SMS code sent. Enter it below to complete redemption.");
    },
    onError: (err) => {
      setMessage(
        err instanceof Error ? err.message : "Could not send SMS code.",
      );
    },
  });

  const redeem = useMutation({
    mutationFn: () =>
      trpc.admin.redeemCode.mutate({
        code: code.trim(),
        phone: phone.trim() || undefined,
        otp: otp.trim() || undefined,
      }),
    onSuccess: (data) => {
      setMessage(
        data.unlimited
          ? "Lifetime access applied. Your credits are unlimited."
          : `Added ${data.credits} credits to your account.`,
      );
      setCode("");
      setOtp("");
      setOtpSent(false);
      queryClient.invalidateQueries({ queryKey: ["projects", "tierStatus"] });
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
    onError: (err) => {
      const text = err instanceof Error ? err.message : String(err);
      if (/unauth|not authenticated/i.test(text)) {
        navigate("/login?next=/redeem");
        return;
      }
      setMessage(text || "Unable to redeem that code.");
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!code.trim()) return;
    if (!getAccessToken() || !user) {
      navigate("/login?next=/redeem");
      return;
    }
    redeem.mutate();
  };

  const handleRequestOtp = () => {
    setMessage(null);
    if (!code.trim() || !phone.trim()) {
      setMessage("Enter your code and phone number to receive an SMS.");
      return;
    }
    requestOtp.mutate();
  };

  if (isFetched && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Redeem a code
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            Sign in to redeem a code on your account.
          </p>
          <Link
            to="/login?next=/redeem"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-md mx-auto px-4 py-20">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 text-center">
          Redeem a code
        </h1>
        <p className="text-slate-600 dark:text-slate-300 mb-8 text-center">
          Enter your one-time code. When SMS is enabled on this server, verify
          your phone before redeeming.
        </p>
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="redeem-code"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2"
              >
                Code
              </label>
              <input
                id="redeem-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
                className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div>
              <label
                htmlFor="redeem-phone"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2"
              >
                Phone (for SMS verification)
              </label>
              <input
                id="redeem-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1234567890"
                className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={requestOtp.isPending || !code.trim() || !phone.trim()}
                className="mt-2 text-sm text-blue-600 hover:underline disabled:text-slate-400"
              >
                {requestOtp.isPending ? "Sending…" : "Send SMS code"}
              </button>
            </div>
            {otpSent && (
              <div>
                <label
                  htmlFor="redeem-otp"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2"
                >
                  SMS code
                </label>
                <input
                  id="redeem-otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            )}
            {message && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {message}
              </p>
            )}
            <button
              type="submit"
              disabled={redeem.isPending || !code.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-3 px-6 rounded-lg"
            >
              {redeem.isPending ? "Redeeming…" : "Redeem"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
