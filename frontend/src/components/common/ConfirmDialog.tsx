import { AlertTriangle, LoaderCircle } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '../../utils/cn'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'brand' | 'danger'
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const confirmButtonToneClasses = {
  brand: 'bg-ink-950 text-white hover:bg-ink-800',
  danger: 'bg-danger-500 text-white hover:bg-danger-500/90',
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'brand',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isLoading, onCancel, open])

  if (!open || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/45 px-4 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={isLoading ? undefined : onCancel}
        aria-hidden="true"
      />
      <div className="app-surface relative z-10 w-full max-w-md p-6">
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight text-ink-950">
                {title}
              </h2>
              {description ? (
                <p className="text-sm leading-6 text-ink-600">{description}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-ink-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60',
                confirmButtonToneClasses[tone],
              )}
            >
              {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              <span>{confirmLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default ConfirmDialog
