import React from 'react'
import { CloseButton, Checkbox, type CheckboxProps, Group, Paper, Text } from '@mantine/core'

interface BulkActionsBarProps {
  count: number
  noun?: string
  pluralNoun?: string
  onClear: () => void
  children?: React.ReactNode
}

const BulkActionsBar = ({
  count,
  noun = 'item',
  pluralNoun,
  onClear,
  children
}: BulkActionsBarProps) => {
  if (count <= 0) return null
  const label = `${count} ${count === 1 ? noun : (pluralNoun ?? `${noun}s`)} selected`

  return (
    <Paper
      radius={0}
      px="md"
      py={8}
      bg="var(--nx-color-accent-soft)"
      style={{ borderBottom: '1px solid var(--nx-color-border)' }}
      className="nx-fade-in"
    >
      <Group justify="space-between" gap="sm" wrap="wrap">
        <Group gap={6}>
          <CloseButton size="sm" onClick={onClear} title="Clear selection" aria-label="Clear selection" />
          <Text size="sm" fw={500}>{label}</Text>
        </Group>
        <Group gap="xs" wrap="wrap">
          {children}
        </Group>
      </Group>
    </Paper>
  )
}

export default BulkActionsBar

export const SelectionCheckbox = React.forwardRef<HTMLInputElement, Omit<CheckboxProps, 'ref'>>(
  ({ indeterminate, checked, onClick, ...props }, ref) => (
    <Checkbox
      ref={ref}
      size="xs"
      checked={checked}
      indeterminate={Boolean(indeterminate && !checked)}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.(event)
      }}
      {...props}
    />
  )
)

SelectionCheckbox.displayName = 'SelectionCheckbox'
