import React, { createContext, useContext } from 'react'
import { cn } from '../../lib/utils'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

export interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  className?: string
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn('flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0', className)}
      {...props}
    />
  )
}

export interface TabTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
  icon?: React.ReactNode
  tone?: 'default' | 'danger'
}

export function TabTrigger({ value, icon, tone = 'default', className, children, ...props }: TabTriggerProps) {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('TabTrigger must be used within Tabs')
  const isActive = ctx.value === value

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        'flex h-auto shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors lg:w-full',
        isActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : tone === 'danger'
            ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}

export function TabPanel({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = useContext(TabsContext)
  if (!ctx || ctx.value !== value) return null
  return <div role="tabpanel">{children}</div>
}
