import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarRange,
  ClipboardList,
  UserCircle2,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { studentPortalApi } from '../../api/studentPortal.api'
import AttendanceProgress from '../../components/common/AttendanceProgress'
import AttendanceStatusBadge from '../../components/common/AttendanceStatusBadge'
import EmptyState from '../../components/common/EmptyState'
import ErrorMessage from '../../components/common/ErrorMessage'
import Loader from '../../components/common/Loader'
import PageHeader from '../../components/common/PageHeader'
import StatCard from '../../components/common/StatCard'
import { routes } from '../../constants/routes'
import { formatDate, formatTimeRange, getErrorMessage } from '../../utils/format'

function StudentDashboardPage() {
  const profileQuery = useQuery({
    queryKey: ['student-portal', 'me'],
    queryFn: () => studentPortalApi.getMe(),
  })

  const subjectsQuery = useQuery({
    queryKey: ['student-portal', 'subjects', 'dashboard'],
    queryFn: () => studentPortalApi.getSubjects({ page: 1, limit: 4 }),
  })

  const sessionHistoryQuery = useQuery({
    queryKey: ['student-portal', 'session-history', 'dashboard'],
    queryFn: () => studentPortalApi.getSessionHistory({ page: 1, limit: 5 }),
  })

  if (profileQuery.isLoading) {
    return (
      <div className="app-surface p-6">
        <Loader label="Loading your student portal..." />
      </div>
    )
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <ErrorMessage
        message={getErrorMessage(
          profileQuery.error,
          'Unable to load your student dashboard.',
        )}
      />
    )
  }

  const profile = profileQuery.data
  const overview = profile.attendanceOverview
  const subjects = subjectsQuery.data?.items ?? []
  const recentSessions = sessionHistoryQuery.data?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: routes.dashboard }]}
        eyebrow="Student Overview"
        title={`Welcome back, ${profile.student.firstName}`}
        description="Track your attendance, review recent sessions, and keep an eye on subjects that need attention."
      />

      {overview.lowAttendanceStatus.isLowAttendance ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-amber-950">
                  Low attendance warning
                </h2>
                <p className="text-sm text-amber-900/80">
                  Your attendance is {overview.attendancePercentage.toFixed(1)}%, which is below the {overview.lowAttendanceStatus.threshold}% threshold.
                </p>
              </div>
            </div>
            <Link
              to={routes.myAttendanceOverview}
              className="inline-flex items-center gap-2 rounded-2xl bg-amber-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-amber-700"
            >
              Review details
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Attendance"
          value={`${overview.attendancePercentage.toFixed(1)}%`}
          hint={`${overview.attendedSessions}/${overview.totalSessions} sessions attended`}
          icon={ClipboardList}
        />
        <StatCard
          label="Profile"
          value={profile.classGroup?.code ?? 'Linked'}
          hint={profile.classGroup?.name ?? 'Student account linked'}
          icon={UserCircle2}
          accent="emerald"
        />
        <StatCard
          label="Subjects"
          value={String(subjectsQuery.data?.meta.totalItems ?? subjects.length)}
          hint="Subject-wise attendance summary"
          icon={BookOpen}
          accent="amber"
        />
        <StatCard
          label="Session history"
          value={String(sessionHistoryQuery.data?.meta.totalItems ?? recentSessions.length)}
          hint="Recent personal session timeline"
          icon={CalendarRange}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="app-surface p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink-950">Attendance snapshot</h2>
              <p className="mt-1 text-sm text-ink-500">
                A quick view of your current attendance standing.
              </p>
            </div>
            <Link
              to={routes.myAttendanceOverview}
              className="text-sm font-medium text-brand-700 transition hover:text-brand-800"
            >
              View full overview
            </Link>
          </div>

          <div className="mt-6 space-y-5">
            <AttendanceProgress
              label="Overall attendance"
              percentage={overview.attendancePercentage}
              tone={overview.lowAttendanceStatus.isLowAttendance ? 'warning' : 'success'}
              hint={`${overview.presentCount} present • ${overview.lateCount} late • ${overview.absentCount} absent`}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                  Present and late
                </p>
                <p className="mt-2 text-2xl font-semibold text-ink-950">
                  {overview.presentCount + overview.lateCount}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                  Needs improvement
                </p>
                <p className="mt-2 text-2xl font-semibold text-ink-950">
                  {overview.absentCount + overview.leftEarlyCount}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="app-surface p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink-950">Profile summary</h2>
              <p className="mt-1 text-sm text-ink-500">
                Your linked account and academic details.
              </p>
            </div>
            <Link
              to={routes.myProfile}
              className="text-sm font-medium text-brand-700 transition hover:text-brand-800"
            >
              Open profile
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                Roll number
              </p>
              <p className="mt-2 text-sm font-medium text-ink-950">
                {profile.student.rollNumber}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                Class group
              </p>
              <p className="mt-2 text-sm font-medium text-ink-950">
                {profile.classGroup?.code ?? 'Not linked'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                Email
              </p>
              <p className="mt-2 text-sm font-medium text-ink-950">
                {profile.user.email}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                Face profile
              </p>
              <p className="mt-2 text-sm font-medium text-ink-950">
                {profile.faceProfile?.registrationStatus ?? 'Not registered'}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="app-surface p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink-950">Subject watchlist</h2>
              <p className="mt-1 text-sm text-ink-500">
                The subjects currently shaping your attendance picture.
              </p>
            </div>
            <Link
              to={routes.mySubjects}
              className="text-sm font-medium text-brand-700 transition hover:text-brand-800"
            >
              View subjects
            </Link>
          </div>

          {subjectsQuery.isError ? (
            <ErrorMessage
              message={getErrorMessage(
                subjectsQuery.error,
                'Unable to load your subject summary.',
              )}
            />
          ) : subjects.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="No subject data available."
                description="Subject-level attendance will appear here once session attendance records are available."
              />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {subjects.map((item) => (
                <div
                  key={item.subjectId}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-ink-950">
                        {item.subject.code ?? 'SUB'} • {item.subject.name ?? 'Untitled subject'}
                      </p>
                      <p className="text-sm text-ink-500">
                        {item.attendedSessions}/{item.totalSessions} sessions attended
                      </p>
                    </div>
                    {item.lowAttendanceStatus.isLowAttendance ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                        Needs attention
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4">
                    <AttendanceProgress
                      label="Attendance"
                      percentage={item.attendancePercentage}
                      tone={item.lowAttendanceStatus.isLowAttendance ? 'warning' : 'brand'}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="app-surface p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink-950">Recent sessions</h2>
              <p className="mt-1 text-sm text-ink-500">
                Your most recent attendance decisions.
              </p>
            </div>
            <Link
              to={routes.mySessionHistory}
              className="text-sm font-medium text-brand-700 transition hover:text-brand-800"
            >
              View session history
            </Link>
          </div>

          {sessionHistoryQuery.isError ? (
            <ErrorMessage
              message={getErrorMessage(
                sessionHistoryQuery.error,
                'Unable to load your recent sessions.',
              )}
            />
          ) : recentSessions.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="No recent sessions yet."
                description="Your personal session history will appear here after attendance is processed."
              />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {recentSessions.map((session) => (
                <div
                  key={session.attendanceRecordId}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold text-ink-950">
                        {session.subject.code ?? 'SUB'} • {session.subject.name ?? session.title ?? 'Untitled session'}
                      </p>
                      <p className="text-sm text-ink-500">
                        {formatDate(session.scheduledDate)} •{' '}
                        {formatTimeRange(
                          session.scheduledStartTime,
                          session.scheduledEndTime,
                        )}
                      </p>
                    </div>
                    <AttendanceStatusBadge status={session.attendanceStatus} />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                        Presence
                      </p>
                      <p className="mt-1 text-sm text-ink-900">
                        {session.totalPresenceMinutes} min
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                        Session status
                      </p>
                      <p className="mt-1 text-sm capitalize text-ink-900">
                        {session.sessionStatus}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                        First seen
                      </p>
                      <p className="mt-1 text-sm text-ink-900">
                        {session.firstSeenAt ? formatDate(session.firstSeenAt) : 'No detection'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default StudentDashboardPage
