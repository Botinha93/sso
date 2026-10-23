import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button, Group, Image, Paper, Stack, Text } from "@mantine/core";
import { AuthCard, AuthLayout, ColorSchemeToggle } from "@nexus/design";
import { ShieldCheck, AlertCircle, KeyRound } from "lucide-react";
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

interface HubResourceMetadata { resource: string; label: string; description: string }

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch('/api/csrf-token', { credentials: 'include' });
  if (!res.ok) {
    throw new Error('Could not obtain a CSRF token');
  }
  const data = await res.json() as { csrf_token: string };
  return data.csrf_token;
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

export default function Consent() {
  const { t } = useI18n()
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ui, setUi] = useState<UiCustomization | null>(null);
  const [hubResourceMetadata, setHubResourceMetadata] = useState<HubResourceMetadata | null>(null);
  const [hubResourceChecked, setHubResourceChecked] = useState(false);

  const clientId = searchParams.get("client_id") || "Unknown App";
  const scope = searchParams.get("scope") || "openid";
  const scopes = scope.split(" ").filter(Boolean);
  const redirectUri = searchParams.get("redirect_uri") || "/";
  const hubProfile = searchParams.get("nexushub_profile") === "nexushub:1";
  const hubInstallationId = searchParams.get("nexushub_installation_id") || "";
  const hubResource = searchParams.get("resource_audience") || "";

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

  React.useEffect(() => {
    if (!hubProfile || !clientId || !hubResource) { setHubResourceChecked(true); return }
    void (async () => {
      try {
        const query = new URLSearchParams({ client_id: clientId, resource_audience: hubResource });
        const res = await fetch(`/oauth/nexushub/resource-metadata?${query.toString()}`, { credentials: 'include' });
        if (res.ok) setHubResourceMetadata(await res.json() as HubResourceMetadata);
      } catch { /* Missing metadata disables approval below. */ }
      finally { setHubResourceChecked(true) }
    })();
  }, [hubProfile, clientId, hubResource]);

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
          decision,
          ...(hubProfile ? {
            nexushub_profile: "nexushub:1",
            nexushub_installation_id: hubInstallationId,
            resource_audience: hubResource
          } : {})
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
        icon={<KeyRound size={22} />}
        title={ui?.title ?? t('consent.title')}
        subtitle={ui?.subtitle ?? t('consent.subtitle', { clientId })}
      >
        <Stack gap="md">
          <Paper withBorder radius="md" p="md" bg="var(--nx-color-surface-sunken)">
            <Group gap={6} mb="sm">
              <KeyRound size={14} aria-hidden />
              <Text size="xs" fw={600} tt="uppercase" c="dimmed">
                {t('consent.requestedPermissions')}
              </Text>
            </Group>
            <Stack gap={8}>
              {scopes.map(s => (
                <Group key={s} gap="xs" wrap="nowrap" align="flex-start">
                  <Text c={ui?.accentColor ?? "green"} lh={1} mt={2} component="span">
                    <ShieldCheck size={14} aria-hidden />
                  </Text>
                  <Text size="sm">{consentScopeLabel(t, s)}</Text>
                </Group>
              ))}
            </Stack>
          </Paper>

          {hubProfile && (
            <Paper withBorder radius="md" p="md" bg="var(--nx-color-surface-sunken)">
              <Text size="sm" fw={600} mb={4}>NexusHub cross-application access</Text>
              <Text size="sm">Allow this Hub installation to act for you in the application below for 30 days.</Text>
              {hubResourceMetadata ? <>
                <Text size="sm" fw={600} mt="xs">{hubResourceMetadata.label}</Text>
                <Text size="sm">{hubResourceMetadata.description}</Text>
              </> : <Alert color="red" icon={<AlertCircle size={16} />} mt="sm" role="alert">
                {hubResourceChecked ? `Unrecognized resource audience: ${hubResource}. An administrator must configure a trusted label and description before you can approve this request.` : 'Verifying the requested application with NexusID…'}
              </Alert>}
              <Text size="xs" c="dimmed" mt="xs" style={{ overflowWrap: 'anywhere' }}>Resource audience: {hubResource}</Text>
              <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>Hub installation: {hubInstallationId}</Text>
            </Paper>
          )}

          {error && (
            <Alert color="red" icon={<AlertCircle size={16} />} role="alert">
              {error}
            </Alert>
          )}

          <Group grow gap="sm">
            <Button onClick={handleApprove} disabled={loading || (hubProfile && (!hubResourceChecked || !hubResourceMetadata))} loading={loading} color={ui?.primaryColor}>
              {loading ? t('consent.approving') : t('consent.allowAccess')}
            </Button>
            <Button variant="default" onClick={handleDeny} disabled={loading}>
              {t('consent.deny')}
            </Button>
          </Group>

          <Text size="xs" c="dimmed" ta="center" style={{ overflowWrap: 'anywhere' }}>
            {t('consent.redirectNotice', { redirectUri })}
          </Text>
        </Stack>
      </AuthCard>
    </AuthLayout>
  );
}
