import type { ReactNode } from 'react'

import type { BreadcrumbItem } from '../../types/common'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  breadcrumbs?: BreadcrumbItem[]
}

function PageHeader({
  description,
  actions,
}: PageHeaderProps) {
  if (!description && !actions) {
    return null
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      {description ? (
        <p className="max-w-3xl text-sm leading-6 text-ink-600 md:text-base">
          {description}
        </p>
      ) : (
        <div />
      )}
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  )
}

export default PageHeader
