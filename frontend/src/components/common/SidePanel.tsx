import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '../../utils/cn'

interface SidePanelProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  widthClassName?: string
}

function SidePanel({
  open,
  title,
  description,
  onClose,
  children,
  widthClassName,
}: SidePanelProps) {
  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  if (!open || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-950/45 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <section
        className={cn(
          'relative flex h-full w-full max-w-2xl flex-col border-l border-white/70 bg-gradient-to-b from-white via-sand-50 to-slate-50 shadow-[0_28px_80px_rgba(13,23,40,0.18)]',
          widthClassName,
        )}
      >
        <header className="border-b border-slate-200/90 bg-white/92 px-5 py-5 backdrop-blur md:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-brand-600">
                Edit Workspace
              </p>
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold tracking-tight text-ink-950">
                  {title}
                </h2>
                {description ? (
                  <p className="max-w-xl text-sm leading-6 text-ink-600">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-ink-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
              aria-label="Close panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-6 md:px-6">{children}</div>
      </section>
    </div>,
    document.body,
  )
}

export default SidePanel
