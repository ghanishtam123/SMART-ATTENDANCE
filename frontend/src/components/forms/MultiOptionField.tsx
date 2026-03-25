import { Check } from 'lucide-react'

import { cn } from '../../utils/cn'

export interface MultiOptionItem {
  label: string
  value: string
  meta?: string
}

interface MultiOptionFieldProps {
  label: string
  options: MultiOptionItem[]
  value: string[]
  onChange: (nextValue: string[]) => void
  error?: string
  hint?: string
  emptyMessage?: string
}

function MultiOptionField({
  label,
  options,
  value,
  onChange,
  error,
  hint,
  emptyMessage = 'No options available.',
}: MultiOptionFieldProps) {
  const selectedValues = new Set(value)

  const toggleValue = (optionValue: string) => {
    if (selectedValues.has(optionValue)) {
      onChange(value.filter((item) => item !== optionValue))
      return
    }

    onChange([...value, optionValue])
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink-800">{label}</span>
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-ink-400">
          {value.length} selected
        </span>
      </div>

      <div
        className={cn(
          'rounded-3xl border bg-slate-50/80 p-3 shadow-sm transition',
          error
            ? 'border-danger-500/40 ring-2 ring-danger-500/10'
            : 'border-slate-200',
        )}
      >
        {options.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {options.map((option) => {
              const active = selectedValues.has(option.value)

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleValue(option.value)}
                  className={cn(
                    'flex min-h-16 items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition',
                    active
                      ? 'border-brand-200 bg-brand-50 text-brand-900 shadow-sm'
                      : 'border-white/70 bg-white text-ink-800 hover:border-brand-100 hover:bg-brand-50/50',
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium leading-5">{option.label}</p>
                    {option.meta ? (
                      <p className="text-xs leading-5 text-ink-500">{option.meta}</p>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                      active
                        ? 'border-brand-300 bg-brand-600 text-white'
                        : 'border-slate-200 bg-white text-transparent',
                    )}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="px-1 py-3 text-sm text-ink-500">{emptyMessage}</p>
        )}
      </div>

      {error ? (
        <span className="text-xs text-danger-500">{error}</span>
      ) : hint ? (
        <span className="text-xs text-ink-500">{hint}</span>
      ) : null}
    </div>
  )
}

export default MultiOptionField
