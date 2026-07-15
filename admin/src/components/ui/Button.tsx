import React from 'react'
import { cn } from '../../lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'icon'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'border border-border bg-card text-foreground hover:bg-muted',
  outline: 'border border-border bg-transparent text-foreground hover:bg-muted',
  danger: 'bg-destructive text-white hover:bg-destructive/90',
  ghost: 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs font-medium',
  md: 'h-9 px-4 text-sm font-medium',
  icon: 'h-8 w-8 p-0'
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-sky-500/40',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'

export default Button
