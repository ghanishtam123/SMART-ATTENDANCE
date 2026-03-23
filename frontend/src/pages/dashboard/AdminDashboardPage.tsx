import {
  Activity,
  Building2,
  CalendarClock,
  Users,
} from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import StatCard from '../../components/common/StatCard'
import { routes } from '../../constants/routes'

function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: routes.dashboard }]}
        eyebrow="Admin Overview"
        title="Platform operations at a glance"
        description="This is the authenticated landing zone for super admins and admins. Detailed data widgets and module pages will be connected in the next phases."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="User management"
          value="Ready"
          hint="Role-aware admin tools are next."
          icon={Users}
        />
        <StatCard
          label="Academic setup"
          value="Structured"
          hint="Class groups, rooms, subjects, teachers."
          icon={Building2}
          accent="amber"
        />
        <StatCard
          label="Timetable + sessions"
          value="Connected"
          hint="Navigation and access are in place."
          icon={CalendarClock}
          accent="emerald"
        />
        <StatCard
          label="Monitoring stack"
          value="Guarded"
          hint="Attendance, alerts, analytics, live."
          icon={Activity}
        />
      </div>
    </div>
  )
}

export default AdminDashboardPage
