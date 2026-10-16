import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 0,
  });
  const { data: profile } = useQuery({
    queryKey: ["account", "profile"],
    queryFn: () => trpc.account.profile.query(),
    staleTime: 0,
  });
  const {
    data: diagnostics,
    isError: diagnosticsError,
    isLoading: diagnosticsLoading,
  } = useQuery({
    queryKey: ["system", "diagnostics"],
    queryFn: () => trpc.system.diagnostics.query(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");
  const [productComms, setProductComms] = useState(true);
  const [billingComms, setBillingComms] = useState(true);
  const [marketingComms, setMarketingComms] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profilePending, setProfilePending] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailPending, setEmailPending] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [sessionAction, setSessionAction] = useState<"others" | "global" | null>(null);
  const [exportPending, setExportPending] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePending, setDeletePending] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setLanguage(profile.preferences.language);
    setProductComms(profile.preferences.communications.product);
    setBillingComms(profile.preferences.communications.billing);
    setMarketingComms(profile.preferences.communications.marketing);
    setReducedMotion(profile.preferences.accessibility.reducedMotion);
    setHighContrast(profile.preferences.accessibility.highContrast);
  }, [profile]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setProfilePending(true);
    setProfileMessage(null);
    try {
      await trpc.account.updateProfile.mutate({
        name,
        preferences: {
          language,
          communications: {
            product: productComms,
            billing: billingComms,
            marketing: marketingComms,
          },
          accessibility: { reducedMotion, highContrast },
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["account", "profile"] });
      setProfileMessage("Account preferences saved.");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Unable to save account preferences.");
    } finally {
      setProfilePending(false);
    }
  };

  const changeEmail = async (event: FormEvent) => {
    event.preventDefault();
    setEmailPending(true);
    setEmailMessage(null);
    try {
      await ensureFreshSession();
      const token = getAccessToken();
      if (!token) throw new Error("Sign in again before changing your email address.");
      await supabaseClient.updateEmail(token, newEmail);
      setNewEmail("");
      setEmailMessage(
        "Email change requested. Complete the verification messages required by the identity provider before the new address becomes authoritative.",
      );
    } catch (error) {
      setEmailMessage(error instanceof Error ? error.message : "Unable to request email change.");
    } finally {
      setEmailPending(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (password.length < 8) return setMessage("Password must be at least 8 characters.");
    if (password !== confirm) return setMessage("Passwords do not match.");
    setPending(true);
    try {
      await ensureFreshSession();
      const token = getAccessToken();
      if (!token) throw new Error("Your secure session needs to be renewed. Use Forgot password to set a new password.");
      await supabaseClient.updatePassword(token, password);
      setPassword("");
      setConfirm("");
      setMessage("Password changed successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to change password.");
    } finally {
      setPending(false);
    }
  };

  const revokeOtherDevices = async () => {
    setSessionMessage(null);
    setSessionAction("others");
    try {
      await signOutOtherDevices();
      setSessionMessage("Other AppForge sessions have been signed out. This device remains signed in.");
    } catch (error) {
      setSessionMessage(error instanceof Error ? error.message : "Unable to sign out other devices.");
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
      setSessionMessage(error instanceof Error ? error.message : "Unable to sign out all devices.");
      setSessionAction(null);
    }
  };

  const exportAccount = async () => {
    setExportPending(true);
    setExportMessage(null);
    try {
      const data = await trpc.account.exportData.query();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `appforge-account-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(href);
      setExportMessage("Your customer data export was generated without provider secrets.");
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "Unable to export account data.");
    } finally {
      setExportPending(false);
    }
  };

  const deleteAccount = async () => {
    setDeletePending(true);
    setDeleteMessage(null);
    try {
      await ensureFreshSession();
      const token = getAccessToken();
      if (!token) throw new Error("Sign in again immediately before deleting your account.");
      await trpc.account.deleteAccount.mutate({
        confirmation: "DELETE MY APPFORGE ACCOUNT",
        accessToken: token,
      });
      await signOutAllDevices().catch(() => undefined);
      navigate("/login", { replace: true });
    } catch (error) {
      setDeleteMessage(error instanceof Error ? error.message : "Unable to delete account.");
      setDeletePending(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-forge-mesh px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="forge-h2 text-forge-text-primary mb-2">Account</h1>
          <p className="text-forge-text-muted">Signed in as {me?.email ?? "your AppForge account"}.</p>
        </header>

        <GlassCard hover={false} padding="lg">
          <h2 className="text-xl font-semibold text-forge-text-primary mb-4">Profile and preferences</h2>
          <form onSubmit={saveProfile} className="space-y-4">
            <Input id="account-name" label="Display name" value={name} onChange={(event) => setName(event.target.value)} maxLength={255} />
            <Input id="account-language" label="Language code" value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="en or mi-NZ" />
            <fieldset className="space-y-2">
              <legend className="font-medium">Communications</legend>
              <label className="block"><input type="checkbox" checked={productComms} onChange={(e) => setProductComms(e.target.checked)} /> Product and build updates</label>
              <label className="block"><input type="checkbox" checked={billingComms} onChange={(e) => setBillingComms(e.target.checked)} /> Billing and account notices</label>
              <label className="block"><input type="checkbox" checked={marketingComms} onChange={(e) => setMarketingComms(e.target.checked)} /> Marketing</label>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="font-medium">Accessibility</legend>
              <label className="block"><input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} /> Prefer reduced motion</label>
              <label className="block"><input type="checkbox" checked={highContrast} onChange={(e) => setHighContrast(e.target.checked)} /> Prefer high contrast</label>
            </fieldset>
            {profileMessage && <p role="status" className="text-sm text-forge-text-muted">{profileMessage}</p>}
            <Button type="submit" loading={profilePending} disabled={profilePending}>Save profile</Button>
          </form>
        </GlassCard>

        <GlassCard hover={false} padding="lg">
          <h2 className="text-xl font-semibold text-forge-text-primary mb-2">Change email</h2>
          <p className="text-sm text-forge-text-muted mb-4">Secure email change can require confirmation of both the current and new address. AppForge does not bypass that verification.</p>
          <form onSubmit={changeEmail} className="space-y-4">
            <Input id="account-new-email" label="New email" type="email" autoComplete="email" required value={newEmail} onChange={(event) => setNewEmail(event.target.value)} />
            {emailMessage && <p role="status" className="text-sm text-forge-text-muted">{emailMessage}</p>}
            <Button type="submit" loading={emailPending} disabled={emailPending || !newEmail}>Request verified email change</Button>
          </form>
        </GlassCard>

        <GlassCard hover={false} padding="lg">
          <h2 className="text-xl font-semibold text-forge-text-primary mb-4">Change password</h2>
          <form onSubmit={submit} className="space-y-4">
            <Input id="account-new-password" label="New password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
            <Input id="account-confirm-password" label="Confirm new password" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
            {message && <p className="text-sm text-forge-text-muted" role="status">{message}</p>}
            <Button type="submit" className="w-full" loading={pending} disabled={pending || password.length < 8 || confirm.length < 8}>Change password</Button>
          </form>
          <a href="/forgot-password" className="mt-5 inline-block text-sm text-forge-cyan hover:underline">Forgot your password? Send a reset email</a>
        </GlassCard>

        <GlassCard hover={false} padding="lg">
          <h2 className="text-xl font-semibold text-forge-text-primary mb-2">Sessions</h2>
          <p className="text-sm text-forge-text-muted mb-5">End sessions on devices you no longer use. Signing out all devices also signs out this browser.</p>
          <div className="space-y-3">
            <Button type="button" variant="secondary" className="w-full" loading={sessionAction === "others"} disabled={sessionAction !== null} onClick={() => void revokeOtherDevices()}>Sign out other devices</Button>
            <Button type="button" variant="secondary" className="w-full" loading={sessionAction === "global"} disabled={sessionAction !== null} onClick={() => void revokeAllDevices()}>Sign out all devices</Button>
          </div>
          {sessionMessage && <p className="mt-4 text-sm text-forge-text-muted" role="status">{sessionMessage}</p>}
        </GlassCard>

        <GlassCard hover={false} padding="lg">
          <h2 className="text-xl font-semibold text-forge-text-primary mb-2">Your data</h2>
          <p className="text-sm text-forge-text-muted mb-4">Export customer-owned account, project, build, artifact, billing-summary and connection metadata. Secret provider tokens are excluded.</p>
          <Button type="button" variant="secondary" loading={exportPending} disabled={exportPending} onClick={() => void exportAccount()}>Export my data</Button>
          {exportMessage && <p className="mt-3 text-sm text-forge-text-muted" role="status">{exportMessage}</p>}
        </GlassCard>

        <GlassCard hover={false} padding="lg">
          <h2 className="text-xl font-semibold text-forge-text-primary mb-2">System diagnostics</h2>
          <p className="text-sm text-forge-text-muted mb-4">Live AppForge service status for troubleshooting.</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-forge-text-muted">Status</span><div className="font-semibold capitalize">{diagnosticsError ? "unavailable" : (diagnostics?.status ?? (diagnosticsLoading ? "checking" : "unavailable"))}</div></div>
            <div><span className="text-forge-text-muted">Startup</span><div className="font-semibold">{diagnosticsError ? "unavailable" : (diagnostics?.startup ?? (diagnosticsLoading ? "checking" : "unavailable"))}</div></div>
            <div><span className="text-forge-text-muted">Uptime</span><div className="font-semibold">{diagnostics ? `${Math.floor(diagnostics.uptimeSeconds / 60)} min` : "—"}</div></div>
            <div><span className="text-forge-text-muted">Memory</span><div className="font-semibold">{diagnostics ? `${Math.round(diagnostics.process.rssBytes / 1024 / 1024)} MB` : "—"}</div></div>
          </div>
        </GlassCard>

        <GlassCard hover={false} padding="lg">
          <h2 className="text-xl font-semibold text-red-500 mb-2">Delete account</h2>
          <p className="text-sm text-forge-text-muted mb-4">This permanently removes customer projects and provider connections, stops pending work, cancels AppForge entitlements, revokes the identity account and anonymizes retained records. Minimum financial/audit records can remain where required for accounting, fraud, disputes or legal obligations.</p>
          <label htmlFor="delete-confirmation" className="block text-sm font-medium mb-2">Type DELETE MY APPFORGE ACCOUNT</label>
          <input id="delete-confirmation" className="forge-input w-full" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" />
          {deleteMessage && <p className="mt-3 text-sm text-red-500" role="alert">{deleteMessage}</p>}
          <Button type="button" className="mt-4 w-full" loading={deletePending} disabled={deletePending || deleteConfirmation !== "DELETE MY APPFORGE ACCOUNT"} onClick={() => void deleteAccount()}>Permanently delete my account</Button>
        </GlassCard>
      </div>
    </div>
  );
}
