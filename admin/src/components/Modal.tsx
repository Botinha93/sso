import { Modal as MantineModal, type ModalProps as MantineModalProps } from '@mantine/core'

interface ModalProps extends Omit<MantineModalProps, 'opened' | 'onClose' | 'title' | 'size'> {
  isOpen: boolean
  onClose: () => void
  title: React.ReactNode
  children: React.ReactNode
  size?: 'md' | 'lg' | 'xl' | 'full'
}

const sizes: Record<NonNullable<ModalProps['size']>, string | number> = {
  md: 'lg',
  lg: 896,
  xl: 1152,
  full: '96vw',
}

/** Mantine `Modal` with the admin console's size presets. Mantine handles focus trapping, stacking and Escape. */
export default function Modal({ isOpen, onClose, title, children, size = 'lg', ...others }: ModalProps) {
  return (
    <MantineModal opened={isOpen} onClose={onClose} title={title} size={sizes[size]} centered {...others}>
      {children}
    </MantineModal>
  )
}
