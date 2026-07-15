import React from 'react'
import { cn } from '../../lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export default function Card({ className, ...props }: CardProps) {
  return <div className={cn('rounded-xl border border-border bg-card text-card-foreground shadow-sm', className)} {...props} />
}
