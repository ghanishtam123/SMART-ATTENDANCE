import { LoaderCircle } from 'lucide-react'

interface FormActionsProps {
  submitLabel: string
  loadingLabel?: string
  isSubmitting?: boolean
  onCancel?: () => void
  cancelLabel?: string
}

function FormActions({
  submitLabel,
  loadingLabel = 'Please wait...',
  isSubmitting = false,
  onCancel,
  cancelLabel = 'Cancel',
}: FormActionsProps) {
  return (
    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-ink-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {cancelLabel}
        </button>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:min-w-36"
      >
        {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        {isSubmitting ? loadingLabel : submitLabel}
      </button>
    </div>
  )
}

export default FormActions
