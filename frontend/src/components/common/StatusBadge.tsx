import { cn } from '../../utils/cn'

interface StatusBadgeProps {
  label: string
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger'
}

const toneClasses = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  brand: 'border-brand-100 bg-brand-50 text-brand-700',
  success: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-100 bg-amber-50 text-amber-700',
  danger: 'border-danger-500/20 bg-danger-500/8 text-danger-500',
}

function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tracking-wide',
        toneClasses[tone],
      )}
    >
      {label}
    </span>
  )
}

export default StatusBadge
