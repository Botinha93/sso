import { Alert, Anchor, Avatar, Badge, Box, Group, Paper, SimpleGrid, Text, Title } from '@mantine/core'
import { AppTile, AppTileGrid } from '@nexus/design'
import { Lightbulb, Settings, Users as UsersIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { type PortalUser } from '../hooks'
import PortalShell from '../components/PortalShell'
import { useI18n, formatPasswordExpirationWarning } from '../i18n'

interface Props {
  user: PortalUser
}

interface UiCustomization {
  title?: string
  subtitle?: string
  logoUrl?: string
  primaryColor?: string
  accentColor?: string
  backgroundCss?: string
}

export default function Launcher({ user }: Props) {
  const { t } = useI18n()
  const [ui, setUi] = useState<UiCustomization | null>(null)
  const [passwordExpirationDays, setPasswordExpirationDays] = useState<number | null>(null)
  const [warningDismissed, setWarningDismissed] = useState(() => sessionStorage.getItem('passwordExpirationWarningDismissed') === '1')
  const canManageUsers =
    Array.isArray(user.permissions) &&
    (user.permissions.includes('*:*') || user.permissions.includes('users:view'))

  const inheritedGroupsByAppId = useMemo(() => {
    const map = new Map<string, string[]>()
    const directAppIds = new Set(user.directAppIds ?? [])
    for (const source of user.inheritedAppSources ?? []) {
      if (directAppIds.has(source.appId)) continue
      const existing = map.get(source.appId) ?? []
      if (!existing.includes(source.groupName)) {
        existing.push(source.groupName)
        map.set(source.appId, existing)
      }
    }
    return map
  }, [user.directAppIds, user.inheritedAppSources])

  useEffect(() => {
    const fromMe = user.passwordExpirationWarning?.daysRemaining
    const stored = sessionStorage.getItem('passwordExpirationWarning')
    const fromLogin = stored && /^\d+$/.test(stored) ? Number(stored) : undefined
    const days = typeof fromMe === 'number' ? fromMe : fromLogin
    setPasswordExpirationDays(typeof days === 'number' && Number.isFinite(days) ? days : null)
  }, [user.passwordExpirationWarning])

  useEffect(() => {
    void (async () => {
      try {
        const defaultAppId = user.apps[0]?.id
        const query = new URLSearchParams({ surface: 'portal_launcher' })
        if (defaultAppId) query.set('appId', defaultAppId)
        const res = await fetch(`/api/ui/customization?${query.toString()}`, { credentials: 'include' })
        if (!res.ok) return
        const json = await res.json()
        setUi(json?.customization ?? null)
      } catch {
        // Customization is optional.
      }
    })()
  }, [user.apps])

  const passwordExpirationWarning = passwordExpirationDays == null
    ? null
    : formatPasswordExpirationWarning(t, passwordExpirationDays)

  const subtitle = ui?.subtitle ?? user.email
  const initials = `${user.givenName?.[0] ?? ''}${user.email?.[0] ?? ''}`.toUpperCase()

  return (
    <PortalShell user={user} brand={ui} background={ui?.backgroundCss}>
      {passwordExpirationWarning && !warningDismissed ? (
        <Alert color="yellow">
          <Group justify="space-between" gap="sm" wrap="wrap">
            <Text size="sm">{passwordExpirationWarning}</Text>
            <Group gap="md">
              <Anchor component={Link} to="/profile?section=password" size="sm" fw={500}>
                {t('launcher.changePassword')}
              </Anchor>
              <Anchor
                component="button"
                type="button"
                size="sm"
                c="dimmed"
                onClick={() => {
                  sessionStorage.removeItem('passwordExpirationWarning')
                  sessionStorage.setItem('passwordExpirationWarningDismissed', '1')
                  setWarningDismissed(true)
                  setPasswordExpirationDays(null)
                }}
              >
                {t('launcher.dismissWarning')}
              </Anchor>
            </Group>
          </Group>
        </Alert>
      ) : null}

      <Group gap="md" wrap="nowrap">
        <Avatar src={user.avatarUrl} alt="avatar" size={48} radius="xl" color="blue">
          {initials}
        </Avatar>
        <Box miw={0}>
          <Title order={2}>{t('launcher.welcomeBack', { name: user.givenName })}</Title>
          <Text size="sm" c="dimmed" mt={2} truncate="end">{subtitle}</Text>
        </Box>
      </Group>

      {canManageUsers && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          <AppTile
            layout="row"
            name={t('launcher.manageUsers')}
            description={t('launcher.manageUsersHint')}
            icon={<Settings size={18} />}
            color="blue"
            component={Link}
            componentProps={{ to: '/users' }}
          />
        </SimpleGrid>
      )}

      <AppTileGrid title={t('launcher.yourApps')}>
        <AppTile
          name={t('suggestions.appName')}
          description={t('suggestions.appDescription')}
          icon={<Lightbulb size={22} />}
          color="yellow"
          component={Link}
          componentProps={{ to: '/suggestions' }}
        />
        {user.apps.map(app => (
          <LauncherAppTile
            key={app.id}
            app={app}
            inheritedFromGroups={inheritedGroupsByAppId.get(app.id) ?? []}
            viaGroupLabel={(group) => t('launcher.viaGroup', { group })}
          />
        ))}
      </AppTileGrid>

      {user.apps.length === 0 ? (
        <Paper withBorder p="xl" ta="center" style={{ borderStyle: 'dashed', background: 'transparent' }}>
          <Text size="sm" c="dimmed">{t('launcher.noAppsTitle')}</Text>
          <Text size="xs" c="dimmed" mt={4}>{t('launcher.noAppsHint')}</Text>
        </Paper>
      ) : null}
    </PortalShell>
  )
}

interface LauncherAppTileProps {
  app: PortalUser['apps'][0]
  inheritedFromGroups: string[]
  viaGroupLabel: (group: string) => string
}

function LauncherAppTile({ app, inheritedFromGroups, viaGroupLabel }: LauncherAppTileProps) {
  const isInherited = inheritedFromGroups.length > 0
  const groupTooltip = isInherited
    ? inheritedFromGroups.map((group) => viaGroupLabel(group)).join(' · ')
    : undefined
  const target = app.url ? (app.url.startsWith('http') ? '_blank' : '_self') : undefined

  return (
    <AppTile
      name={app.name}
      description={app.description || undefined}
      imageSrc={app.imageUrl}
      href={app.url || undefined}
      target={target}
      rel={app.url ? 'noreferrer' : undefined}
      external={target === '_blank'}
      badge={
        isInherited ? (
          <Badge size="xs" color="blue" leftSection={<UsersIcon size={10} />} title={groupTooltip} maw="100%">
            {viaGroupLabel(inheritedFromGroups[0])}{inheritedFromGroups.length > 1 ? ` +${inheritedFromGroups.length - 1}` : ''}
          </Badge>
        ) : undefined
      }
    />
  )
}
