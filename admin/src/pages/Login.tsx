import React, { useEffect, useState } from "react";
import { Alert, Box, Button, Divider, Group, Image, PasswordInput, Skeleton, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { AuthCard, AuthLayout, ColorSchemeToggle, OtpStep, ProviderButtons } from "@nexus/design";
import { AlertCircle, ArrowLeft, KeyRound, Lock, ShieldCheck, User, UserRound } from "lucide-react";
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

function AuthBrand({ logoUrl, name }: { logoUrl?: string; name: string }) {
  return (
    <Group gap={10}>
      <Image src={logoUrl ?? "/logo.svg"} alt="NexusID" w={32} h={32} radius="md" fit="contain" />
      <Text fw={600} fz="lg">
        {name}
      </Text>
    </Group>
  );
}

function LoginLoadingSkeleton() {
  return (
    <AuthCard aria-hidden animate={false}>
      <Stack gap="md">
        <Stack gap={8} align="center">
          <Skeleton h={22} w={160} />
          <Skeleton h={12} w={240} />
        </Stack>
        <Skeleton h={56} radius="md" />
        <Stack gap={6}>
          <Skeleton h={12} w={96} />
          <Skeleton h={36} radius="sm" />
        </Stack>
        <Stack gap={6}>
          <Skeleton h={12} w={64} />
          <Skeleton h={36} radius="sm" />
        </Stack>
        <Skeleton h={36} radius="sm" />
      </Stack>
    </AuthCard>
  );
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

  // `codeOverride` lets the OTP input submit the code it just completed,
  // before the `mfaCode` state update has been applied.
  const submitLogin = async (codeOverride?: string) => {
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
          ? { mfaTicket, code: (codeOverride ?? mfaCode).trim() }
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitLogin();
  };

  const resetToCredentials = () => {
    setMfaTicket(null)
    setChangePasswordTicket(null)
    setMfaCode('')
    setNewPassword('')
    setConfirmPassword('')
    setInfoMessage(null)
    setError(null)
  };

  const showAccountPicker = accountSelection && (accountLoading || !!cachedAccount);

  const backFooter = (
    <Button variant="subtle" color={ui?.accentColor ?? "gray"} size="xs" leftSection={<ArrowLeft size={14} />} onClick={resetToCredentials}>
      {t('login.back')}
    </Button>
  );

  const infoAlert = infoMessage ? (
    <Alert color="yellow" icon={<AlertCircle size={16} />}>
      {infoMessage}
    </Alert>
  ) : null;

  const errorAlert = error ? (
    <Alert color="red" icon={<AlertCircle size={16} />} role="alert">
      {error}
    </Alert>
  ) : null;

  const renderCard = () => {
    if (showAccountPicker) {
      return (
        <AuthCard
          icon={<UserRound size={22} />}
          title={t('login.chooseAccount')}
          subtitle={t('login.chooseAccountDescription')}
        >
          <Stack gap="md">
            {errorAlert}
            {accountLoading ? (
              <Skeleton h={72} radius="md" aria-label="Loading saved account" />
            ) : (
              <>
                <UnstyledButton
                  type="button"
                  onClick={continueWithCachedAccount}
                  className="nx-interactive"
                  p="md"
                  w="100%"
                  style={{ border: '1px solid var(--nx-color-border)', borderRadius: 'var(--mantine-radius-md)' }}
                >
                  <Group gap="sm" wrap="nowrap">
                    <User size={16} aria-hidden />
                    <Box miw={0}>
                      <Text fw={500} truncate>
                        {cachedAccount!.givenName || cachedAccount!.familyName ? `${cachedAccount!.givenName ?? ""} ${cachedAccount!.familyName ?? ""}`.trim() : cachedAccount!.username}
                      </Text>
                      <Text size="sm" c="dimmed" truncate>{cachedAccount!.email}</Text>
                    </Box>
                  </Group>
                </UnstyledButton>
                <Button type="button" variant="default" fullWidth loading={switchingAccount} disabled={switchingAccount} onClick={() => void useAnotherAccount()}>
                  {switchingAccount ? t('login.switchingAccount') : t('login.useAnotherAccount')}
                </Button>
              </>
            )}
          </Stack>
        </AuthCard>
      );
    }

    if (mfaTicket) {
      return (
        <AuthCard
          icon={<ShieldCheck size={22} />}
          title={t('login.authenticatorCode')}
          subtitle={ui?.subtitle ?? t('login.subtitle')}
          footer={backFooter}
        >
          <OtpStep
            value={mfaCode}
            onChange={(value) => setMfaCode(value.replace(/\D+/g, '').slice(0, 8))}
            onSubmit={(code) => {
              if (!loading) void submitLogin(code);
            }}
            loading={loading}
            error={error ?? undefined}
            labels={{ submit: t('login.verifyCode'), input: t('login.authenticatorCode') }}
          />
        </AuthCard>
      );
    }

    if (changePasswordTicket) {
      return (
        <AuthCard
          icon={<KeyRound size={22} />}
          iconColor="yellow"
          title={t('login.updatePassword')}
          subtitle={ui?.subtitle ?? t('login.subtitle')}
          footer={backFooter}
        >
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {infoAlert}
              {errorAlert}
              <PasswordInput
                label={t('login.newPassword')}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                autoFocus
                autoComplete="new-password"
                placeholder="••••••••"
                leftSection={<Lock size={16} />}
              />
              <PasswordInput
                label={t('login.confirmNewPassword')}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="••••••••"
                leftSection={<Lock size={16} />}
              />
              <Button type="submit" fullWidth mt="xs" loading={loading} disabled={loading} color={ui?.primaryColor}>
                {loading ? t('login.signingIn') : t('login.updatePassword')}
              </Button>
            </Stack>
          </form>
        </AuthCard>
      );
    }

    return (
      <AuthCard title={t('login.signIn')} subtitle={ui?.subtitle ?? t('login.subtitle')}>
        <Stack gap="md">
          <Alert color="green" variant="light" icon={<ShieldCheck size={16} />}>
            {t('login.securityBanner')}
          </Alert>
          {infoAlert}
          {errorAlert}
          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              <TextInput
                label={t('login.usernameOrEmail')}
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                placeholder={t('login.emailPlaceholder')}
                leftSection={<User size={16} />}
              />
              <PasswordInput
                label={t('login.password')}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                leftSection={<Lock size={16} />}
              />
              <Button type="submit" fullWidth mt="xs" loading={loading} disabled={loading} color={ui?.primaryColor}>
                {loading ? t('login.signingIn') : t('login.signIn')}
              </Button>
            </Stack>
          </form>
          {!accountSelection && (providersLoading ? (
            <Stack gap="xs" aria-hidden>
              <Skeleton h={12} w={112} mx="auto" />
              <Skeleton h={36} radius="sm" />
            </Stack>
          ) : providers.length > 0 && (
            <Box>
              <Divider label={t('login.orContinueWith')} labelPosition="center" mb="sm" />
              <ProviderButtons
                providers={providers.map((provider) => ({
                  id: provider.id,
                  name: provider.label,
                  href: `/auth/federation/${provider.id}/start?redirect=${encodeURIComponent(buildRedirectAfterLogin())}`
                }))}
                getLabel={(name) => name}
              />
            </Box>
          ))}
        </Stack>
      </AuthCard>
    );
  };

  return (
    <AuthLayout
      style={ui?.backgroundCss ? { background: ui.backgroundCss } : undefined}
      brand={<AuthBrand logoUrl={ui?.logoUrl} name={ui?.title ?? t('login.brandFallback')} />}
      topRight={
        <>
          <LanguageSelector />
          <ColorSchemeToggle size="md" variant="default" />
        </>
      }
    >
      {uiLoading ? <LoginLoadingSkeleton /> : renderCard()}
    </AuthLayout>
  );
}
