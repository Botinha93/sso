import { Button, Group, Stack, Text } from '@mantine/core'
import Modal from './Modal'

interface ConfirmDialogProps {
  isOpen: boolean
  title?: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const ConfirmDialog = ({
  isOpen,
  title = 'Confirm Action',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  pending = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} size="md">
      <Stack gap="lg">
        <Text size="sm" c="dimmed">{message}</Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button color={variant === 'danger' ? 'red' : undefined} onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

export default ConfirmDialog
