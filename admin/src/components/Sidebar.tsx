import { Link, useLocation } from 'react-router-dom'
import { Box, Group, Image, Text } from '@mantine/core'
import { SidebarNav, UserMenu, hasPermission, type SidebarNavGroup } from '@nexus/design'
import {
  LayoutDashboard,
  AppWindow,
  Users,
  UsersRound,
  Shield,
  FileText,
  CheckSquare,
  Building2,
  Boxes,
  Network,
  Route,
  ScanFace,
  Fingerprint,
  Gavel,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  History,
  Tablet,
  BellRing,
  BarChart3,
  Lightbulb,
  Settings2,
  BookText,
  Bot,
  GitMerge,
  Puzzle,
  Sparkles
} from 'lucide-react'
import { logout } from '../hooks/useApi'

const icon = (Icon: typeof Users) => <Icon size={16} strokeWidth={2} />

const navGroups: SidebarNavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: icon(LayoutDashboard), permission: 'users:view' },
    ]
  },
  {
    label: 'Operations',
    items: [
      { href: '/access-governance', label: 'Access Governance', icon: icon(CheckCircle2), permission: 'administration:view' },
      { href: '/elevations', label: 'Elevation Operations', icon: icon(ShieldAlert), permission: 'administration:view' },
      { href: '/elevation-sessions', label: 'Elevation Sessions', icon: icon(History), permission: 'administration:view' },
      { href: '/sessions', label: 'Sessions', icon: icon(ShieldCheck), permission: 'sessions:view' },
      { href: '/devices', label: 'Devices', icon: icon(Tablet), permission: 'sessions:view' },
      { href: '/events', label: 'Events', icon: icon(BellRing), permission: 'events:view' },
      { href: '/suggestions', label: 'Suggestions', icon: icon(Lightbulb), permission: 'suggestions:view' },
      { href: '/audit', label: 'Audit Log', icon: icon(FileText), permission: 'audit_log:view' },
    ]
  },
  {
    label: 'Identity & Access',
    items: [
      { href: '/users', label: 'Users', icon: icon(Users), permission: 'users:view' },
      { href: '/service-identities', label: 'Service Identities', icon: icon(Bot), permission: 'service_identities:view' },
      { href: '/groups', label: 'Groups', icon: icon(UsersRound), permission: 'groups:view' },
      { href: '/roles', label: 'Roles', icon: icon(Shield), permission: 'roles:view' },
      { href: '/clients', label: 'Clients', icon: icon(AppWindow), permission: 'clients:view' },
      { href: '/apps', label: 'Apps', icon: icon(Boxes), permission: 'apps:view' },
      { href: '/consents', label: 'Consents', icon: icon(CheckSquare), permission: 'consents:view' },
    ]
  },
  {
    label: 'Authentication',
    items: [
      { href: '/federation', label: 'Federation', icon: icon(Network), permission: 'federation_providers:view' },
      { href: '/authentication', label: 'Auth Flows', icon: icon(Route), permission: 'authentication_flows:view' },
      { href: '/interaction-views', label: 'Interaction Views', icon: icon(ScanFace), permission: 'authentication_flows:view' },
      { href: '/policies', label: 'Policies', icon: icon(Gavel), permission: 'policies:view' },
      { href: '/user-attributes', label: 'User Attributes', icon: icon(Fingerprint), permission: 'user_attributes:view' },
    ]
  },
  {
    label: 'Platform',
    items: [
      { href: '/connectors', label: 'Connectors', icon: icon(GitMerge), permission: 'connectors:view' },
      { href: '/plugins', label: 'Plugins', icon: icon(Puzzle), permission: 'plugins:view' },
      { href: '/experience-customization', label: 'Experience Customization', icon: icon(Sparkles), permission: 'administration:view' },
      { href: '/metrics', label: 'Auth Metrics', icon: icon(BarChart3), permission: 'connectors:view' },
      { href: '/tenants', label: 'Tenants', icon: icon(Building2), permission: 'tenants:view' },
      { href: '/administration', label: 'Administration', icon: icon(Settings2), permission: 'administration:view' },
      { href: '/documentation', label: 'Documentation', icon: icon(BookText), permission: 'users:view' },
    ]
  },
]

export function AdminBrand() {
  return (
    <Group gap={10} wrap="nowrap">
      <Image src="/logo.svg" alt="" w={32} h={32} radius="md" />
      <Box style={{ minWidth: 0 }}>
        <Text size="sm" fw={600} lh={1.2}>NexusID</Text>
        <Text size="xs" c="dimmed" lh={1.3}>Identity Control</Text>
      </Box>
    </Group>
  )
}

interface SidebarProps {
  permissions?: string[]
  user?: { name?: string; email?: string }
  onNavigate?: () => void
  onChangePassword?: () => void
}

export default function Sidebar({ permissions = [], user, onNavigate, onChangePassword }: SidebarProps) {
  const location = useLocation()
  const activeHref = location.pathname === '/' ? '/dashboard' : location.pathname

  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  const name = user?.name || user?.email || 'Administrator'

  return (
    <SidebarNav
      groups={navGroups}
      activeHref={activeHref}
      canAccess={(permission) => hasPermission(permissions, permission)}
      linkComponent={Link}
      getLinkProps={(item) => ({ to: item.href })}
      onNavigate={() => onNavigate?.()}
      footer={
        <UserMenu
          fullWidth
          chevron="updown"
          name={name}
          subtitle={user?.email}
          menuProps={{ position: 'top-start', width: 'target' }}
          onSecurity={onChangePassword}
          labels={{ security: 'Change password' }}
          onSignOut={handleLogout}
        />
      }
    />
  )
}

