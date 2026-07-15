import React from 'react'
import { cn } from '../../lib/utils'

export function Table({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="table" className={cn('overflow-hidden rounded-xl border border-border bg-card', className)} {...props} />
}

export function TableHeaderRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="row"
      className={cn('flex items-center justify-between gap-4 border-b border-border bg-muted/50 px-5 py-3.5', className)}
      {...props}
    />
  )
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="rowgroup" className={cn('divide-y divide-border', className)} {...props} />
}

export interface TableRowProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean
  layout?: 'flex' | 'block'
}

export function TableRow({ className, selected = false, layout = 'flex', ...props }: TableRowProps) {
  return (
    <div
      role="row"
      className={cn(
        layout === 'flex' && 'flex items-center justify-between gap-4',
        'px-5 py-3.5 transition-colors hover:bg-muted/50',
        selected && 'bg-sky-50/40',
        className
      )}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="cell" className={cn('min-w-0', className)} {...props} />
}
