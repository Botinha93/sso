import React from 'react'
import { cn } from '../../lib/utils'

export const inputBaseClassName = 'h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 focus-visible:ring-sky-500/40'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return <input ref={ref} className={cn(inputBaseClassName, className)} {...props} />
})

Input.displayName = 'Input'

export default Input
