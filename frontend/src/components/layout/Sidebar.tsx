import { LogOut, X } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'

import {
  getNavSectionsForRole,
  matchNavItem,
} from '../../constants/nav'
import { routes } from '../../constants/routes'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../utils/cn'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { pathname } = useLocation()
  const { currentUser, logout } = useAuth()

  if (!currentUser) {
    return null
  }

  const navSections = getNavSectionsForRole(currentUser.role)

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-30 bg-ink-950/45 backdrop-blur-sm transition lg:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed inset-y-3 left-3 z-40 flex w-[290px] flex-col overflow-hidden rounded-[30px] border border-white/70 bg-ink-950 text-white shadow-[0_28px_80px_rgba(13,23,40,0.35)] transition duration-300 lg:sticky lg:top-3 lg:h-[calc(100vh-1.5rem)] lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-[120%] lg:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <NavLink to={routes.dashboard} className="space-y-1" onClick={onClose}>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-brand-200">
              Smart Attendance
            </p>
            <p className="text-lg font-semibold tracking-tight">Control Center</p>
          </NavLink>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 text-white/70 transition hover:bg-white/10 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {navSections.map((section) => (
            <div key={section.label} className="space-y-2">
              <p className="px-3 font-mono text-[11px] uppercase tracking-[0.28em] text-white/35">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map(({ label, to, icon: Icon, matchPaths }) => {
                  const active = matchNavItem({ label, to, icon: Icon, matchPaths }, pathname)

                  return (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition',
                        active
                          ? 'bg-white text-ink-950 shadow-sm'
                          : 'text-white/75 hover:bg-white/10 hover:text-white',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
