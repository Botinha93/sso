import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ShieldCheck, AlertCircle, KeyRound } from "lucide-react";

const SCOPE_LABELS: Record<string, string> = {
  openid: "Verify your identity (OpenID Connect)",
  profile: "Access your name and username",
  email: "Access your email address",
  offline_access: "Stay signed in with refresh tokens",
  roles: "Read your assigned roles",
};

export default function Consent() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientId = searchParams.get("client_id") || "Unknown App";
  const scope = searchParams.get("scope") || "openid";
  const scopes = scope.split(" ").filter(Boolean);
  const redirectUri = searchParams.get("redirect_uri") || "/";
  const state = searchParams.get("state");
  const responseType = searchParams.get("response_type");
  const responseMode = searchParams.get("response_mode") || (responseType === "token" ? "fragment" : "query");

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
    <div className="min-w-screen min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] p-4 font-sans">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Dark header */}
        <div className="bg-[linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-8 py-7">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 ring-1 ring-sky-400/30">
              <span className="text-xs font-extrabold tracking-widest text-sky-300">NS</span>
            </div>
            <div className="text-xl font-semibold text-slate-50 tracking-tight">Authorization Request</div>
          </div>
          <p className="text-slate-400 text-sm">
            <strong className="text-slate-200">{clientId}</strong> is requesting access to your account.
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-7 space-y-5">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              <KeyRound size={12} />
              Requested permissions
            </div>
            {scopes.map(s => (
              <div key={s} className="flex items-start gap-2 text-sm text-slate-700">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                <span>{SCOPE_LABELS[s] ?? s}</span>
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
            <button
              onClick={handleApprove}
              disabled={loading}
              className="h-9 flex-1 rounded-lg bg-slate-900 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Approving…" : "Allow access"}
            </button>
            <button
              onClick={handleDeny}
              disabled={loading}
              className="h-9 flex-1 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Deny
            </button>
          </div>

          <p className="text-center text-xs text-slate-400">
            You'll be redirected to <span className="font-mono text-slate-600">{redirectUri}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
