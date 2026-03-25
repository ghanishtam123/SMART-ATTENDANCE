import { useQuery } from '@tanstack/react-query'
import {
  CalendarClock,
  ClipboardList,
  Gauge,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { attendanceApi } from '../../api/attendance.api'
import { classGroupsApi } from '../../api/classGroups.api'
import { sessionsApi } from '../../api/sessions.api'
import { studentsApi } from '../../api/students.api'
import { subjectsApi } from '../../api/subjects.api'
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
import type { AttendanceRecord, AttendanceStatus } from '../../types/attendance'
import { attendanceStatusValues } from '../../types/attendance'
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

function StudentAttendanceHistoryPage() {
  const [studentId, setStudentId] = useState('')
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | ''>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const studentsQuery = useQuery({
    queryKey: ['students', 'attendance-history-options'],
    queryFn: () => studentsApi.listStudents({ page: 1, limit: 100 }),
  })

  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'attendance-history-reference'],
    queryFn: () => sessionsApi.listSessions({ page: 1, limit: 100 }),
  })

  const subjectsQuery = useQuery({
    queryKey: ['subjects', 'attendance-history-reference'],
    queryFn: () => subjectsApi.listSubjects({ page: 1, limit: 100 }),
  })

  const classGroupsQuery = useQuery({
    queryKey: ['class-groups', 'attendance-history-reference'],
    queryFn: () => classGroupsApi.listClassGroups({ page: 1, limit: 100 }),
  })

  const historyQuery = useQuery({
    queryKey: ['attendance', 'student-history', studentId, statusFilter, fromDate, toDate],
    enabled: !!studentId,
    queryFn: () =>
      attendanceApi.getStudentAttendanceHistory(studentId, {
        page: 1,
        limit: 100,
        status: statusFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      }),
  })

  const studentMap = useMemo(
    () =>
      new Map((studentsQuery.data?.items ?? []).map((student) => [student.id, student])),
    [studentsQuery.data?.items],
  )

  const studentOptions = useMemo(
    () =>
      (studentsQuery.data?.items ?? []).map((student) => ({
        value: student.id,
        label: `${student.rollNumber} • ${student.firstName} ${student.lastName}`,
      })),
    [studentsQuery.data?.items],
  )

  const classGroupLabelMap = useMemo(
    () =>
      new Map(
        (classGroupsQuery.data?.items ?? []).map((group) => [
          group.id,
          `${group.code} • ${group.name}`,
        ]),
      ),
    [classGroupsQuery.data?.items],
  )

  const subjectLabelMap = useMemo(
    () =>
      new Map(
        (subjectsQuery.data?.items ?? []).map((subject) => [
          subject.id,
          `${subject.code} • ${subject.name}`,
        ]),
      ),
    [subjectsQuery.data?.items],
  )

  const sessionMap = useMemo(
    () =>
      new Map((sessionsQuery.data?.items ?? []).map((session) => [session.id, session])),
    [sessionsQuery.data?.items],
  )

  const selectedStudent = studentMap.get(studentId) ?? null
  const historyRecords = useMemo(
    () => historyQuery.data?.items ?? [],
    [historyQuery.data?.items],
  )
  const historyCount = historyQuery.data?.meta.totalItems ?? historyRecords.length

  const summaryMetrics = useMemo(() => {
    if (!historyRecords.length) {
      return {
        attendanceRate: 0,
        averagePresenceMinutes: 0,
        averageConfidence: null as number | null,
        finalizedCount: 0,
      }
    }

    const positiveStatuses = historyRecords.filter(
      (record) => record.status === 'present' || record.status === 'late',
    ).length
    const totalPresenceMinutes = historyRecords.reduce(
      (total, record) => total + record.totalPresenceMinutes,
      0,
    )
    const confidenceValues = historyRecords
      .map((record) => record.confidenceAverage)
      .filter((value): value is number => value !== null)
    const totalConfidence = confidenceValues.reduce((total, value) => total + value, 0)

    return {
      attendanceRate: (positiveStatuses / historyRecords.length) * 100,
      averagePresenceMinutes: totalPresenceMinutes / historyRecords.length,
      averageConfidence: confidenceValues.length
        ? totalConfidence / confidenceValues.length
        : null,
      finalizedCount: historyRecords.filter((record) => record.finalizedAt).length,
    }
  }, [historyRecords])

  const referenceError = useMemo(() => {
    const errors = [
      studentsQuery.isError
        ? getErrorMessage(studentsQuery.error, 'Unable to load students.')
        : null,
      sessionsQuery.isError
        ? getErrorMessage(sessionsQuery.error, 'Unable to load sessions.')
        : null,
      subjectsQuery.isError
        ? getErrorMessage(subjectsQuery.error, 'Unable to load subjects.')
        : null,
      classGroupsQuery.isError
        ? getErrorMessage(classGroupsQuery.error, 'Unable to load class groups.')
        : null,
    ].filter(Boolean)

    return errors[0] ?? null
  }, [
    classGroupsQuery.error,
    classGroupsQuery.isError,
    sessionsQuery.error,
    sessionsQuery.isError,
    studentsQuery.error,
    studentsQuery.isError,
    subjectsQuery.error,
    subjectsQuery.isError,
  ])

  const columns = useMemo<DataTableColumn<AttendanceRecord>[]>(
    () => [
      {
        key: 'session',
        header: 'Session',
        render: (record) => {
          const session = sessionMap.get(record.sessionId ?? '')

          return (
            <div className="space-y-1">
              <p className="font-semibold text-ink-950">
                {(session?.title?.trim() ||
                  subjectLabelMap.get(session?.subjectId ?? '') ||
                  record.sessionId) ??
                  'Unknown session'}
              </p>
              <p className="text-xs text-ink-500">
                {session
                  ? `${formatDate(session.scheduledDate)} • ${formatTimeRange(
                      session.scheduledStartTime,
                      session.scheduledEndTime,
                    )}`
                  : 'Session details unavailable'}
              </p>
            </div>
          )
        },
      },
      {
        key: 'status',
        header: 'Status',
        render: (record) => <AttendanceStatusBadge status={record.status} />,
      },
      {
        key: 'observations',
        header: 'Observations',
        render: (record) => (
          <div className="space-y-1">
            <p>{record.eventCount} event(s)</p>
            <p className="text-xs text-ink-500">
              {record.confidenceAverage === null
                ? 'No confidence data'
                : `Avg confidence ${record.confidenceAverage.toFixed(2)}`}
            </p>
          </div>
        ),
      },
      {
        key: 'firstLastSeen',
        header: 'First / Last Seen',
        render: (record) => (
          <div className="space-y-1">
            <p>{formatDateTime(record.firstSeenAt)}</p>
            <p className="text-xs text-ink-500">{formatDateTime(record.lastSeenAt)}</p>
          </div>
        ),
      },
      {
        key: 'presence',
        header: 'Presence',
        render: (record) => (
          <div className="space-y-1">
            <p>{record.totalPresenceMinutes} min</p>
            <p className="text-xs text-ink-500">
              {record.attendancePercentageInSession.toFixed(1)}% of session
            </p>
          </div>
        ),
      },
      {
        key: 'finalized',
        header: 'Finalized',
        render: (record) => (
          <span className="text-sm text-ink-600">
            {record.finalizedAt ? formatDateTime(record.finalizedAt) : 'Not finalized'}
          </span>
        ),
      },
    ],
    [sessionMap, subjectLabelMap],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'Student Attendance History' },
        ]}
        eyebrow="Attendance"
        title="Student Attendance History"
        description="Trace session-wise attendance results for an individual student."
      />

      {referenceError ? <ErrorMessage message={referenceError} /> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_220px_220px]">
        <SelectField
          label="Student"
          value={studentId}
          options={studentOptions}
          placeholder="Select student"
          onChange={(event) => setStudentId(event.target.value)}
        />
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

      {!studentId ? (
        <EmptyState
          title="Select a student to load attendance history."
          description="Choose a student and optional filters to review their per-session attendance outcomes, observations, and timestamps."
        />
      ) : historyQuery.isLoading ? (
        <div className="app-surface p-6">
          <Loader label="Loading student attendance history..." />
        </div>
      ) : historyQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(
            historyQuery.error,
            'Unable to load the selected student history.',
          )}
        />
      ) : (
        <>
          {selectedStudent ? (
            <div className="app-surface p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-ink-500">Selected student</p>
                  <h2 className="text-xl font-semibold text-ink-950">
                    {selectedStudent.firstName} {selectedStudent.lastName}
                  </h2>
                  <p className="text-sm text-ink-600">{selectedStudent.rollNumber}</p>
                </div>
                <div className="space-y-1 text-sm text-ink-600">
                  <p>
                    Class group:{' '}
                    {classGroupLabelMap.get(selectedStudent.classGroupId ?? '') ?? 'Not linked'}
                  </p>
                  <p>Status: {selectedStudent.status}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Attendance Rate"
              value={`${summaryMetrics.attendanceRate.toFixed(1)}%`}
              hint={`${historyCount} attendance records`}
              icon={ClipboardList}
            />
            <StatCard
              label="Average Presence"
              value={`${summaryMetrics.averagePresenceMinutes.toFixed(1)} min`}
              hint="Across the currently filtered records"
              icon={CalendarClock}
              accent="amber"
            />
            <StatCard
              label="Average Confidence"
              value={
                summaryMetrics.averageConfidence === null
                  ? 'N/A'
                  : summaryMetrics.averageConfidence.toFixed(2)
              }
              hint="Recognition confidence average"
              icon={Gauge}
              accent="emerald"
            />
            <StatCard
              label="Finalized Records"
              value={String(summaryMetrics.finalizedCount)}
              hint={`${historyCount - summaryMetrics.finalizedCount} still open`}
              icon={Users}
            />
          </div>

          <div className="flex items-center justify-between px-1">
            <p className="text-sm text-ink-500">{historyCount} history records</p>
          </div>

          <DataTable
            data={historyRecords}
            columns={columns}
            getRowKey={(record) => record.id}
            emptyTitle="No attendance history found."
            emptyDescription="Try a different status or date range for this student."
          />
        </>
      )}
    </div>
  )
}

export default StudentAttendanceHistoryPage
