import type { LucideIcon } from 'lucide-react'

import { cn } from '../../utils/cn'

interface StatCardProps {
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  accent?: 'brand' | 'amber' | 'emerald'
}

const accentClasses = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = 'brand',
}: StatCardProps) {
  return (
    <article className="app-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="text-sm font-medium text-ink-600">{label}</p>
          <p className="text-3xl font-semibold tracking-tight text-ink-950">{value}</p>
          {hint ? <p className="text-sm text-ink-500">{hint}</p> : null}
        </div>
        <span
          className={cn(
            'inline-flex h-11 w-11 items-center justify-center rounded-2xl ring-1',
            accentClasses[accent],
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </article>
  )
}

export default StatCard
