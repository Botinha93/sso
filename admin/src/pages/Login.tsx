import React, { useEffect, useState } from "react";
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

interface CachedAccount {
  email: string;
  username: string;
  givenName?: string;
  familyName?: string;
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
  const [cachedAccount, setCachedAccount] = useState<CachedAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const accountSelection = new URLSearchParams(window.location.search).get("account_selection") === "1";

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

  useEffect(() => {
    if (!accountSelection) return;
    void (async () => {
      setAccountLoading(true);
      try {
        const response = await fetch("/api/admin/me", { credentials: "include" });
        if (!response.ok) return;
        const account = await response.json() as CachedAccount;
        if (account.email && account.username) setCachedAccount(account);
      } finally {
        setAccountLoading(false);
      }
    })();
  }, [accountSelection]);

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
    // Only same-origin paths: reject protocol-relative ("//host") and
    // backslash variants the browser would treat as an external origin.
    if (explicit && /^\/(?![\/\\])/.test(explicit) && !explicit.includes("\\")) {
      return explicit;
    }
    if (params.get("client_id") && params.get("redirect_uri") && params.get("response_type")) {
      // Credentials were just collected, so the login interaction is complete.
      // Preserve an account-choice completion marker when this login followed
      // the account picker; otherwise /oauth/authorize would send us back to
      // the picker (or the prompt=login screen) in a loop.
      if (params.get("account_selection") === "1") {
        params.set("account_selection", "continue");
      }
      if (params.get("prompt") === "login") {
        params.delete("prompt");
      }
      return `/oauth/authorize?${params.toString()}`;
    }
    return "/";
  };

  const continueWithCachedAccount = () => {
    const params = new URLSearchParams(window.location.search);
    params.set("account_selection", "continue");
    window.location.href = `/oauth/authorize?${params.toString()}`;
  };

  const useAnotherAccount = async () => {
    setSwitchingAccount(true);
    setError(null);
    try {
      const csrfResponse = await fetch("/api/csrf-token", { credentials: "include" });
      const { csrf_token: csrfToken } = await csrfResponse.json() as { csrf_token?: string };
      const response = await fetch("/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {}
      });
      if (!response.ok) throw new Error("logout_failed");

      // Preserve the original authorization request, but force credentials so
      // the old SSO cookie can never silently select the previous account.
      const params = new URLSearchParams(window.location.search);
      params.delete("account_selection");
      params.set("prompt", "login");
      window.location.href = `/login?${params.toString()}`;
    } catch {
      setError(t('login.accountSwitchFailed'));
      setSwitchingAccount(false);
    }
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
              : resolveLoginCredentialError(json, t('login.invalidCredentials'), t)
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

          {accountSelection && (accountLoading || cachedAccount) ? (
            <div className="space-y-4">
              {accountLoading ? (
                <div className="auth-skeleton h-24 w-full rounded-xl" aria-label="Loading saved account" />
              ) : (
                <>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">{t('login.chooseAccount')}</h2>
                    <p className="mt-1 text-sm text-slate-500">{t('login.chooseAccountDescription')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={continueWithCachedAccount}
                    className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <span className="block font-medium text-slate-900">{cachedAccount!.givenName || cachedAccount!.familyName ? `${cachedAccount!.givenName ?? ""} ${cachedAccount!.familyName ?? ""}`.trim() : cachedAccount!.username}</span>
                    <span className="block text-sm text-slate-500">{cachedAccount!.email}</span>
                  </button>
                  <Button type="button" variant="secondary" className="w-full" disabled={switchingAccount} onClick={() => void useAnotherAccount()}>
                    {switchingAccount ? t('login.switchingAccount') : t('login.useAnotherAccount')}
                  </Button>
                </>
              )}
              {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
            </div>
          ) : (
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
          )}

          {!accountSelection && (providersLoading ? (
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
          ))}
        </div>
      </Card>
      </div>
      )}
    </div>
  );
}
