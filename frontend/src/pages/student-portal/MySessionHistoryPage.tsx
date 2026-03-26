import { useQuery } from '@tanstack/react-query'
import { CalendarRange, ClipboardList, Clock3, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'

import { studentPortalApi } from '../../api/studentPortal.api'
import AttendanceStatusBadge from '../../components/common/AttendanceStatusBadge'
import EmptyState from '../../components/common/EmptyState'
import ErrorMessage from '../../components/common/ErrorMessage'
import Loader from '../../components/common/Loader'
import PageHeader from '../../components/common/PageHeader'
import StatCard from '../../components/common/StatCard'
import DataTable, { type DataTableColumn } from '../../components/tables/DataTable'
import { routes } from '../../constants/routes'
import type { AttendanceStatus } from '../../types/attendance'
import { attendanceStatusValues } from '../../types/attendance'
import type { StudentSessionHistoryItem } from '../../types/studentPortal'
import {
  formatDate,
  formatDateTime,
  formatTimeRange,
  getErrorMessage,
} from '../../utils/format'

const statusOptions = [
  { value: '', label: 'All statuses' },
  ...attendanceStatusValues.map((status) => ({
    value: status,
    label: status === 'left_early' ? 'Left Early' : status[0].toUpperCase() + status.slice(1),
  })),
]

const compactFilterClass =
  'flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm transition focus-within:border-brand-200 focus-within:ring-2 focus-within:ring-brand-100/70'

const compactFilterLabelClass =
  'text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400'

const compactFilterInputClass = 'w-full bg-transparent text-xs text-ink-950 outline-none'

function MySessionHistoryPage() {
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | ''>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const sessionHistoryQuery = useQuery({
    queryKey: ['student-portal', 'session-history', statusFilter, fromDate, toDate],
    queryFn: () =>
      studentPortalApi.getSessionHistory({
        page: 1,
        limit: 100,
        status: statusFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      }),
  })

  const sessions = useMemo(
    () => sessionHistoryQuery.data?.items ?? [],
    [sessionHistoryQuery.data?.items],
  )
  const sessionCount = sessionHistoryQuery.data?.meta.totalItems ?? sessions.length

  const summary = useMemo(() => {
    if (!sessions.length) {
      return {
        positiveCount: 0,
        averagePresenceMinutes: 0,
        finalizedCount: 0,
      }
    }

    const positiveCount = sessions.filter(
      (item) => item.attendanceStatus === 'present' || item.attendanceStatus === 'late',
    ).length
    const totalPresence = sessions.reduce(
      (sum, item) => sum + item.totalPresenceMinutes,
      0,
    )

    return {
      positiveCount,
      averagePresenceMinutes: totalPresence / sessions.length,
      finalizedCount: sessions.filter((item) => item.finalizedAt).length,
    }
  }, [sessions])

  const columns = useMemo<DataTableColumn<StudentSessionHistoryItem>[]>(
    () => [
      {
        key: 'session',
        header: 'Session',
        render: (item) => (
          <div className="space-y-1">
            <p className="font-semibold text-ink-950">
              {item.subject.code ?? 'SUB'} • {item.subject.name ?? item.title ?? 'Untitled session'}
            </p>
            <p className="text-xs text-ink-500">
              {formatDate(item.scheduledDate)} •{' '}
              {formatTimeRange(item.scheduledStartTime, item.scheduledEndTime)}
            </p>
          </div>
        ),
      },
      {
        key: 'attendance',
        header: 'Attendance',
        render: (item) => <AttendanceStatusBadge status={item.attendanceStatus} />,
      },
      {
        key: 'sessionStatus',
        header: 'Session Status',
        render: (item) => (
          <span className="text-sm capitalize text-ink-600">{item.sessionStatus}</span>
        ),
      },
      {
        key: 'classroom',
        header: 'Classroom',
        render: (item) => (
          <div className="space-y-1">
            <p>{item.classroom.code ?? item.classroom.name ?? 'Not set'}</p>
            <p className="text-xs text-ink-500">
              {item.classroom.building ?? 'Building not set'}
            </p>
          </div>
        ),
      },
      {
        key: 'presence',
        header: 'Presence',
        render: (item) => (
          <div className="space-y-1">
            <p>{item.totalPresenceMinutes} min</p>
            <p className="text-xs text-ink-500">
              {item.attendancePercentageInSession.toFixed(1)}% of session
            </p>
          </div>
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

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'My Session History' },
        ]}
        eyebrow="Student Portal"
        title="My Session History"
        description="Review your personal classroom session timeline and attendance outcomes."
      />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
        <label className={compactFilterClass}>
          <span className={compactFilterLabelClass}>Attendance status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as AttendanceStatus | '')}
            className={compactFilterInputClass}
          >
            {statusOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={compactFilterClass}>
          <span className={compactFilterLabelClass}>From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className={compactFilterInputClass}
          />
        </label>
        <label className={compactFilterClass}>
          <span className={compactFilterLabelClass}>To</span>
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className={compactFilterInputClass}
          />
        </label>
      </div>

      {sessionHistoryQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(
            sessionHistoryQuery.error,
            'Unable to load your session history.',
          )}
        />
      ) : sessionHistoryQuery.isLoading ? (
        <div className="app-surface p-6">
          <Loader label="Loading your session history..." />
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No session history found."
          description="Try adjusting the date range or attendance-status filter."
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Sessions"
              value={String(sessionCount)}
              hint="In current result set"
              icon={ClipboardList}
            />
            <StatCard
              label="Positive Outcomes"
              value={String(summary.positiveCount)}
              hint="Present or late"
              icon={ShieldCheck}
              accent="emerald"
            />
            <StatCard
              label="Average Presence"
              value={`${summary.averagePresenceMinutes.toFixed(1)} min`}
              hint="Across current sessions"
              icon={Clock3}
              accent="amber"
            />
            <StatCard
              label="Finalized"
              value={String(summary.finalizedCount)}
              hint={`${sessionCount - summary.finalizedCount} pending`}
              icon={CalendarRange}
            />
          </div>

          <DataTable
            data={sessions}
            columns={columns}
            getRowKey={(item) => item.attendanceRecordId}
            emptyTitle="No sessions found."
            emptyDescription="Try another filter combination."
          />
        </>
      )}
    </div>
  )
}

export default MySessionHistoryPage
