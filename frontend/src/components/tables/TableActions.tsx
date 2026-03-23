import { PencilLine, Trash2 } from 'lucide-react'

import { cn } from '../../utils/cn'

interface TableActionsProps {
  onEdit?: () => void
  onDelete?: () => void
  deleteDisabled?: boolean
  className?: string
}

function TableActions({
  onEdit,
  onDelete,
  deleteDisabled = false,
  className,
}: TableActionsProps) {
  return (
    <div className={cn('flex items-center justify-end gap-2', className)}>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-ink-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
          aria-label="Edit record"
        >
          <PencilLine className="h-4 w-4" />
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleteDisabled}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-ink-600 transition hover:border-danger-500/20 hover:bg-danger-500/8 hover:text-danger-500 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Delete record"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  )
}

export default TableActions
