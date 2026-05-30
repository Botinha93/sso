import { X } from 'lucide-react'
import React from 'react'
import Button from './ui/Button'

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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 bg-sky-50/70 px-5 py-2.5">
      <div className="flex items-center gap-2 text-sm text-sky-900">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-sky-100 hover:text-sky-900"
          onClick={onClear}
          title="Clear selection"
        >
          <X size={12} />
        </Button>
        <span className="font-medium">{label}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
      </div>
    </div>
  )
}

export default BulkActionsBar

interface SelectionCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'ref'> {
  indeterminate?: boolean
}

export const SelectionCheckbox = React.forwardRef<HTMLInputElement, SelectionCheckboxProps>(
  ({ indeterminate, className, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement | null>(null)

    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement)

    React.useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = Boolean(indeterminate && !props.checked)
      }
    }, [indeterminate, props.checked])

    return (
      <input
        type="checkbox"
        ref={innerRef}
        onClick={(event) => event.stopPropagation()}
        className={`rounded border-slate-300 cursor-pointer ${className ?? ''}`}
        {...props}
      />
    )
  }
)

SelectionCheckbox.displayName = 'SelectionCheckbox'
