export type ClassValue = string | number | boolean | undefined | null | ClassValue[]

function flatten(value: ClassValue): string {
  if (!value) return ''
  if (Array.isArray(value)) return value.map(flatten).filter(Boolean).join(' ')
  return String(value)
}

export function cn(...inputs: ClassValue[]): string {
  return inputs.map(flatten).filter(Boolean).join(' ')
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function toDateInputValue(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (DATE_ONLY.test(trimmed)) return trimmed
  const parsed = Date.parse(trimmed)
  if (Number.isNaN(parsed)) return ''
  return new Date(parsed).toISOString().slice(0, 10)
}