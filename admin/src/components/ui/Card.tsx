import React from 'react'

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ')

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export default function Card({ className, ...props }: CardProps) {
  return <div className={cx('rounded-xl border border-slate-200 bg-white shadow-sm', className)} {...props} />
}
