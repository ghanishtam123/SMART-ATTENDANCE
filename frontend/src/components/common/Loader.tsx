import { cn } from '../../utils/cn'

interface LoaderProps {
  label?: string
  className?: string
}

function Loader({ label = 'Loading...', className }: LoaderProps) {
  return (
    <div className={cn('inline-flex items-center gap-3 text-sm text-ink-600', className)}>
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      <span>{label}</span>
    </div>
  )
}

export default Loader
