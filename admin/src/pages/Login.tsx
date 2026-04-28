import React, { useState } from "react";
import { ShieldCheck, AlertCircle } from "lucide-react";

interface FederationProvider {
  id: string;
  label: string;
}

interface UiCustomization {
  title?: string;
  subtitle?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  backgroundCss?: string;
}

export default function Login() {
  const [email, setEmail] = useState(() => new URLSearchParams(window.location.search).get('identifier') ?? "");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaTicket, setMfaTicket] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<FederationProvider[]>([]);
  const [ui, setUi] = useState<UiCustomization | null>(null);

  React.useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/auth/federation/providers", { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json() as FederationProvider[];
        setProviders(Array.isArray(json) ? json : []);
      } catch {
        // Federation providers are optional.
      }
    })();
  }, []);

  React.useEffect(() => {
    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const clientId = params.get("client_id");
        const query = new URLSearchParams({ surface: "admin_login" });
        if (clientId) query.set("clientId", clientId);
        const res = await fetch(`/api/ui/customization?${query.toString()}`, { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        setUi(json?.customization ?? null);
      } catch {
        // Customization is optional.
      }
    })();
  }, []);

  const buildRedirectAfterLogin = () => {
    const params = new URLSearchParams(window.location.search);
    const explicit = params.get("redirect");
    if (explicit?.startsWith("/")) {
      return explicit;
    }
    if (params.get("client_id") && params.get("redirect_uri") && params.get("response_type")) {
      return `/oauth/authorize?${params.toString()}`;
    }
    return "/";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const endpoint = mfaTicket ? "/auth/login/mfa" : "/auth/login";
      const payload = mfaTicket
        ? { mfaTicket, code: mfaCode.trim() }
        : { email: email.trim(), password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        window.location.href = buildRedirectAfterLogin();
      } else if (res.status === 202 && !mfaTicket) {
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        if (typeof json.mfaTicket === "string") {
          setMfaTicket(json.mfaTicket);
          setMfaCode("");
          setError(null);
        } else {
          setError("MFA challenge failed to initialize.");
        }
      } else {
        setError(mfaTicket ? "Invalid one-time code" : "Invalid email or password");
      }
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-w-screen min-h-screen flex items-center justify-center p-4 font-sans"
      style={{
        background: ui?.backgroundCss ?? 'radial-gradient(circle at top left, rgba(14,165,233,0.14), transparent 28%),linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)'
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Dark header */}
        <div className="px-8 py-7" style={{ background: `linear-gradient(180deg, ${ui?.primaryColor ?? '#020617'} 0%, ${ui?.accentColor ?? '#0f172a'} 100%)` }}>
          <div className="flex items-center gap-3 mb-2">
            <img src={ui?.logoUrl ?? "/logo.svg"} alt="NexusID" className="h-9 w-9 rounded-xl ring-1 ring-sky-400/30" />
            <div className="text-xl font-semibold text-slate-50 tracking-tight">{ui?.title ?? 'NexusID'}</div>
          </div>
          <p className="text-slate-400 text-sm">
            {ui?.subtitle ?? 'Sign in to the identity administration workspace.'}
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-7 space-y-5">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Your session is managed via a secure httpOnly cookie. Credentials are never stored in the browser.</span>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                {mfaTicket ? "Authenticator code" : "Email or Username"}
              </label>
              {mfaTicket ? (
                <input
                  type="text"
                  inputMode="numeric"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D+/g, '').slice(0, 8))}
                  required
                  autoFocus
                  className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm tracking-[0.2em] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                  placeholder="123456"
                />
              ) : (
                <input
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                  placeholder="admin@example.com or admin"
                />
              )}
            </div>
            {!mfaTicket && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                  placeholder="••••••••"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="h-9 w-full rounded-lg bg-sky-600 text-sm font-medium text-white transition-all hover:bg-sky-500 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Signing in…" : mfaTicket ? "Verify code" : "Sign in"}
            </button>
            {mfaTicket && (
              <button
                type="button"
                onClick={() => {
                  setMfaTicket(null)
                  setMfaCode('')
                  setError(null)
                }}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Back
              </button>
            )}
          </form>

          {providers.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Or continue with</p>
              <div className="space-y-2">
                {providers.map((provider) => (
                  <a
                    key={provider.id}
                    href={`/auth/federation/${provider.id}/start?redirect=${encodeURIComponent(buildRedirectAfterLogin())}`}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 inline-flex items-center justify-center"
                  >
                    {provider.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
