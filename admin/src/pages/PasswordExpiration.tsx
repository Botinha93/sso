import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, KeyRound, ShieldCheck } from "lucide-react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import LanguageSelector from "../components/LanguageSelector";
import { useAdminChangePassword } from "../hooks/useApi";
import { useI18n } from "../i18n";

interface UiCustomization {
  title?: string;
  subtitle?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  backgroundCss?: string;
}

interface PasswordExpirationStatus {
  active: boolean;
  status?: "ok" | "warning" | "expired";
  daysRemaining?: number;
  expiresAt?: string;
  message?: string;
}

export default function PasswordExpiration() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const changePassword = useAdminChangePassword();
  const [ui, setUi] = useState<UiCustomization | null>(null);
  const [status, setStatus] = useState<PasswordExpirationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showChangeForm, setShowChangeForm] = useState(false);

  const clientId = searchParams.get("client_id") || "";

  const continueToAuthorize = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("password_warning", "continue");
    window.location.href = `/oauth/authorize?${params.toString()}`;
  };

  useEffect(() => {
    void (async () => {
      try {
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
  }, [clientId]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/account/password-expiration", { credentials: "include" });
        if (res.status === 401) {
          const params = new URLSearchParams(searchParams.toString());
          window.location.href = `/login?${params.toString()}`;
          return;
        }
        if (!res.ok) {
          setError(t("passwordExpiration.loadFailed"));
          return;
        }
        const json = await res.json() as PasswordExpirationStatus;
        if (!json.active || json.status === "ok") {
          continueToAuthorize();
          return;
        }
        setStatus(json);
        if (json.status === "expired") {
          setShowChangeForm(true);
        }
      } catch {
        setError(t("passwordExpiration.loadFailed"));
      }
    })();
  }, [searchParams, t]);

  const handleChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError(t("password.mismatch"));
      return;
    }

    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      continueToAuthorize();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("password.failed"));
    }
  };

  const expired = status?.status === "expired";
  const title = expired ? t("passwordExpiration.expiredTitle") : t("passwordExpiration.title");
  const message = status?.message
    ?? (expired ? t("login.passwordExpired") : t("passwordExpiration.defaultWarning"));

  return (
    <div
      className="min-w-screen min-h-screen flex items-center justify-center p-4 font-sans"
      style={{
        background: ui?.backgroundCss ?? "var(--semantic-bg-page)"
      }}
    >
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-end">
          <LanguageSelector />
        </div>
        <Card className="overflow-hidden rounded-2xl">
          <div className="px-8 py-7" style={{ background: `linear-gradient(180deg, ${ui?.primaryColor ?? "#020617"} 0%, ${ui?.accentColor ?? "#0f172a"} 100%)` }}>
            <div className="flex items-center gap-3 mb-2">
              <img src={ui?.logoUrl ?? "/logo.svg"} alt="NexusID" className="h-9 w-9 rounded-xl ring-1 ring-sky-400/30" />
              <div className="text-xl font-semibold text-slate-50 tracking-tight">{ui?.title ?? title}</div>
            </div>
            <p className="text-slate-400 text-sm">{ui?.subtitle ?? t("passwordExpiration.subtitle")}</p>
          </div>

          <div className="px-8 py-7 space-y-5">
            <div className={`rounded-xl border p-4 text-sm ${expired ? "border-rose-200 bg-rose-50 text-rose-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              <div className="flex items-start gap-3">
                {expired ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>{message}</span>
              </div>
            </div>

            {expired ? (
              <p className="text-sm text-slate-600">{t("passwordExpiration.required")}</p>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              </div>
            ) : null}

            {showChangeForm ? (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("password.current")}
                  </label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("password.new")}
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("password.confirm")}
                  </label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                <Button type="submit" variant="primary" className="w-full" disabled={changePassword.isPending}>
                  <ShieldCheck size={15} />
                  {changePassword.isPending ? t("password.updating") : t("password.update")}
                </Button>
                {!expired ? (
                  <Button type="button" variant="secondary" className="w-full" onClick={() => setShowChangeForm(false)}>
                    {t("login.back")}
                  </Button>
                ) : null}
              </form>
            ) : (
              <div className="flex flex-col gap-3">
                <Button variant="primary" className="w-full" onClick={() => setShowChangeForm(true)}>
                  {t("password.change")}
                </Button>
                <Button variant="secondary" className="w-full" onClick={continueToAuthorize}>
                  {t("passwordExpiration.continueToApp")}
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
