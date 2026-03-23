import { forwardRef, type InputHTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, error, hint, className, ...props }, ref) => {
    return (
      <label className="block space-y-2">
        <span className="text-sm font-medium text-ink-800">{label}</span>
        <input
          ref={ref}
          className={cn(
            'w-full rounded-2xl border bg-white px-4 py-3 text-sm text-ink-950 shadow-sm transition placeholder:text-ink-400',
            error
              ? 'border-danger-500/40 ring-2 ring-danger-500/10'
              : 'border-slate-200 focus:border-brand-300 focus:ring-2 focus:ring-brand-100',
            className,
          )}
          {...props}
        />
        {error ? (
          <span className="text-xs text-danger-500">{error}</span>
        ) : hint ? (
          <span className="text-xs text-ink-500">{hint}</span>
        ) : null}
      </label>
    )
  },
)

InputField.displayName = 'InputField'

export default InputField
