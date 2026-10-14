import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'

const openModalStack: string[] = []

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'md' | 'lg' | 'xl' | 'full'
}

const sizeClass: Record<NonNullable<ModalProps['size']>, string> = {
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  full: 'max-w-[96vw]'
}

const Modal = ({ isOpen, onClose, title, children, size = 'lg' }: ModalProps) => {
  const modalIdRef = useRef(`modal-${Math.random().toString(36).slice(2, 10)}`)
  const modalRef = useRef<HTMLDivElement | null>(null)
  const lastFocusedRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const titleIdRef = useRef(`modal-title-${Math.random().toString(36).slice(2, 10)}`)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return

    openModalStack.push(modalIdRef.current)

    lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const isTopmostModal = () => openModalStack[openModalStack.length - 1] === modalIdRef.current

    const getTabbables = () => {
      if (!modalRef.current) return [] as HTMLElement[]
      return Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1)
    }

    const focusFirst = () => {
      const tabbables = getTabbables()
      if (tabbables.length > 0) {
        tabbables[0].focus()
      } else {
        modalRef.current?.focus()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopmostModal()) return
      if (event.key === 'Escape') onCloseRef.current()
      if (event.key !== 'Tab') return

      const tabbables = getTabbables()
      if (tabbables.length === 0) {
        event.preventDefault()
        return
      }

      const first = tabbables[0]
      const last = tabbables[tabbables.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey) {
        if (active === first || !modalRef.current?.contains(active)) {
          event.preventDefault()
          last.focus()
        }
        return
      }

      if (active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    requestAnimationFrame(focusFirst)

    return () => {
      const wasTopmost = isTopmostModal()
      const stackIndex = openModalStack.lastIndexOf(modalIdRef.current)
      if (stackIndex >= 0) openModalStack.splice(stackIndex, 1)

      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)

      const restoreTarget = lastFocusedRef.current
      if (!wasTopmost || !restoreTarget || !restoreTarget.isConnected) return

      if (openModalStack.length === 0) {
        restoreTarget.focus()
        return
      }

      const nextTopId = openModalStack[openModalStack.length - 1]
      const nextTopModal = document.querySelector<HTMLElement>(`[data-modal-id="${nextTopId}"]`)
      if (nextTopModal?.contains(restoreTarget)) {
        restoreTarget.focus()
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4" onClick={onClose}>
      <div
        ref={modalRef}
        data-modal-id={modalIdRef.current}
        tabIndex={-1}
        aria-modal="true"
        role="dialog"
        aria-labelledby={titleIdRef.current}
        className={`bg-white border border-slate-200 rounded-2xl shadow-lg w-full ${sizeClass[size]} max-h-[92vh] overflow-auto`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 rounded-t-2xl">
          <h4 id={titleIdRef.current} className="font-semibold text-slate-900">{title}</h4>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 focus-visible:ring-sky-500/40">
            <X size={14} />
          </button>
        </div>
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default Modal