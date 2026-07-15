import React from 'react'
import { cn } from '../../lib/utils'

type AlertTone = 'info' | 'success' | 'warning' | 'danger'

const toneClasses: Record<AlertTone, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700'
}

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone
}

export default function Alert({ tone = 'info', className, ...props }: AlertProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-xl border px-4 py-3 text-sm', toneClasses[tone], className)}
      {...props}
    />
  )
}
