import { Search, X } from 'lucide-react'
import type { InputHTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  onClear?: () => void
  wrapperClassName?: string
}

function SearchInput({
  className,
  wrapperClassName,
  onClear,
  value,
  placeholder = 'Search...',
  ...props
}: SearchInputProps) {
  const hasValue = typeof value === 'string' ? value.length > 0 : false

  return (
    <div
      className={cn(
        'flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-brand-200 focus-within:ring-4 focus-within:ring-brand-100/70',
        wrapperClassName,
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-ink-400" />
      <input
        value={value}
        placeholder={placeholder}
        className={cn(
          'w-full bg-transparent text-sm text-ink-950 placeholder:text-ink-400',
          className,
        )}
        {...props}
      />
      {hasValue && onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-400 transition hover:bg-slate-100 hover:text-ink-700"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  )
}

export default SearchInput
