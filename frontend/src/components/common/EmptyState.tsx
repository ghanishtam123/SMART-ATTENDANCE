import { Sparkles, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description: string
  action?: ReactNode
  icon?: LucideIcon
}

function EmptyState({
  title,
  description,
  action,
  icon: Icon = Sparkles,
}: EmptyStateProps) {
  return (
    <div className="app-surface p-8 text-center md:p-10">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          <Icon className="h-6 w-6" />
        </span>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-950">{title}</h2>
          <p className="text-balance text-sm leading-6 text-ink-600 md:text-base">
            {description}
          </p>
        </div>
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </div>
  )
}

export default EmptyState
