import { forwardRef, type TextareaHTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  hint?: string
}

const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ label, error, hint, className, ...props }, ref) => {
    return (
      <label className="block space-y-2">
        <span className="text-sm font-medium text-ink-800">{label}</span>
        <textarea
          ref={ref}
          className={cn(
            'min-h-28 w-full rounded-2xl border bg-white px-4 py-3 text-sm text-ink-950 shadow-sm transition placeholder:text-ink-400',
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

TextAreaField.displayName = 'TextAreaField'

export default TextAreaField
