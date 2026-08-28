import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { trpc } from "../utils/trpc.js";
import { useSession } from "../lib/auth.js";

export function OrgSettings() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [orgName, setOrgName] = useState("");
  const [domain, setDomain] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [ssoProvider, setSsoProvider] = useState<"saml" | "oidc">("saml");
  const [metadataUrl, setMetadataUrl] = useState("");

  const { data: orgs } = useQuery({
    queryKey: ["orgs", "my"],
    queryFn: () => trpc.orgs.myOrgs.query(),
    enabled: !!session,
  });

  const createOrg = useMutation({
    mutationFn: () => trpc.orgs.create.mutate({ name: orgName }),
    onSuccess: () => {
      setOrgName("");
      void queryClient.invalidateQueries({ queryKey: ["orgs"] });
    },
  });

  const setDomainMut = useMutation({
    mutationFn: () =>
      trpc.orgs.setDomain.mutate({
        orgId: selectedOrgId!,
        domain,
      }),
    onSuccess: () => setDomain(""),
  });

  const configureSso = useMutation({
    mutationFn: () =>
      trpc.sso.configure.mutate({
        orgId: selectedOrgId!,
        provider: ssoProvider,
        metadataUrl: metadataUrl || undefined,
      }),
  });

  if (!session) {
    return (
      <div className="min-h-screen p-8 text-center">
        <p className="mb-4">Sign in to manage organization SSO.</p>
        <Link to="/login?next=/settings/org" className="text-blue-600">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
      <div className="max-w-2xl mx-auto">
        <Link to="/dashboard" className="text-sm text-blue-600">
          ← Dashboard
        </Link>
        <h1 className="text-3xl font-bold mt-4 mb-2 text-slate-900 dark:text-white">
          Organization & SSO
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          B2B teams — create an org, verify your domain, and enable SAML/OIDC
          for enterprise login.
        </p>

        <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow mb-6">
          <h2 className="font-semibold mb-3">Create organization</h2>
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded-lg px-3 py-2 dark:bg-slate-900 dark:border-slate-700"
              placeholder="Acme Engineering"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
            <button
              type="button"
              disabled={orgName.length < 2 || createOrg.isPending}
              onClick={() => createOrg.mutate()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow mb-6">
          <h2 className="font-semibold mb-3">Your organizations</h2>
          {(orgs ?? []).length === 0 && (
            <p className="text-slate-500 text-sm">No orgs yet.</p>
          )}
          <ul className="space-y-2">
            {(orgs ?? []).map(({ org, role }) => (
              <li key={org.id}>
                <button
                  type="button"
                  onClick={() => setSelectedOrgId(org.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border ${
                    selectedOrgId === org.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {org.name}{" "}
                  <span className="text-xs text-slate-500">({role})</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {selectedOrgId && (
          <>
            <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow mb-6">
              <h2 className="font-semibold mb-3">Verify domain</h2>
              <div className="flex gap-2">
                <input
                  className="flex-1 border rounded-lg px-3 py-2 dark:bg-slate-900 dark:border-slate-700"
                  placeholder="acme.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
                <button
                  type="button"
                  disabled={domain.length < 3 || setDomainMut.isPending}
                  onClick={() => setDomainMut.mutate()}
                  className="bg-slate-700 text-white px-4 py-2 rounded-lg"
                >
                  Add domain
                </button>
              </div>
              {setDomainMut.data?.verificationHint && (
                <p className="text-xs text-slate-500 mt-2">
                  DNS TXT: {setDomainMut.data.verificationHint}
                </p>
              )}
            </section>

            <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow">
              <h2 className="font-semibold mb-3">SSO configuration</h2>
              <div className="flex gap-2 mb-3">
                {(["saml", "oidc"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSsoProvider(p)}
                    className={`px-3 py-1.5 rounded text-sm uppercase ${
                      ssoProvider === p
                        ? "bg-blue-600 text-white"
                        : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <input
                className="w-full border rounded-lg px-3 py-2 mb-3 dark:bg-slate-900 dark:border-slate-700"
                placeholder="IdP metadata URL"
                value={metadataUrl}
                onChange={(e) => setMetadataUrl(e.target.value)}
              />
              <button
                type="button"
                disabled={configureSso.isPending}
                onClick={() => configureSso.mutate()}
                className="bg-green-600 text-white px-4 py-2 rounded-lg"
              >
                Enable SSO
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
