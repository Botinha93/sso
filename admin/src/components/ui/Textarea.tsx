import React from 'react'
import { cn } from '../../lib/utils'

export const textareaBaseClassName = 'min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 focus-visible:ring-sky-500/40'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return <textarea ref={ref} className={cn(textareaBaseClassName, className)} {...props} />
})

Textarea.displayName = 'Textarea'

export default Textarea
