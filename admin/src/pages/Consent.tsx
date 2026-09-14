import Card from '../components/ui/Card'
import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ShieldCheck, AlertCircle, KeyRound } from "lucide-react";
import Button from '../components/ui/Button'
import LanguageSelector from '../components/LanguageSelector'
import { consentScopeLabel, useI18n } from '../i18n'

interface UiCustomization {
  title?: string;
  subtitle?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  backgroundCss?: string;
}

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch('/api/csrf-token', { credentials: 'include' });
  if (!res.ok) {
    throw new Error('Could not obtain a CSRF token');
  }
  const data = await res.json() as { csrf_token: string };
  return data.csrf_token;
}

export default function Consent() {
  const { t } = useI18n()
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ui, setUi] = useState<UiCustomization | null>(null);

  const clientId = searchParams.get("client_id") || "Unknown App";
  const scope = searchParams.get("scope") || "openid";
  const scopes = scope.split(" ").filter(Boolean);
  const redirectUri = searchParams.get("redirect_uri") || "/";

  React.useEffect(() => {
    void (async () => {
      try {
        const query = new URLSearchParams({ surface: "consent" });
        if (clientId) query.set("clientId", clientId);
        const res = await fetch(`/api/ui/customization?${query.toString()}`, { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        setUi(json?.customization ?? null);
      } catch {
        // Optional customization.
      }
    })();
  }, [clientId]);

  // The decision is recorded server-side (session + CSRF token) and then the
  // browser returns to /oauth/authorize, which finds the stored consent. A
  // plain link can therefore never approve access on the user's behalf.
  const submitDecision = async (decision: "approve" | "deny") => {
    setLoading(true);
    setError(null);
    try {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch('/oauth/consent', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify({
          client_id: searchParams.get("client_id"),
          redirect_uri: searchParams.get("redirect_uri"),
          scope,
          decision
        })
      });

      if (res.status === 401) {
        const loginParams = new URLSearchParams(searchParams.toString());
        window.location.href = `/login?${loginParams.toString()}`;
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error_description?: string; message?: string };
        throw new Error(body.error_description ?? body.message ?? `Request failed (${res.status})`);
      }

      const params = new URLSearchParams(searchParams.toString());
      params.delete("consent");
      if (decision === "deny") {
        // The server validates redirect_uri against the client registration
        // before redirecting with error=access_denied.
        params.set("consent", "deny");
      }
      window.location.href = `/oauth/authorize?${params.toString()}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
      setLoading(false);
    }
  };

  const handleApprove = () => {
    void submitDecision("approve");
  };

  const handleDeny = () => {
    void submitDecision("deny");
  };

  return (
    <div
      className="min-w-screen min-h-screen flex items-center justify-center p-4 font-sans"
      style={{
        background: ui?.backgroundCss ?? 'radial-gradient(circle at top left, rgba(14,165,233,0.14), transparent 28%),linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)'
      }}
    >
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-end">
          <LanguageSelector />
        </div>
        <Card className="overflow-hidden">
          <div className="px-8 py-7" style={{ background: `linear-gradient(180deg, ${ui?.primaryColor ?? '#020617'} 0%, ${ui?.accentColor ?? '#0f172a'} 100%)` }}>
            <div className="flex items-center gap-3 mb-2">
              {ui?.logoUrl ? (
                <img src={ui.logoUrl} alt="Logo" className="h-9 w-9 rounded-xl ring-1 ring-sky-400/30" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 ring-1 ring-sky-400/30">
                  <span className="text-xs font-extrabold tracking-widest text-sky-300">NS</span>
                </div>
              )}
              <div className="text-xl font-semibold text-slate-50 tracking-tight">{ui?.title ?? t('consent.title')}</div>
            </div>
            <p className="text-muted-foreground text-sm">
              {ui?.subtitle ?? t('consent.subtitle', { clientId })}
            </p>
          </div>

          <div className="px-8 py-7 space-y-5">
            <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                <KeyRound size={12} />
                {t('consent.requestedPermissions')}
              </div>
              {scopes.map(s => (
                <div key={s} className="flex items-start gap-2 text-sm text-foreground">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                  <span>{consentScopeLabel(t, s)}</span>
                </div>
              ))}
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleApprove}
                disabled={loading}
              >
                {loading ? t('consent.approving') : t('consent.allowAccess')}
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={handleDeny}
                disabled={loading}
              >
                {t('consent.deny')}
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              {t('consent.redirectNotice', { redirectUri })}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
