import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  RotateCcw,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { attendanceApi } from '../../api/attendance.api'
import { classGroupsApi } from '../../api/classGroups.api'
import { sessionsApi } from '../../api/sessions.api'
import { studentsApi } from '../../api/students.api'
import { subjectsApi } from '../../api/subjects.api'
import AttendanceStatusBadge from '../../components/common/AttendanceStatusBadge'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import EmptyState from '../../components/common/EmptyState'
import ErrorMessage from '../../components/common/ErrorMessage'
import Loader from '../../components/common/Loader'
import PageHeader from '../../components/common/PageHeader'
import StatCard from '../../components/common/StatCard'
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

type AttendanceActionType = 'recalculate' | 'finalize'

function AttendanceRecordsPage() {
  const queryClient = useQueryClient()
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | ''>('')
  const [actionTarget, setActionTarget] = useState<AttendanceActionType | null>(null)

  const sessionOptionsQuery = useQuery({
    queryKey: ['sessions', 'attendance-options'],
    queryFn: () => sessionsApi.listSessions({ page: 1, limit: 100 }),
  })

  const sessionSummaryQuery = useQuery({
    queryKey: ['attendance', 'session-summary', selectedSessionId],
    enabled: !!selectedSessionId,
    queryFn: () => attendanceApi.getSessionAttendanceSummary(selectedSessionId),
  })

  const recordsQuery = useQuery({
    queryKey: ['attendance', 'session-records', selectedSessionId, statusFilter],
    enabled: !!selectedSessionId,
    queryFn: () =>
      attendanceApi.getSessionAttendanceRecords(selectedSessionId, {
        page: 1,
        limit: 100,
        status: statusFilter || undefined,
      }),
  })

  const studentsQuery = useQuery({
    queryKey: ['students', 'attendance-records-reference'],
    queryFn: () => studentsApi.listStudents({ page: 1, limit: 100 }),
  })

  const classGroupsQuery = useQuery({
    queryKey: ['class-groups', 'attendance-records-reference'],
    queryFn: () => classGroupsApi.listClassGroups({ page: 1, limit: 100 }),
  })

  const subjectsQuery = useQuery({
    queryKey: ['subjects', 'attendance-records-reference'],
    queryFn: () => subjectsApi.listSubjects({ page: 1, limit: 100 }),
  })

  const sessionOptionMap = useMemo(
    () =>
      new Map(
        (sessionOptionsQuery.data?.items ?? []).map((session) => [
          session.id,
          session,
        ]),
      ),
    [sessionOptionsQuery.data?.items],
  )

  const sessionOptions = useMemo(
    () =>
      (sessionOptionsQuery.data?.items ?? []).map((session) => ({
        value: session.id,
        label: `${formatDate(session.scheduledDate)} • ${
          session.title?.trim() || session.id.slice(0, 8)
        }`,
      })),
    [sessionOptionsQuery.data?.items],
  )

  const studentLabelMap = useMemo(
    () =>
      new Map(
        (studentsQuery.data?.items ?? []).map((student) => [
          student.id,
          `${student.firstName} ${student.lastName}`,
        ]),
      ),
    [studentsQuery.data?.items],
  )

  const studentRollMap = useMemo(
    () =>
      new Map(
        (studentsQuery.data?.items ?? []).map((student) => [student.id, student.rollNumber]),
      ),
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

  const actionMutation = useMutation({
    mutationFn: async (action: AttendanceActionType) => {
      if (!selectedSessionId) {
        throw new Error('Select a session first.')
      }

      if (action === 'recalculate') {
        return attendanceApi.recalculateSessionAttendance(selectedSessionId)
      }

      return attendanceApi.finalizeSessionAttendance(selectedSessionId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attendance', 'session-summary', selectedSessionId] })
      await queryClient.invalidateQueries({ queryKey: ['attendance', 'session-records', selectedSessionId] })
      setActionTarget(null)
    },
  })

  const selectedSession =
    sessionSummaryQuery.data?.session ?? sessionOptionMap.get(selectedSessionId) ?? null
  const sessionSummary = sessionSummaryQuery.data ?? null

  const recordsCount =
    recordsQuery.data?.meta.totalItems ?? recordsQuery.data?.items.length ?? 0

  const referenceError = useMemo(() => {
    const errors = [
      sessionOptionsQuery.isError
        ? getErrorMessage(sessionOptionsQuery.error, 'Unable to load session options.')
        : null,
      studentsQuery.isError
        ? getErrorMessage(studentsQuery.error, 'Unable to load students.')
        : null,
      classGroupsQuery.isError
        ? getErrorMessage(classGroupsQuery.error, 'Unable to load class groups.')
        : null,
      subjectsQuery.isError
        ? getErrorMessage(subjectsQuery.error, 'Unable to load subjects.')
        : null,
    ].filter(Boolean)

    return errors[0] ?? null
  }, [
    classGroupsQuery.error,
    classGroupsQuery.isError,
    sessionOptionsQuery.error,
    sessionOptionsQuery.isError,
    studentsQuery.error,
    studentsQuery.isError,
    subjectsQuery.error,
    subjectsQuery.isError,
  ])

  const columns = useMemo<DataTableColumn<AttendanceRecord>[]>(
    () => [
      {
        key: 'student',
        header: 'Student',
        render: (record) => (
          <div className="space-y-1">
            <p className="font-semibold text-ink-950">
              {studentLabelMap.get(record.studentId ?? '') ?? 'Student not loaded'}
            </p>
            <p className="text-xs text-ink-500">
              {studentRollMap.get(record.studentId ?? '') ?? record.studentId ?? 'Unknown'}
            </p>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (record) => <AttendanceStatusBadge status={record.status} />,
      },
      {
        key: 'events',
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
        key: 'firstSeen',
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
    [studentLabelMap, studentRollMap],
  )

  const actionCopy = useMemo(() => {
    if (!actionTarget) {
      return null
    }

    if (actionTarget === 'recalculate') {
      return {
        title: 'Recalculate attendance?',
        description:
          'Attendance records will be recalculated from the current recognition observations.',
        confirmLabel: 'Recalculate',
        tone: 'brand' as const,
      }
    }

    return {
      title: 'Finalize attendance?',
      description:
        'Attendance results will be finalized for the selected session.',
      confirmLabel: 'Finalize',
      tone: 'danger' as const,
    }
  }, [actionTarget])

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'Attendance Records' },
        ]}
        eyebrow="Attendance"
        title="Attendance Records"
        description="Inspect session attendance outcomes and rerun the backend attendance logic when needed."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={!selectedSessionId}
              onClick={() => setActionTarget('recalculate')}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-ink-700 transition hover:border-brand-200 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Recalculate
            </button>
            <button
              type="button"
              disabled={!selectedSessionId}
              onClick={() => setActionTarget('finalize')}
              className="inline-flex items-center gap-2 rounded-2xl bg-ink-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              Finalize
            </button>
          </div>
        }
      />

      {referenceError ? <ErrorMessage message={referenceError} /> : null}
      {actionMutation.isError ? (
        <ErrorMessage
          message={getErrorMessage(
            actionMutation.error,
            'Unable to update session attendance.',
          )}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <SelectField
          label="Session"
          value={selectedSessionId}
          options={sessionOptions}
          placeholder="Select a session"
          onChange={(event) => setSelectedSessionId(event.target.value)}
        />
        <SelectField
          label="Status"
          value={statusFilter}
          options={statusOptions}
          onChange={(event) => setStatusFilter(event.target.value as AttendanceStatus | '')}
        />
      </div>

      {!selectedSessionId ? (
        <EmptyState
          title="Select a session to inspect attendance."
          description="Choose a classroom session to load the generated attendance summary and detailed student-level records."
        />
      ) : sessionSummaryQuery.isLoading ? (
        <div className="app-surface p-6">
          <Loader label="Loading attendance summary..." />
        </div>
      ) : sessionSummaryQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(
            sessionSummaryQuery.error,
            'Unable to load the selected session summary.',
          )}
        />
      ) : !sessionSummary ? (
        <ErrorMessage message="Attendance summary data is unavailable for this session." />
      ) : (
        <>
          {selectedSession ? (
            <div className="app-surface p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-ink-500">Selected session</p>
                  <h2 className="text-xl font-semibold text-ink-950">
                    {selectedSession.title?.trim() ||
                      subjectLabelMap.get(selectedSession.subjectId ?? '') ||
                      'Untitled session'}
                  </h2>
                  <p className="text-sm text-ink-600">
                    {formatDate(selectedSession.scheduledDate)} •{' '}
                    {formatTimeRange(
                      selectedSession.scheduledStartTime,
                      selectedSession.scheduledEndTime,
                    )}
                  </p>
                </div>
                <div className="space-y-1 text-sm text-ink-600">
                  <p>
                    Class group:{' '}
                    {classGroupLabelMap.get(selectedSession.classGroupId ?? '') ?? 'Not linked'}
                  </p>
                  <p>
                    Subject:{' '}
                    {subjectLabelMap.get(selectedSession.subjectId ?? '') ?? 'Not linked'}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Attendance Rate"
              value={`${sessionSummary.attendancePercentage.toFixed(1)}%`}
              hint={`${sessionSummary.presentCount + sessionSummary.lateCount} marked present or late`}
              icon={ClipboardList}
            />
            <StatCard
              label="Students"
              value={String(sessionSummary.totalStudents)}
              hint={`${sessionSummary.recordsGenerated} records generated`}
              icon={Users}
              accent="amber"
            />
            <StatCard
              label="Final Statuses"
              value={`${sessionSummary.presentCount}/${sessionSummary.absentCount}`}
              hint={`${sessionSummary.presentCount} present • ${sessionSummary.absentCount} absent`}
              icon={CalendarClock}
              accent="emerald"
            />
            <StatCard
              label="Unknown Face Alerts"
              value={String(sessionSummary.unknownFaceAlertCount)}
              hint={`${sessionSummary.leftEarlyCount} left early • ${sessionSummary.lateCount} late`}
              icon={AlertTriangle}
            />
          </div>

          <div className="app-surface p-5">
            <div className="flex flex-wrap items-center gap-3">
              <AttendanceStatusBadge status="present" />
              <span className="text-sm text-ink-600">
                {sessionSummary.presentCount} present
              </span>
              <AttendanceStatusBadge status="late" />
              <span className="text-sm text-ink-600">
                {sessionSummary.lateCount} late
              </span>
              <AttendanceStatusBadge status="absent" />
              <span className="text-sm text-ink-600">
                {sessionSummary.absentCount} absent
              </span>
              <AttendanceStatusBadge status="left_early" />
              <span className="text-sm text-ink-600">
                {sessionSummary.leftEarlyCount} left early
              </span>
            </div>
          </div>

          {recordsQuery.isLoading ? (
            <div className="app-surface p-6">
              <Loader label="Loading attendance records..." />
            </div>
          ) : recordsQuery.isError ? (
            <ErrorMessage
              message={getErrorMessage(
                recordsQuery.error,
                'Unable to load attendance records.',
              )}
            />
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <p className="text-sm text-ink-500">{recordsCount} records</p>
              </div>
              <DataTable
                data={recordsQuery.data?.items ?? []}
                columns={columns}
                getRowKey={(record) => record.id}
                emptyTitle="No attendance records found."
                emptyDescription="Try another status filter or recalculate the selected session."
              />
            </>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!actionTarget}
        title={actionCopy?.title ?? 'Update attendance?'}
        description={actionCopy?.description}
        confirmLabel={actionCopy?.confirmLabel ?? 'Continue'}
        tone={actionCopy?.tone ?? 'brand'}
        isLoading={actionMutation.isPending}
        onCancel={() => setActionTarget(null)}
        onConfirm={async () => {
          if (actionTarget) {
            await actionMutation.mutateAsync(actionTarget)
          }
        }}
      />
    </div>
  )
}

export default AttendanceRecordsPage
