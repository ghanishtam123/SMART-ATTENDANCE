import { useQuery } from '@tanstack/react-query'
import { CalendarRange, ClipboardList, Gauge, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'

import { studentPortalApi } from '../../api/studentPortal.api'
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
import type { AttendanceStatus } from '../../types/attendance'
import { attendanceStatusValues } from '../../types/attendance'
import type { StudentAttendanceHistoryItem } from '../../types/studentPortal'
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

function MyAttendanceHistoryPage() {
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | ''>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const historyQuery = useQuery({
    queryKey: ['student-portal', 'attendance-history', statusFilter, fromDate, toDate],
    queryFn: () =>
      studentPortalApi.getAttendanceHistory({
        page: 1,
        limit: 100,
        status: statusFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      }),
  })

  const historyItems = useMemo(
    () => historyQuery.data?.items ?? [],
    [historyQuery.data?.items],
  )
  const recordCount = historyQuery.data?.meta.totalItems ?? historyItems.length

  const summary = useMemo(() => {
    if (!historyItems.length) {
      return {
        attendanceRate: 0,
        averagePresenceMinutes: 0,
        averageConfidence: null as number | null,
        finalizedCount: 0,
      }
    }

    const positiveStatuses = historyItems.filter(
      (item) => item.status === 'present' || item.status === 'late',
    ).length
    const totalPresence = historyItems.reduce(
      (sum, item) => sum + item.totalPresenceMinutes,
      0,
    )
    const confidenceValues = historyItems
      .map((item) => item.confidenceAverage)
      .filter((value): value is number => value !== null)
    const totalConfidence = confidenceValues.reduce((sum, value) => sum + value, 0)

    return {
      attendanceRate: (positiveStatuses / historyItems.length) * 100,
      averagePresenceMinutes: totalPresence / historyItems.length,
      averageConfidence: confidenceValues.length
        ? totalConfidence / confidenceValues.length
        : null,
      finalizedCount: historyItems.filter((item) => item.finalizedAt).length,
    }
  }, [historyItems])

  const columns = useMemo<DataTableColumn<StudentAttendanceHistoryItem>[]>(
    () => [
      {
        key: 'session',
        header: 'Session',
        render: (item) => (
          <div className="space-y-1">
            <p className="font-semibold text-ink-950">
              {item.subject.code ?? 'SUB'} • {item.subject.name ?? item.session.title ?? 'Untitled session'}
            </p>
            <p className="text-xs text-ink-500">
              {formatDate(item.session.scheduledDate)} •{' '}
              {formatTimeRange(
                item.session.scheduledStartTime,
                item.session.scheduledEndTime,
              )}
            </p>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (item) => <AttendanceStatusBadge status={item.status} />,
      },
      {
        key: 'observations',
        header: 'Observations',
        render: (item) => (
          <div className="space-y-1">
            <p>{item.eventCount} event(s)</p>
            <p className="text-xs text-ink-500">
              {item.confidenceAverage === null
                ? 'No confidence data'
                : `Avg confidence ${item.confidenceAverage.toFixed(2)}`}
            </p>
          </div>
        ),
      },
      {
        key: 'seen',
        header: 'First / Last Seen',
        render: (item) => (
          <div className="space-y-1">
            <p>{formatDateTime(item.firstSeenAt)}</p>
            <p className="text-xs text-ink-500">{formatDateTime(item.lastSeenAt)}</p>
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
          { label: 'My Attendance History' },
        ]}
        eyebrow="Student Portal"
        title="My Attendance History"
        description="Browse your personal session-by-session attendance records."
      />

      <div className="grid gap-4 xl:grid-cols-[220px_220px_220px]">
        <SelectField
          label="Status"
          value={statusFilter}
          options={statusOptions}
          onChange={(event) => setStatusFilter(event.target.value as AttendanceStatus | '')}
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
      </div>

      {historyQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(
            historyQuery.error,
            'Unable to load your attendance history.',
          )}
        />
      ) : historyQuery.isLoading ? (
        <div className="app-surface p-6">
          <Loader label="Loading your attendance history..." />
        </div>
      ) : historyItems.length === 0 ? (
        <EmptyState
          title="No attendance history found."
          description="Try changing the date range or status filter."
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Attendance Rate"
              value={`${summary.attendanceRate.toFixed(1)}%`}
              hint={`${recordCount} records`}
              icon={ClipboardList}
            />
            <StatCard
              label="Average Presence"
              value={`${summary.averagePresenceMinutes.toFixed(1)} min`}
              hint="Across current results"
              icon={CalendarRange}
              accent="amber"
            />
            <StatCard
              label="Average Confidence"
              value={
                summary.averageConfidence === null
                  ? 'N/A'
                  : summary.averageConfidence.toFixed(2)
              }
              hint="Recognition confidence average"
              icon={Gauge}
              accent="emerald"
            />
            <StatCard
              label="Finalized"
              value={String(summary.finalizedCount)}
              hint={`${recordCount - summary.finalizedCount} pending`}
              icon={ShieldCheck}
            />
          </div>

          <DataTable
            data={historyItems}
            columns={columns}
            getRowKey={(item) => item.attendanceRecordId}
            emptyTitle="No history records found."
            emptyDescription="Try another filter combination."
          />
        </>
      )}
    </div>
  )
}

export default MyAttendanceHistoryPage
