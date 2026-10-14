import { Search, X } from 'lucide-react'
import Input from './ui/Input'
import Button from './ui/Button'

type ListSearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function ListSearch({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
}: ListSearchProps) {
  return (
    <div className={`relative max-w-sm ${className}`}>
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border-slate-200 bg-white pl-9 pr-9 text-sm"
        aria-label="Search list"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          onClick={() => onChange('')}
          title="Clear search"
          aria-label="Clear search"
        >
          <X size={14} />
        </Button>
      ) : null}
    </div>
  )
}
