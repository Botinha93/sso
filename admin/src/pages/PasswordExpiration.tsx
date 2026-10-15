import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button, Group, Image, PasswordInput, Stack, Text } from "@mantine/core";
import { AuthCard, AuthLayout, ColorSchemeToggle } from "@nexus/design";
import { AlertCircle, ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import LanguageSelector from "../components/LanguageSelector";
import { useAdminChangePassword } from "../hooks/useApi";
import { useI18n, formatPasswordExpirationWarning } from "../i18n";

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

function AuthBrand({ logoUrl }: { logoUrl?: string }) {
  return (
    <Group gap={10}>
      <Image src={logoUrl ?? "/logo.svg"} alt="NexusID" w={32} h={32} radius="md" fit="contain" />
      <Text fw={600} fz="lg">
        NexusID
      </Text>
    </Group>
  );
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
  const message = expired
    ? t("login.passwordExpired")
    : typeof status?.daysRemaining === "number"
      ? formatPasswordExpirationWarning(t, status.daysRemaining)
      : t("passwordExpiration.defaultWarning");

  return (
    <AuthLayout
      style={ui?.backgroundCss ? { background: ui.backgroundCss } : undefined}
      brand={<AuthBrand logoUrl={ui?.logoUrl} />}
      topRight={
        <>
          <LanguageSelector />
          <ColorSchemeToggle size="md" variant="default" />
        </>
      }
    >
      <AuthCard
        icon={expired ? <AlertCircle size={22} /> : <KeyRound size={22} />}
        iconColor={expired ? "red" : "yellow"}
        title={ui?.title ?? title}
        subtitle={ui?.subtitle ?? t("passwordExpiration.subtitle")}
        footer={showChangeForm && !expired ? (
          <Button variant="subtle" color="gray" size="xs" leftSection={<ArrowLeft size={14} />} onClick={() => setShowChangeForm(false)}>
            {t("login.back")}
          </Button>
        ) : undefined}
      >
        <Stack gap="md">
          <Alert
            color={expired ? "red" : "yellow"}
            icon={expired ? <AlertCircle size={16} /> : <KeyRound size={16} />}
          >
            {message}
          </Alert>

          {expired ? (
            <Text size="sm" c="dimmed">{t("passwordExpiration.required")}</Text>
          ) : null}

          {error ? (
            <Alert color="red" icon={<AlertCircle size={16} />} role="alert">
              {error}
            </Alert>
          ) : null}

          {showChangeForm ? (
            <form onSubmit={handleChangePassword}>
              <Stack gap="sm">
                <PasswordInput
                  label={t("password.current")}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <PasswordInput
                  label={t("password.new")}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <PasswordInput
                  label={t("password.confirm")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <Button
                  type="submit"
                  fullWidth
                  mt="xs"
                  leftSection={<ShieldCheck size={16} />}
                  disabled={changePassword.isPending}
                  loading={changePassword.isPending}
                >
                  {changePassword.isPending ? t("password.updating") : t("password.update")}
                </Button>
              </Stack>
            </form>
          ) : (
            <Stack gap="sm">
              <Button fullWidth onClick={() => setShowChangeForm(true)}>
                {t("password.change")}
              </Button>
              <Button variant="default" fullWidth onClick={continueToAuthorize}>
                {t("passwordExpiration.continueToApp")}
              </Button>
            </Stack>
          )}
        </Stack>
      </AuthCard>
    </AuthLayout>
  );
}
