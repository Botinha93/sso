import { AppShell, Box, Button, Group, Image, Menu, Stack, Text, ThemeIcon, UnstyledButton } from '@mantine/core'
import { AppHeaderBar, ColorSchemeToggle, UserMenu } from '@nexus/design'
import { LayoutGrid, Lightbulb, Settings, Users as UsersIcon } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { logout, type PortalUser } from '../hooks'
import { useI18n } from '../i18n'
import LanguageSelector from './LanguageSelector'

const portalHome = import.meta.env.BASE_URL

export interface PortalShellBrand {
  title?: string
  logoUrl?: string
  primaryColor?: string
}

interface Props {
  user: PortalUser
  /** Optional UI customization for the header brand (Launcher passes the portal_launcher customization). */
  brand?: PortalShellBrand | null
  /** Optional page background (customization `backgroundCss`). Defaults to the Nexus canvas. */
  background?: string
  /** Max width of the content column. */
  maw?: number
  children: React.ReactNode
}

export function canManagePortalUsers(user: PortalUser) {
  return (
    Array.isArray(user.permissions) &&
    (user.permissions.includes('*:*') || user.permissions.includes('users:view'))
  )
}

export default function PortalShell({ user, brand, background, maw = 1120, children }: Props) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const canManageUsers = canManagePortalUsers(user)

  const handleLogout = async () => {
    await logout()
    window.location.href = portalHome
  }

  const navItems = [
    { to: '/', label: t('launcher.yourApps'), icon: LayoutGrid },
    { to: '/profile', label: t('launcher.settings'), icon: Settings },
    { to: '/suggestions', label: t('suggestions.appName'), icon: Lightbulb },
    ...(canManageUsers ? [{ to: '/users', label: t('users.title'), icon: UsersIcon }] : []),
  ]

  const isActive = (to: string) => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to))
  const displayName = [user.givenName, user.familyName].filter(Boolean).join(' ') || user.username || user.email

  return (
    <AppShell header={{ height: 56 }} padding={0}>
      <AppShell.Header>
        <AppHeaderBar
          brand={
            <UnstyledButton onClick={() => navigate('/')} aria-label={brand?.title ?? 'Account Portal'}>
              <Group gap={10} wrap="nowrap">
                <ThemeIcon size={28} radius="md" variant="filled" color={brand?.primaryColor ?? undefined} aria-hidden style={{ overflow: 'hidden' }}>
                  <Image src={brand?.logoUrl ?? `${portalHome}logo.svg`} alt="Logo" w={28} h={28} fit="cover" />
                </ThemeIcon>
                <Text fw={600} fz={15} truncate="end">{brand?.title ?? 'Account Portal'}</Text>
              </Group>
            </UnstyledButton>
          }
          nav={navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.to)
            return (
              <Button
                key={item.to}
                component={Link}
                to={item.to}
                variant={active ? 'light' : 'subtle'}
                color={active ? undefined : 'gray'}
                size="sm"
                leftSection={<Icon size={16} />}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Button>
            )
          })}
          actions={
            <>
              <LanguageSelector visibleFrom="sm" />
              <ColorSchemeToggle size="lg" />
            </>
          }
          user={
            <UserMenu
              name={displayName}
              subtitle={user.email}
              avatarSrc={user.avatarUrl}
              compact
              onProfile={() => navigate('/profile')}
              onSecurity={() => navigate('/profile?section=password')}
              onSignOut={() => void handleLogout()}
              labels={{
                profile: t('profile.nav.profile'),
                security: t('launcher.changePassword'),
                signOut: t('common.signOut'),
              }}
            >
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <Menu.Item
                    key={item.to}
                    hiddenFrom="md"
                    leftSection={<Icon size={15} />}
                    onClick={() => navigate(item.to)}
                  >
                    {item.label}
                  </Menu.Item>
                )
              })}
            </UserMenu>
          }
        />
      </AppShell.Header>

      <AppShell.Main style={{ background: background ?? 'var(--nx-color-canvas)' }}>
        <Box p={{ base: 'md', sm: 'lg', lg: 'xl' }} maw={maw} mx="auto">
          <Stack gap="lg">
            <Box hiddenFrom="sm">
              <LanguageSelector w="100%" />
            </Box>
            {children}
          </Stack>
        </Box>
      </AppShell.Main>
    </AppShell>
  )
}
