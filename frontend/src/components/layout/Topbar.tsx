import { ChevronRight, Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'

import RoleMenu from './RoleMenu'
import { getRouteMetaForRole } from '../../constants/nav'
import { useAuth } from '../../hooks/useAuth'

interface TopbarProps {
  onOpenSidebar: () => void
}

function Topbar({ onOpenSidebar }: TopbarProps) {
  const { pathname } = useLocation()
  const { currentUser } = useAuth()
  const routeMeta = currentUser ? getRouteMetaForRole(currentUser.role, pathname) : null

  return (
    <header className="sticky top-0 z-20 mb-6 flex items-center justify-between gap-3 rounded-[28px] border border-white/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur md:gap-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-ink-700 transition hover:border-brand-200 hover:bg-brand-50 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-brand-600">
            {routeMeta?.sectionLabel ?? 'Smart Classroom'}
          </p>
          {routeMeta?.breadcrumbs?.length ? (
            <div className="hidden items-center gap-1 text-sm text-ink-500 md:flex">
              {routeMeta.breadcrumbs.map((item, index) => (
                <div key={`${item.label}-${index}`} className="flex items-center gap-1">
                  {index > 0 ? <ChevronRight className="h-3.5 w-3.5 text-ink-300" /> : null}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          ) : null}
          <h1 className="truncate text-lg font-semibold tracking-tight text-ink-950 md:text-2xl">
            {routeMeta?.title ?? 'Smart Attendance'}
          </h1>
        </div>
      </div>
      <RoleMenu />
    </header>
  )
}

export default Topbar
