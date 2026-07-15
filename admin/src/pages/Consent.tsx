import Card from '../components/ui/Card'
import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ShieldCheck, AlertCircle, KeyRound } from "lucide-react";
import Button from '../components/ui/Button'

import { SCOPE_CONSENT_LABELS } from '../constants/oidc-scopes'

interface UiCustomization {
  title?: string;
  subtitle?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  backgroundCss?: string;
}

export default function Consent() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ui, setUi] = useState<UiCustomization | null>(null);

  const clientId = searchParams.get("client_id") || "Unknown App";
  const scope = searchParams.get("scope") || "openid";
  const scopes = scope.split(" ").filter(Boolean);
  const redirectUri = searchParams.get("redirect_uri") || "/";
  const state = searchParams.get("state");
  const responseType = searchParams.get("response_type");
  const responseMode = searchParams.get("response_mode") || (responseType === "token" ? "fragment" : "query");

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

  const handleApprove = () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams(searchParams.toString());
    params.set("consent", "approve");
    window.location.href = `/oauth/authorize?${params.toString()}`;
  };

  const handleDeny = () => {
    const params = new URLSearchParams();
    params.set("error", "access_denied");
    if (state) params.set("state", state);

    if (responseMode === "fragment") {
      const url = new URL(redirectUri);
      url.hash = params.toString();
      window.location.href = url.toString();
      return;
    }

    if (responseMode === "form_post") {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = redirectUri;

      Array.from(params.entries()).forEach(([key, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
      return;
    }

    const url = new URL(redirectUri);
    Array.from(params.entries()).forEach(([key, value]) => url.searchParams.set(key, value));
    window.location.href = url.toString();
  };

  return (
    <div
      className="min-w-screen min-h-screen flex items-center justify-center p-4 font-sans"
      style={{
        background: ui?.backgroundCss ?? 'radial-gradient(circle at top left, rgba(14,165,233,0.14), transparent 28%),linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)'
      }}
    >
      <Card className="w-full max-w-md overflow-hidden">
        {/* Dark header */}
        <div className="px-8 py-7" style={{ background: `linear-gradient(180deg, ${ui?.primaryColor ?? '#020617'} 0%, ${ui?.accentColor ?? '#0f172a'} 100%)` }}>
          <div className="flex items-center gap-3 mb-2">
            {ui?.logoUrl ? (
              <img src={ui.logoUrl} alt="Logo" className="h-9 w-9 rounded-xl ring-1 ring-sky-400/30" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 ring-1 ring-sky-400/30">
                <span className="text-xs font-extrabold tracking-widest text-sky-300">NS</span>
              </div>
            )}
            <div className="text-xl font-semibold text-slate-50 tracking-tight">{ui?.title ?? 'Authorization Request'}</div>
          </div>
          <p className="text-muted-foreground text-sm">
            {ui?.subtitle ?? (<><strong className="text-slate-200">{clientId}</strong> is requesting access to your account.</>)}
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-7 space-y-5">
          <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              <KeyRound size={12} />
              Requested permissions
            </div>
            {scopes.map(s => (
              <div key={s} className="flex items-start gap-2 text-sm text-foreground">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                <span>{SCOPE_CONSENT_LABELS[s] ?? s}</span>
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
              {loading ? "Approving…" : "Allow access"}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleDeny}
              disabled={loading}
            >
              Deny
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            You'll be redirected to <span className="font-mono text-muted-foreground">{redirectUri}</span>
          </p>
        </div>
      </Card>
    </div>
  );
}
