import { Outlet } from 'react-router-dom'

import AppShell from '../components/layout/AppShell'

function DashboardLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export default DashboardLayout
