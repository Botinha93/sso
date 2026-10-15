import { Button, Card, Code, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { ArrowUpRight, KeyRound, LogIn, MonitorSmartphone, ShieldCheck } from 'lucide-react'
import { PageHeader, SectionCard } from '@nexus/design'

const cards = [
  {
    title: 'Login View',
    description: 'Open the hosted sign-in view used by authorization and admin login flows.',
    href: '/login',
    icon: LogIn,
    note: 'Useful for validating login prompts and federation entry points.'
  },
  {
    title: 'Consent View',
    description: 'Open the consent screen route used during interactive authorization flows.',
    href: '/consent',
    icon: ShieldCheck,
    note: 'Best launched by a real authorization request so client and scope context are present.'
  },
  {
    title: 'Password Expiration View',
    description: 'Open the hosted warning shown during SSO login when a password is expired or close to expiry.',
    href: '/password-expiration',
    icon: KeyRound,
    note: 'Normally opened by /oauth/authorize when the password expiration policy is active.'
  },
  {
    title: 'Device Verification View',
    description: 'Open the device verification screen where end users approve a device_code request.',
    href: '/oauth/device/verify',
    icon: MonitorSmartphone,
    note: 'Can be used directly by entering a user code or via verification_uri_complete.'
  }
]

export default function InteractionViews() {
  return (
    <Stack gap="lg">
      <PageHeader
        eyebrow="Authentication"
        title="Interaction Views"
        description="Quick access to the hosted OAuth and OIDC user-facing interaction screens. These views are normally opened by live protocol flows, but can be launched here for manual validation."
      />

      <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} withBorder radius="md" padding="lg">
              <ThemeIcon size={44} radius="md" variant="light" color="gray" mb="md">
                <Icon size={20} />
              </ThemeIcon>
              <Title order={3} fz="md" fw={600}>{card.title}</Title>
              <Text size="sm" c="dimmed" mt="xs">{card.description}</Text>
              <Paper withBorder radius="md" px="sm" py="xs" mt="sm" bg="var(--nx-color-surface-sunken)" style={{ flex: 1 }}>
                <Text size="xs" c="dimmed">{card.note}</Text>
              </Paper>
              <Group justify="space-between" gap="sm" mt="md" wrap="nowrap">
                <Code style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.href}</Code>
                <Button component="a" href={card.href} size="xs" rightSection={<ArrowUpRight size={14} />}>
                  Open
                </Button>
              </Group>
            </Card>
          )
        })}
      </SimpleGrid>

      <SectionCard title="Usage notes" icon={<KeyRound size={16} />}>
        <Stack gap="xs">
          <Text size="sm" c="dimmed">The consent screen is most meaningful when opened by an authorize request that provides client_id, scope, redirect_uri, response_type, and response_mode.</Text>
          <Text size="sm" c="dimmed">The device verification screen is now usable as a standalone page because it accepts a manual user code entry.</Text>
          <Text size="sm" c="dimmed">These links are intended for operator validation and troubleshooting, not as the normal application launch path.</Text>
        </Stack>
      </SectionCard>
    </Stack>
  )
}
