import { cn } from '../../utils/cn'

interface AttendanceProgressProps {
  label: string
  percentage: number
  hint?: string
  tone?: 'brand' | 'success' | 'warning'
}

const toneClasses = {
  brand: 'bg-brand-600',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
}

function AttendanceProgress({
  label,
  percentage,
  hint,
  tone = 'brand',
}: AttendanceProgressProps) {
  const safePercentage = Math.max(0, Math.min(percentage, 100))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-700">{label}</p>
        <p className="text-sm font-semibold text-ink-950">
          {safePercentage.toFixed(1)}%
        </p>
      </div>
      <div className="h-2 rounded-full bg-slate-200">
        <div
          className={cn('h-full rounded-full transition-all', toneClasses[tone])}
          style={{ width: `${safePercentage}%` }}
        />
      </div>
      {hint ? <p className="text-xs text-ink-500">{hint}</p> : null}
    </div>
  )
}

export default AttendanceProgress
