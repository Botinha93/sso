import React, { useState } from "react";
import { ShieldCheck, AlertCircle } from "lucide-react";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Card from "../components/ui/Card";
import LanguageSelector from "../components/LanguageSelector";
import { useI18n } from "../i18n";
import { extractErrorMessage, resolveLoginCredentialError } from "../lib/errors";

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

function LoginLoadingSkeleton() {
  return (
    <Card className="w-full max-w-md overflow-hidden rounded-2xl" aria-hidden>
      <div className="space-y-0">
        <div className="px-8 py-7" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="auth-skeleton h-9 w-9 rounded-xl" />
            <div className="space-y-2">
              <div className="auth-skeleton h-4 w-28" />
              <div className="auth-skeleton h-3 w-40" />
            </div>
          </div>
        </div>
        <div className="space-y-4 px-8 py-7">
          <div className="auth-skeleton h-16 w-full" />
          <div className="space-y-2">
            <div className="auth-skeleton h-3 w-24" />
            <div className="auth-skeleton h-9 w-full" />
          </div>
          <div className="space-y-2">
            <div className="auth-skeleton h-3 w-16" />
            <div className="auth-skeleton h-9 w-full" />
          </div>
          <div className="auth-skeleton h-9 w-full" />
          <div className="space-y-2 pt-1">
            <div className="auth-skeleton h-3 w-28" />
            <div className="auth-skeleton h-9 w-full" />
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function Login() {
  const { t } = useI18n();
  const [email, setEmail] = useState(() => new URLSearchParams(window.location.search).get('identifier') ?? "");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaTicket, setMfaTicket] = useState<string | null>(null);
  const [changePasswordTicket, setChangePasswordTicket] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<FederationProvider[]>([]);
  const [ui, setUi] = useState<UiCustomization | null>(null);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [uiLoading, setUiLoading] = useState(true);

  React.useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/auth/federation/providers", { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json() as FederationProvider[];
        setProviders(Array.isArray(json) ? json : []);
      } catch {
        // Federation providers are optional.
      } finally {
        setProvidersLoading(false)
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
      } finally {
        setUiLoading(false)
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

  const storePasswordExpirationWarning = (json: Record<string, unknown>) => {
    const warning = json.passwordExpirationWarning;
    const daysRemaining = warning && typeof warning === "object"
      ? (warning as { daysRemaining?: unknown }).daysRemaining
      : undefined;
    if (typeof daysRemaining === "number" && Number.isFinite(daysRemaining)) {
      sessionStorage.setItem("passwordExpirationWarning", String(daysRemaining));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfoMessage(null);
    try {
      const endpoint = changePasswordTicket
        ? "/auth/login/change-password"
        : mfaTicket
          ? "/auth/login/mfa"
          : "/auth/login";
      const payload = changePasswordTicket
        ? { changePasswordTicket, newPassword, confirmPassword }
        : mfaTicket
          ? { mfaTicket, code: mfaCode.trim() }
          : { email: email.trim(), password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.status === 202) {
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        if (typeof json.changePasswordTicket === "string") {
          setChangePasswordTicket(json.changePasswordTicket);
          setMfaTicket(null);
          setNewPassword("");
          setConfirmPassword("");
          setInfoMessage(typeof json.message === "string" ? json.message : t('login.passwordExpired'));
          setError(null);
        } else if (typeof json.mfaTicket === "string") {
          setMfaTicket(json.mfaTicket);
          setChangePasswordTicket(null);
          setMfaCode("");
          setInfoMessage(null);
          setError(null);
        } else {
          setError(extractErrorMessage(json, t('login.additionalVerificationRequired')));
        }
      } else if (res.ok) {
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        storePasswordExpirationWarning(json);
        window.location.href = buildRedirectAfterLogin();
      } else {
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        setError(
          changePasswordTicket
            ? extractErrorMessage(json, t('login.passwordUpdateFailed'))
            : mfaTicket
              ? extractErrorMessage(json, t('login.invalidMfaCode'))
              : resolveLoginCredentialError(json, t('login.invalidCredentials'))
        );
      }
    } catch {
      setError(t('login.networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-w-screen min-h-screen flex items-center justify-center p-4 font-sans"
      style={{
        background: ui?.backgroundCss ?? 'var(--semantic-bg-page)'
      }}
    >
      {uiLoading ? (
        <LoginLoadingSkeleton />
      ) : (
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-end">
          <LanguageSelector />
        </div>
      <Card className="overflow-hidden rounded-2xl">
        {/* Dark header */}
        <div className="px-8 py-7" style={{ background: `linear-gradient(180deg, ${ui?.primaryColor ?? '#020617'} 0%, ${ui?.accentColor ?? '#0f172a'} 100%)` }}>
          <div className="flex items-center gap-3 mb-2">
            <img src={ui?.logoUrl ?? "/logo.svg"} alt="NexusID" className="h-9 w-9 rounded-xl ring-1 ring-sky-400/30" />
            <div className="text-xl font-semibold text-slate-50 tracking-tight">{ui?.title ?? t('login.brandFallback')}</div>
          </div>
          <p className="text-slate-400 text-sm">
            {ui?.subtitle ?? t('login.subtitle')}
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-7 space-y-5">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('login.securityBanner')}</span>
            </div>
          </div>

          {infoMessage && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{infoMessage}</span>
              </div>
            </div>
          )}

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
                {changePasswordTicket ? t('login.newPassword') : mfaTicket ? t('login.authenticatorCode') : t('login.usernameOrEmail')}
              </label>
              {changePasswordTicket ? (
                <Input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  autoFocus
                  placeholder="••••••••"
                />
              ) : mfaTicket ? (
                <input
                  type="text"
                  inputMode="numeric"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D+/g, '').slice(0, 8))}
                  required
                  autoFocus
                  className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm tracking-[0.2em] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 focus-visible:ring-sky-500/40"
                  placeholder={t('login.mfaPlaceholder')}
                />
              ) : (
                <Input
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder={t('login.emailPlaceholder')}
                />
              )}
            </div>
            {changePasswordTicket && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{t('login.confirmNewPassword')}</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>
            )}
            {!mfaTicket && !changePasswordTicket && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{t('login.password')}</label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>
            )}
            <Button
              type="submit"
              disabled={loading}
              variant="primary"
              className="w-full"
            >
              {loading
                ? t('login.signingIn')
                : changePasswordTicket
                  ? t('login.updatePassword')
                  : mfaTicket
                    ? t('login.verifyCode')
                    : t('login.signIn')}
            </Button>
            {(mfaTicket || changePasswordTicket) && (
              <Button
                type="button"
                onClick={() => {
                  setMfaTicket(null)
                  setChangePasswordTicket(null)
                  setMfaCode('')
                  setNewPassword('')
                  setConfirmPassword('')
                  setInfoMessage(null)
                  setError(null)
                }}
                variant="secondary"
                className="w-full"
              >
                {t('login.back')}
              </Button>
            )}
          </form>

          {providersLoading ? (
            <div className="space-y-2 pt-1" aria-hidden>
              <div className="auth-skeleton h-3 w-28" />
              <div className="auth-skeleton h-9 w-full" />
            </div>
          ) : providers.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('login.orContinueWith')}</p>
              <div className="space-y-2">
                {providers.map((provider) => (
                  <a
                    key={provider.id}
                    href={`/auth/federation/${provider.id}/start?redirect=${encodeURIComponent(buildRedirectAfterLogin())}`}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 inline-flex items-center justify-center focus-visible:ring-sky-500/40"
                  >
                    {provider.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
      </div>
      )}
    </div>
  );
}
