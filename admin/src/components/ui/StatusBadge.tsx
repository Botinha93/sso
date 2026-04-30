import React from 'react'

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ')

type StatusBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'

const toneClasses: Record<StatusBadgeTone, string> = {
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
  info: 'border-sky-100 bg-sky-50 text-sky-700',
  success: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-100 bg-amber-50 text-amber-700',
  danger: 'border-rose-100 bg-rose-50 text-rose-700',
  accent: 'border-indigo-100 bg-indigo-50 text-indigo-700'
}

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusBadgeTone
  mono?: boolean
}

export default function StatusBadge({ tone = 'neutral', mono = false, className, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs',
        toneClasses[tone],
        mono && 'font-mono',
        className
      )}
      {...props}
    />
  )
}
