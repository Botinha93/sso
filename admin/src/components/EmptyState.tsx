import { Stack, Text, ThemeIcon } from '@mantine/core'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}

/** Centered placeholder for empty lists and tables. */
export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Stack align="center" gap={4} py={48} px="md" ta="center">
      {Icon ? (
        <ThemeIcon size={44} radius="lg" variant="light" color="gray" mb="sm">
          <Icon size={22} />
        </ThemeIcon>
      ) : null}
      <Text size="sm" fw={600}>{title}</Text>
      {description ? <Text size="xs" c="dimmed">{description}</Text> : null}
      {action ? <div style={{ marginTop: 'var(--mantine-spacing-md)' }}>{action}</div> : null}
    </Stack>
  )
}
