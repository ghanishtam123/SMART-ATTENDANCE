import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  Clock3,
  ClipboardList,
  UserX,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { analyticsApi } from '../../api/analytics.api'
import { classGroupsApi } from '../../api/classGroups.api'
import AttendanceStatusBadge from '../../components/common/AttendanceStatusBadge'
import EmptyState from '../../components/common/EmptyState'
import ErrorMessage from '../../components/common/ErrorMessage'
import Loader from '../../components/common/Loader'
import PageHeader from '../../components/common/PageHeader'
import StatCard from '../../components/common/StatCard'
import InputField from '../../components/forms/InputField'
import SelectField from '../../components/forms/SelectField'
import DataTable, { type DataTableColumn } from '../../components/tables/DataTable'
import { routes } from '../../constants/routes'
import type { LateEntry, LowAttendanceStudent, SessionAbsentee } from '../../types/analytics'
import {
  formatDate,
  formatDateTime,
  formatTime,
  formatTimeRange,
  getErrorMessage,
} from '../../utils/format'
import { sessionsApi } from '../../api/sessions.api'

const overviewColors = ['#1d4ed8', '#10b981', '#f59e0b', '#64748b']

function SectionHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold text-ink-950">{title}</h2>
      <p className="text-sm text-ink-500">{description}</p>
    </div>
  )
}

function AnalyticsPage() {
  const [classGroupFilter, setClassGroupFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [threshold, setThreshold] = useState('75')
  const [absenteeSessionId, setAbsenteeSessionId] = useState('')

  const classGroupsQuery = useQuery({
    queryKey: ['class-groups', 'analytics-options'],
    queryFn: () => classGroupsApi.listClassGroups({ page: 1, limit: 100 }),
  })

  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'analytics-options', classGroupFilter],
    queryFn: () =>
      sessionsApi.listSessions({
        page: 1,
        limit: 100,
        classGroupId: classGroupFilter || undefined,
      }),
  })

  const overviewQuery = useQuery({
    queryKey: ['analytics', 'overview', classGroupFilter, fromDate, toDate],
    queryFn: () =>
      analyticsApi.getAttendanceOverview({
        classGroupId: classGroupFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      }),
  })

  const lowAttendanceQuery = useQuery({
    queryKey: ['analytics', 'low-attendance', classGroupFilter, fromDate, toDate, threshold],
    queryFn: () =>
      analyticsApi.getLowAttendanceStudents({
        page: 1,
        limit: 100,
        classGroupId: classGroupFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        threshold: threshold ? Number(threshold) : undefined,
      }),
  })

  const lateEntriesQuery = useQuery({
    queryKey: ['analytics', 'late-entries', classGroupFilter, fromDate, toDate],
    queryFn: () =>
      analyticsApi.getLateEntries({
        page: 1,
        limit: 100,
        classGroupId: classGroupFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      }),
  })

  const absenteesQuery = useQuery({
    queryKey: ['analytics', 'session-absentees', absenteeSessionId],
    enabled: !!absenteeSessionId,
    queryFn: () => analyticsApi.getSessionAbsentees(absenteeSessionId, { page: 1, limit: 100 }),
  })

  const classGroupOptions = useMemo(
    () =>
      (classGroupsQuery.data?.items ?? []).map((group) => ({
        value: group.id,
        label: `${group.code} • ${group.name}`,
      })),
    [classGroupsQuery.data?.items],
  )

  const sessionOptions = useMemo(
    () =>
      (sessionsQuery.data?.items ?? []).map((session) => ({
        value: session.id,
        label: `${formatDate(session.scheduledDate)} • ${
          session.title?.trim() || session.id.slice(0, 8)
        }`,
      })),
    [sessionsQuery.data?.items],
  )

  const overview = overviewQuery.data ?? null
  const lowAttendanceItems = useMemo(
    () => lowAttendanceQuery.data?.items ?? [],
    [lowAttendanceQuery.data?.items],
  )
  const lateEntriesItems = useMemo(
    () => lateEntriesQuery.data?.items ?? [],
    [lateEntriesQuery.data?.items],
  )
  const absenteesResult = absenteesQuery.data ?? null
  const absenteesItems = useMemo(
    () => absenteesResult?.items ?? [],
    [absenteesResult?.items],
  )

  const overviewChartData = useMemo(
    () =>
      overview
        ? [
            { label: 'Present', value: overview.presentCount },
            { label: 'Late', value: overview.lateCount },
            { label: 'Absent', value: overview.absentCount },
            { label: 'Left Early', value: overview.leftEarlyCount },
          ]
        : [],
    [overview],
  )

  const lowAttendanceChartData = useMemo(
    () =>
      lowAttendanceItems.slice(0, 8).map((student) => ({
        name: student.rollNumber,
        percentage: Number(student.attendancePercentage.toFixed(1)),
      })),
    [lowAttendanceItems],
  )

  const lateEntriesChartData = useMemo(
    () =>
      lateEntriesItems.slice(0, 8).map((entry) => ({
        name: entry.rollNumber,
        minutes: entry.lateByMinutes,
      })),
    [lateEntriesItems],
  )

  const absenteesChartData = useMemo(() => {
    if (!absenteesResult) {
      return []
    }

    return [
      {
        label: 'Absentees',
        value: absenteesItems.length,
      },
      {
        label: 'Finalized',
        value: absenteesItems.filter((item) => item.finalizedAt).length,
      },
      {
        label: 'With Remarks',
        value: absenteesItems.filter((item) => item.remarks?.trim()).length,
      },
    ]
  }, [absenteesItems, absenteesResult])

  const lowAttendanceColumns = useMemo<DataTableColumn<LowAttendanceStudent>[]>(
    () => [
      {
        key: 'student',
        header: 'Student',
        render: (student) => (
          <div className="space-y-1">
            <p className="font-semibold text-ink-950">{student.fullName}</p>
            <p className="text-xs text-ink-500">{student.rollNumber}</p>
          </div>
        ),
      },
      {
        key: 'classGroup',
        header: 'Class Group',
        render: (student) => (
          <span>
            {student.classGroup.code} • {student.classGroup.name}
          </span>
        ),
      },
      {
        key: 'attendance',
        header: 'Attendance',
        render: (student) => (
          <div className="space-y-1">
            <p>{student.attendancePercentage.toFixed(1)}%</p>
            <p className="text-xs text-ink-500">
              {student.attendedSessions}/{student.totalSessions} attended
            </p>
          </div>
        ),
      },
      {
        key: 'breakdown',
        header: 'Breakdown',
        render: (student) => (
          <div className="space-y-1 text-sm text-ink-600">
            <p>{student.presentCount} present</p>
            <p>{student.absentSessions} absent</p>
          </div>
        ),
      },
    ],
    [],
  )

  const lateEntriesColumns = useMemo<DataTableColumn<LateEntry>[]>(
    () => [
      {
        key: 'student',
        header: 'Student',
        render: (entry) => (
          <div className="space-y-1">
            <p className="font-semibold text-ink-950">{entry.fullName}</p>
            <p className="text-xs text-ink-500">{entry.rollNumber}</p>
          </div>
        ),
      },
      {
        key: 'session',
        header: 'Session',
        render: (entry) => (
          <div className="space-y-1">
            <p>{entry.sessionTitle?.trim() || entry.sessionId}</p>
            <p className="text-xs text-ink-500">
              {formatDate(entry.scheduledDate)} • {formatTime(entry.scheduledStartTime)}
            </p>
          </div>
        ),
      },
      {
        key: 'lateBy',
        header: 'Late By',
        render: (entry) => (
          <div className="space-y-1">
            <p>{entry.lateByMinutes} min</p>
            <p className="text-xs text-ink-500">{formatDateTime(entry.firstSeenAt)}</p>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Final Status',
        render: (entry) => <AttendanceStatusBadge status={entry.finalStatus} />,
      },
    ],
    [],
  )

  const absenteesColumns = useMemo<DataTableColumn<SessionAbsentee>[]>(
    () => [
      {
        key: 'student',
        header: 'Student',
        render: (item) => (
          <div className="space-y-1">
            <p className="font-semibold text-ink-950">{item.fullName}</p>
            <p className="text-xs text-ink-500">{item.rollNumber}</p>
          </div>
        ),
      },
      {
        key: 'contacts',
        header: 'Contact',
        render: (item) => (
          <div className="space-y-1 text-sm text-ink-600">
            <p>{item.email || 'No email'}</p>
            <p>{item.phone || 'No phone'}</p>
          </div>
        ),
      },
      {
        key: 'remarks',
        header: 'Remarks',
        render: (item) => (
          <span className="text-sm text-ink-600">{item.remarks?.trim() || 'No remarks'}</span>
        ),
      },
      {
        key: 'finalized',
        header: 'Finalized',
        render: (item) => (
          <span className="text-sm text-ink-600">
            {item.finalizedAt ? formatDateTime(item.finalizedAt) : 'Not finalized'}
          </span>
        ),
      },
    ],
    [],
  )

  const referenceError = useMemo(() => {
    const errors = [
      classGroupsQuery.isError
        ? getErrorMessage(classGroupsQuery.error, 'Unable to load class groups.')
        : null,
      sessionsQuery.isError
        ? getErrorMessage(sessionsQuery.error, 'Unable to load session options.')
        : null,
    ].filter(Boolean)

    return errors[0] ?? null
  }, [
    classGroupsQuery.error,
    classGroupsQuery.isError,
    sessionsQuery.error,
    sessionsQuery.isError,
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'Analytics' },
        ]}
        eyebrow="Insights"
        title="Attendance Analytics"
        description="Review overall attendance performance, identify low-attendance students, inspect late arrivals, and analyze session absentees."
      />

      {referenceError ? <ErrorMessage message={referenceError} /> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_220px_180px]">
        <SelectField
          label="Class Group"
          value={classGroupFilter}
          options={classGroupOptions}
          placeholder="All class groups"
          onChange={(event) => setClassGroupFilter(event.target.value)}
        />
        <InputField
          label="From"
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
        />
        <InputField
          label="To"
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
        />
        <InputField
          label="Low Attendance Threshold"
          type="number"
          min={1}
          max={100}
          value={threshold}
          onChange={(event) => setThreshold(event.target.value)}
        />
      </div>

      <section className="space-y-4">
        <SectionHeader
          title="Attendance Overview"
          description="High-level attendance performance across the selected time window."
        />

        {overviewQuery.isError ? (
          <ErrorMessage
            message={getErrorMessage(
              overviewQuery.error,
              'Unable to load attendance overview.',
            )}
          />
        ) : overviewQuery.isLoading ? (
          <div className="app-surface p-6">
            <Loader label="Loading overview..." />
          </div>
        ) : !overview ? (
          <EmptyState
            title="Overview is unavailable."
            description="No attendance overview could be loaded for the current filters."
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <StatCard
                label="Attendance Rate"
                value={`${overview.attendancePercentage.toFixed(1)}%`}
                hint={`${overview.totalSessions} sessions`}
                icon={ClipboardList}
              />
              <StatCard
                label="Students"
                value={String(overview.totalStudents)}
                hint="In current scope"
                icon={Users}
                accent="amber"
              />
              <StatCard
                label="Present + Late"
                value={String(overview.presentCount + overview.lateCount)}
                hint={`${overview.absentCount} absent`}
                icon={Clock3}
                accent="emerald"
              />
              <StatCard
                label="Left Early"
                value={String(overview.leftEarlyCount)}
                hint="Final left-early decisions"
                icon={UserX}
              />
              <StatCard
                label="Unknown Face Alerts"
                value={String(overview.unknownFaceAlertCount)}
                hint="Recognition alerts"
                icon={AlertTriangle}
              />
            </div>

            <div className="app-surface p-6">
              <div className="mb-4">
                <SectionHeader
                  title="Status Distribution"
                  description="Final attendance outcome mix for the current analytics window."
                />
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={overviewChartData}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={2}
                    >
                      {overviewChartData.map((entry, index) => (
                        <Cell
                          key={entry.label}
                          fill={overviewColors[index % overviewColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Low Attendance"
          description="Students who are currently below the configured attendance threshold."
        />

        {lowAttendanceQuery.isError ? (
          <ErrorMessage
            message={getErrorMessage(
              lowAttendanceQuery.error,
              'Unable to load low-attendance students.',
            )}
          />
        ) : lowAttendanceQuery.isLoading ? (
          <div className="app-surface p-6">
            <Loader label="Loading low-attendance data..." />
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="app-surface p-6">
              <div className="mb-4">
                <SectionHeader
                  title="Lowest Attendance Rates"
                  description="The first eight students with the weakest attendance percentage."
                />
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={lowAttendanceChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="name" type="category" width={80} />
                    <Tooltip />
                    <Bar dataKey="percentage" fill="#f59e0b" radius={[0, 10, 10, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <DataTable
              data={lowAttendanceItems}
              columns={lowAttendanceColumns}
              getRowKey={(student) => student.studentId}
              emptyTitle="No low-attendance students found."
              emptyDescription="Try a different threshold or class-group filter."
            />
          </div>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Late Entries"
          description="Students whose first recognition event crossed the late threshold."
        />

        {lateEntriesQuery.isError ? (
          <ErrorMessage
            message={getErrorMessage(lateEntriesQuery.error, 'Unable to load late entries.')}
          />
        ) : lateEntriesQuery.isLoading ? (
          <div className="app-surface p-6">
            <Loader label="Loading late-entry data..." />
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="app-surface p-6">
              <div className="mb-4">
                <SectionHeader
                  title="Late Minutes by Student"
                  description="The first eight late entries in the current analytics result set."
                />
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={lateEntriesChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="minutes" fill="#2563eb" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <DataTable
              data={lateEntriesItems}
              columns={lateEntriesColumns}
              getRowKey={(entry) => entry.attendanceRecordId}
              emptyTitle="No late entries found."
              emptyDescription="Adjust the filters or choose a broader date range."
            />
          </div>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Session Absentees"
          description="Inspect the absentee list for a selected session."
        />

        <div className="max-w-xl">
          <SelectField
            label="Session"
            value={absenteeSessionId}
            options={sessionOptions}
            placeholder="Select session"
            onChange={(event) => setAbsenteeSessionId(event.target.value)}
          />
        </div>

        {!absenteeSessionId ? (
          <EmptyState
            title="Select a session to inspect absentees."
            description="Choose one session from the filtered list to load its absentee analysis."
          />
        ) : absenteesQuery.isError ? (
          <ErrorMessage
            message={getErrorMessage(
              absenteesQuery.error,
              'Unable to load session absentees.',
            )}
          />
        ) : absenteesQuery.isLoading ? (
          <div className="app-surface p-6">
            <Loader label="Loading session absentees..." />
          </div>
        ) : !absenteesResult ? (
          <EmptyState
            title="Absentee data is unavailable."
            description="No absentee breakdown could be loaded for the selected session."
          />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="app-surface p-6">
              <div className="mb-4">
                <SectionHeader
                  title="Absentee Summary"
                  description={`Session: ${
                    absenteesResult.meta.session.title?.trim() ||
                    absenteesResult.meta.session.id
                  }`}
                />
              </div>
              <div className="mb-4 text-sm text-ink-500">
                {formatDate(absenteesResult.meta.session.scheduledDate)} •{' '}
                {formatTimeRange(
                  absenteesResult.meta.session.scheduledStartTime,
                  absenteesResult.meta.session.scheduledEndTime,
                )}
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={absenteesChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#475569" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <DataTable
              data={absenteesItems}
              columns={absenteesColumns}
              getRowKey={(item) => item.attendanceRecordId}
              emptyTitle="No absentees found."
              emptyDescription="The selected session currently has no absentee entries."
            />
          </div>
        )}
      </section>
    </div>
  )
}

export default AnalyticsPage
