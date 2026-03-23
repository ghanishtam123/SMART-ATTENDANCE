import { forwardRef, type SelectHTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

export interface SelectOption {
  label: string
  value: string
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: SelectOption[]
  error?: string
  hint?: string
  placeholder?: string
}

const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  (
    { label, options, error, hint, className, placeholder, multiple, ...props },
    ref,
  ) => {
    return (
      <label className="block space-y-2">
        <span className="text-sm font-medium text-ink-800">{label}</span>
        <select
          ref={ref}
          multiple={multiple}
          className={cn(
            'w-full rounded-2xl border bg-white px-4 py-3 text-sm text-ink-950 shadow-sm transition',
            multiple ? 'min-h-32' : '',
            error
              ? 'border-danger-500/40 ring-2 ring-danger-500/10'
              : 'border-slate-200 focus:border-brand-300 focus:ring-2 focus:ring-brand-100',
            className,
          )}
          {...props}
        >
          {!multiple && placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error ? (
          <span className="text-xs text-danger-500">{error}</span>
        ) : hint ? (
          <span className="text-xs text-ink-500">{hint}</span>
        ) : null}
      </label>
    )
  },
)

SelectField.displayName = 'SelectField'

export default SelectField
