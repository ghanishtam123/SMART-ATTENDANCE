import {
  Activity,
  BellRing,
  ClipboardCheck,
  Presentation,
} from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import StatCard from '../../components/common/StatCard'
import { routes } from '../../constants/routes'

function TeacherDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: routes.dashboard }]}
        eyebrow="Teacher Overview"
        title="Session delivery and attendance review"
        description="Teachers land here after login. Session, attendance, analytics, alerts, and live monitoring routes are protected and ready for the next UI phase."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sessions" value="Ready" hint="Session workspace shell." icon={Presentation} />
        <StatCard
          label="Attendance"
          value="Protected"
          hint="Teacher-scoped route access enforced."
          icon={ClipboardCheck}
          accent="emerald"
        />
        <StatCard label="Alerts" value="Visible" hint="Unknown-face review flow next." icon={BellRing} accent="amber" />
        <StatCard label="Live" value="Polling-ready" hint="Live monitoring shell next." icon={Activity} />
      </div>
    </div>
  )
}

export default TeacherDashboardPage
