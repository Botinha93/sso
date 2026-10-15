import { type FormEvent, useState } from 'react'
import { Alert, Button, Group, PasswordInput, Stack } from '@mantine/core'
import Modal from './Modal'
import { useAdminChangePassword } from '../hooks/useApi'
import { useI18n } from '../i18n'

export default function ChangePasswordModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const { t } = useI18n()
  const changePassword = useAdminChangePassword()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const reset = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
    setSuccess(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (newPassword !== confirmPassword) {
      setError(t('password.mismatch'))
      return
    }

    try {
      await changePassword.mutateAsync({ currentPassword, newPassword })
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('password.failed'))
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('password.title')} size="md">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <PasswordInput
            label={t('password.current')}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.currentTarget.value)}
            autoComplete="current-password"
            required
          />
          <PasswordInput
            label={t('password.new')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.currentTarget.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <PasswordInput
            label={t('password.confirm')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.currentTarget.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />

          {error ? <Alert color="red" variant="light">{error}</Alert> : null}
          {success ? <Alert color="green" variant="light">{t('password.success')}</Alert> : null}

          <Group justify="flex-end" gap="xs" pt="xs">
            <Button type="button" variant="default" onClick={handleClose}>
              {t('password.cancel')}
            </Button>
            <Button type="submit" loading={changePassword.isPending}>
              {t('password.update')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
