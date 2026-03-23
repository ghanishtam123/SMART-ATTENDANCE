import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarRange, ClipboardList, ShieldCheck } from 'lucide-react'

import { studentPortalApi } from '../../api/studentPortal.api'
import AttendanceProgress from '../../components/common/AttendanceProgress'
import ErrorMessage from '../../components/common/ErrorMessage'
import Loader from '../../components/common/Loader'
import PageHeader from '../../components/common/PageHeader'
import StatCard from '../../components/common/StatCard'
import { routes } from '../../constants/routes'
import { getErrorMessage } from '../../utils/format'

function MyAttendanceOverviewPage() {
  const overviewQuery = useQuery({
    queryKey: ['student-portal', 'attendance-overview'],
    queryFn: () => studentPortalApi.getAttendanceOverview(),
  })

  if (overviewQuery.isLoading) {
    return (
      <div className="app-surface p-6">
        <Loader label="Loading your attendance overview..." />
      </div>
    )
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <ErrorMessage
        message={getErrorMessage(
          overviewQuery.error,
          'Unable to load your attendance overview.',
        )}
      />
    )
  }

  const overview = overviewQuery.data

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'My Attendance Overview' },
        ]}
        eyebrow="Student Portal"
        title="My Attendance Overview"
        description="A clear view of your current attendance standing and threshold status."
      />

      {overview.lowAttendanceStatus.isLowAttendance ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-amber-950">
                Your attendance needs attention
              </h2>
              <p className="text-sm text-amber-900/80">
                You are currently at {overview.attendancePercentage.toFixed(1)}%, below the warning threshold of {overview.lowAttendanceStatus.threshold}%.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Attendance Rate"
          value={`${overview.attendancePercentage.toFixed(1)}%`}
          hint={`${overview.attendedSessions}/${overview.totalSessions} sessions attended`}
          icon={ClipboardList}
        />
        <StatCard
          label="Present"
          value={String(overview.presentCount)}
          hint={`${overview.lateCount} late`}
          icon={ShieldCheck}
          accent="emerald"
        />
        <StatCard
          label="Absent"
          value={String(overview.absentCount)}
          hint={`${overview.leftEarlyCount} left early`}
          icon={CalendarRange}
          accent="amber"
        />
        <StatCard
          label="Threshold"
          value={`${overview.lowAttendanceStatus.threshold}%`}
          hint={
            overview.lowAttendanceStatus.isLowAttendance
              ? 'Below threshold'
              : 'Above threshold'
          }
          icon={AlertTriangle}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="app-surface p-6">
          <h2 className="text-lg font-semibold text-ink-950">Overall attendance</h2>
          <p className="mt-1 text-sm text-ink-500">
            Your current attendance percentage and participation mix.
          </p>

          <div className="mt-6 space-y-6">
            <AttendanceProgress
              label="Attendance percentage"
              percentage={overview.attendancePercentage}
              tone={overview.lowAttendanceStatus.isLowAttendance ? 'warning' : 'success'}
              hint={`${overview.attendedSessions} attended • ${overview.absentCount} absent`}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                  Positive outcomes
                </p>
                <p className="mt-2 text-2xl font-semibold text-ink-950">
                  {overview.presentCount + overview.lateCount}
                </p>
                <p className="mt-1 text-sm text-ink-500">Present and late combined</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                  Needs review
                </p>
                <p className="mt-2 text-2xl font-semibold text-ink-950">
                  {overview.absentCount + overview.leftEarlyCount}
                </p>
                <p className="mt-1 text-sm text-ink-500">Absent and left early combined</p>
              </div>
            </div>
          </div>
        </section>

        <section className="app-surface p-6">
          <h2 className="text-lg font-semibold text-ink-950">Status breakdown</h2>
          <p className="mt-1 text-sm text-ink-500">
            How your attendance decisions are currently distributed.
          </p>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
              <AttendanceProgress
                label="Present"
                percentage={overview.totalSessions ? (overview.presentCount / overview.totalSessions) * 100 : 0}
                tone="success"
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
              <AttendanceProgress
                label="Late"
                percentage={overview.totalSessions ? (overview.lateCount / overview.totalSessions) * 100 : 0}
                tone="brand"
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
              <AttendanceProgress
                label="Absent"
                percentage={overview.totalSessions ? (overview.absentCount / overview.totalSessions) * 100 : 0}
                tone="warning"
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
              <AttendanceProgress
                label="Left early"
                percentage={overview.totalSessions ? (overview.leftEarlyCount / overview.totalSessions) * 100 : 0}
                tone="brand"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default MyAttendanceOverviewPage
