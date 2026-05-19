import { useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

import Sidebar from './Sidebar'
import Topbar from './Topbar'

interface AppShellProps {
  children: ReactNode
}

function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen px-3 py-3 md:px-4 lg:h-screen lg:overflow-hidden">
      <div className="mx-auto grid max-w-[1600px] gap-4 lg:h-full lg:grid-cols-[290px_minmax(0,1fr)]">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="min-w-0 lg:flex lg:min-h-0 lg:flex-col">
          <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
          <main
            key={pathname}
            className="app-shell-surface min-h-[calc(100vh-7rem)] p-4 md:p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

export default AppShell
