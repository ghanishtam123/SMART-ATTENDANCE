import type { ReactNode } from 'react'

import EmptyState from '../common/EmptyState'
import { cn } from '../../utils/cn'

export interface DataTableColumn<T> {
  key: string
  header: string
  className?: string
  headerClassName?: string
  render: (item: T) => ReactNode
}

interface DataTableProps<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  getRowKey: (item: T) => string
  emptyTitle?: string
  emptyDescription?: string
}

function DataTable<T>({
  data,
  columns,
  getRowKey,
  emptyTitle = 'No records yet.',
  emptyDescription = 'Create a new record to get started.',
}: DataTableProps<T>) {
  if (!data.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="app-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full min-w-[760px] divide-y divide-slate-200">
          <thead className="bg-slate-50/80">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-ink-500',
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white/60">
            {data.map((item) => (
              <tr key={getRowKey(item)} className="align-top">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn('px-5 py-4 text-sm text-ink-700', column.className)}
                  >
                    {column.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DataTable
