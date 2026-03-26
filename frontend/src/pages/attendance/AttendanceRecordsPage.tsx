import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Eye,
  RotateCcw,
  ShieldCheck,
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
import SidePanel from '../../components/common/SidePanel'
import StatusBadge from '../../components/common/StatusBadge'
import InputField from '../../components/forms/InputField'
import SelectField from '../../components/forms/SelectField'
import DataTable, { type DataTableColumn } from '../../components/tables/DataTable'
import { routes } from '../../constants/routes'
import type { AttendanceRecord, AttendanceStatus } from '../../types/attendance'
import { attendanceStatusValues } from '../../types/attendance'
import type { Session, SessionStatus } from '../../types/session'
import { sessionStatusValues } from '../../types/session'
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

const sessionStatusOptions = [
  { value: '', label: 'All session states' },
  ...sessionStatusValues.map((status) => ({
    value: status,
    label: status[0].toUpperCase() + status.slice(1),
  })),
]

const sessionStatusToneMap: Record<
  SessionStatus,
  'neutral' | 'brand' | 'success' | 'warning'
> = {
  created: 'neutral',
  started: 'brand',
  active: 'brand',
  completed: 'success',
  archived: 'warning',
}

type AttendanceActionType = 'recalculate' | 'finalize'

function CompactStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">
          {label}
        </p>
        <p className="text-2xl font-semibold tracking-tight text-ink-950">{value}</p>
        <p className="text-xs leading-5 text-ink-500">{hint}</p>
      </div>
    </article>
  )
}

function AttendanceRecordsPage() {
  const queryClient = useQueryClient()
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [classGroupFilter, setClassGroupFilter] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [sessionStatusFilter, setSessionStatusFilter] = useState<SessionStatus | ''>('')
  const [recordStatusFilter, setRecordStatusFilter] = useState<AttendanceStatus | ''>('')
  const [actionTarget, setActionTarget] = useState<AttendanceActionType | null>(null)

  const sessionsQuery = useQuery({
    queryKey: [
      'sessions',
      'attendance-list',
      dateFilter,
      classGroupFilter,
      subjectFilter,
      sessionStatusFilter,
    ],
    queryFn: () =>
      sessionsApi.listSessions({
        page: 1,
        limit: 100,
        scheduledDate: dateFilter || undefined,
        classGroupId: classGroupFilter || undefined,
        subjectId: subjectFilter || undefined,
        status: sessionStatusFilter || undefined,
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

  const sessionMap = useMemo(
    () =>
      new Map(
        (sessionsQuery.data?.items ?? []).map((session) => [
          session.id,
          session,
        ]),
      ),
    [sessionsQuery.data?.items],
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

  const visibleSelectedSessionId =
    selectedSessionId && sessionMap.has(selectedSessionId) ? selectedSessionId : ''

  const sessionSummaryQuery = useQuery({
    queryKey: ['attendance', 'session-summary', visibleSelectedSessionId],
    enabled: !!visibleSelectedSessionId,
    queryFn: () => attendanceApi.getSessionAttendanceSummary(visibleSelectedSessionId),
  })

  const recordsQuery = useQuery({
    queryKey: ['attendance', 'session-records', visibleSelectedSessionId, recordStatusFilter],
    enabled: !!visibleSelectedSessionId,
    queryFn: () =>
      attendanceApi.getSessionAttendanceRecords(visibleSelectedSessionId, {
        page: 1,
        limit: 100,
        status: recordStatusFilter || undefined,
      }),
  })

  const actionMutation = useMutation({
    mutationFn: async (action: AttendanceActionType) => {
      if (!visibleSelectedSessionId) {
        throw new Error('Select a session first.')
      }

      if (action === 'recalculate') {
        return attendanceApi.recalculateSessionAttendance(visibleSelectedSessionId)
      }

      return attendanceApi.finalizeSessionAttendance(visibleSelectedSessionId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attendance', 'session-summary', visibleSelectedSessionId] })
      await queryClient.invalidateQueries({ queryKey: ['attendance', 'session-records', visibleSelectedSessionId] })
      setActionTarget(null)
    },
  })

  const selectedSession =
    sessionSummaryQuery.data?.session ?? sessionMap.get(visibleSelectedSessionId) ?? null
  const sessionSummary = sessionSummaryQuery.data ?? null
  const sessionsCount =
    sessionsQuery.data?.meta.totalItems ?? sessionsQuery.data?.items.length ?? 0

  const recordsCount =
    recordsQuery.data?.meta.totalItems ?? recordsQuery.data?.items.length ?? 0

  const referenceError = useMemo(() => {
    const errors = [
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

  const sessionColumns = useMemo<DataTableColumn<Session>[]>(
    () => [
      {
        key: 'session',
        header: 'Session',
        render: (session) => (
          <div className="space-y-1">
            <p className="font-semibold text-ink-950">
              {session.title?.trim() ||
                subjectLabelMap.get(session.subjectId ?? '') ||
                'Untitled session'}
            </p>
            <p className="text-xs text-ink-500">{session.id}</p>
          </div>
        ),
      },
      {
        key: 'schedule',
        header: 'Schedule',
        render: (session) => (
          <div className="space-y-1">
            <p>{formatDate(session.scheduledDate)}</p>
            <p className="text-xs text-ink-500">
              {formatTimeRange(session.scheduledStartTime, session.scheduledEndTime)}
            </p>
          </div>
        ),
      },
      {
        key: 'classGroup',
        header: 'Class / Subject',
        render: (session) => (
          <div className="space-y-1">
            <p>{classGroupLabelMap.get(session.classGroupId ?? '') ?? 'Not linked'}</p>
            <p className="text-xs text-ink-500">
              {subjectLabelMap.get(session.subjectId ?? '') ?? 'Not linked'}
            </p>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Session State',
        render: (session) => (
          <StatusBadge
            label={session.status[0].toUpperCase() + session.status.slice(1)}
            tone={sessionStatusToneMap[session.status]}
          />
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-32',
        headerClassName: 'text-right',
        render: (session) => (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setSelectedSessionId(session.id)}
              className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                selectedSessionId === session.id
                  ? 'border-brand-200 bg-brand-50 text-brand-700'
                  : 'border-slate-200 text-ink-600 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              {selectedSessionId === session.id ? 'Viewing' : 'View'}
            </button>
          </div>
        ),
      },
    ],
    [classGroupLabelMap, selectedSessionId, subjectLabelMap],
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
      />

      {referenceError ? <ErrorMessage message={referenceError} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InputField
          label="Date"
          type="date"
          value={dateFilter}
          onChange={(event) => setDateFilter(event.target.value)}
        />
        <SelectField
          label="Class group"
          value={classGroupFilter}
          options={[
            { value: '', label: 'All class groups' },
            ...((classGroupsQuery.data?.items ?? []).map((group) => ({
              value: group.id,
              label: `${group.code} • ${group.name}`,
            }))),
          ]}
          onChange={(event) => setClassGroupFilter(event.target.value)}
        />
        <SelectField
          label="Subject"
          value={subjectFilter}
          options={[
            { value: '', label: 'All subjects' },
            ...((subjectsQuery.data?.items ?? []).map((subject) => ({
              value: subject.id,
              label: `${subject.code} • ${subject.name}`,
            }))),
          ]}
          onChange={(event) => setSubjectFilter(event.target.value)}
        />
        <SelectField
          label="Session state"
          value={sessionStatusFilter}
          options={sessionStatusOptions}
          onChange={(event) => setSessionStatusFilter(event.target.value as SessionStatus | '')}
        />
      </div>

      {sessionsQuery.isLoading ? (
        <div className="app-surface p-6">
          <Loader label="Loading sessions..." />
        </div>
      ) : sessionsQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(
            sessionsQuery.error,
            'Unable to load sessions.',
          )}
        />
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-sm text-ink-500">{sessionsCount} sessions</p>
          </div>
          <DataTable
            data={sessionsQuery.data?.items ?? []}
            columns={sessionColumns}
            getRowKey={(session) => session.id}
            emptyTitle="No sessions found."
            emptyDescription="Adjust the filters to load session attendance data."
          />
        </>
      )}

      {!visibleSelectedSessionId ? (
        <EmptyState
          title="Choose a session to inspect attendance."
          description="Use the session list above, then tap View to open the attendance summary and student-level records."
        />
      ) : null}

      <SidePanel
        open={!!visibleSelectedSessionId}
        title={
          selectedSession?.title?.trim() ||
          subjectLabelMap.get(selectedSession?.subjectId ?? '') ||
          'Attendance Details'
        }
        description={
          selectedSession
            ? `${formatDate(selectedSession.scheduledDate)} • ${formatTimeRange(
                selectedSession.scheduledStartTime,
                selectedSession.scheduledEndTime,
              )}`
            : "Inspect session attendance outcomes and rerun the backend attendance logic when needed."
        }
        onClose={() => {
          setSelectedSessionId('')
          setRecordStatusFilter('')
          setActionTarget(null)
        }}
        widthClassName="max-w-[1100px]"
      >
        {!visibleSelectedSessionId ? null : sessionSummaryQuery.isLoading ? (
          <div className="app-surface p-4">
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
          <div className="space-y-4">
            {actionMutation.isError ? (
              <ErrorMessage
                message={getErrorMessage(
                  actionMutation.error,
                  'Unable to update session attendance.',
                )}
              />
            ) : null}

            {selectedSession ? (
              <div className="app-surface p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-ink-500">Session</p>
                    <h2 className="text-lg font-semibold text-ink-950">
                      {selectedSession.title?.trim() ||
                        subjectLabelMap.get(selectedSession.subjectId ?? '') ||
                        'Untitled session'}
                    </h2>
                    <p className="text-xs text-ink-600">
                      {formatDate(selectedSession.scheduledDate)} •{' '}
                      {formatTimeRange(
                        selectedSession.scheduledStartTime,
                        selectedSession.scheduledEndTime,
                      )}
                    </p>
                  </div>
                  <div className="space-y-1 text-xs text-ink-600">
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

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <CompactStat
                label="Attendance Rate"
                value={`${sessionSummary.attendancePercentage.toFixed(1)}%`}
                hint={`${sessionSummary.presentCount + sessionSummary.lateCount} present or late`}
              />
              <CompactStat
                label="Students"
                value={String(sessionSummary.totalStudents)}
                hint={`${sessionSummary.recordsGenerated} records generated`}
              />
              <CompactStat
                label="Final Statuses"
                value={`${sessionSummary.presentCount}/${sessionSummary.absentCount}`}
                hint={`${sessionSummary.presentCount} present • ${sessionSummary.absentCount} absent`}
              />
              <CompactStat
                label="Unknown Face Alerts"
                value={String(sessionSummary.unknownFaceAlertCount)}
                hint={`${sessionSummary.leftEarlyCount} left early • ${sessionSummary.lateCount} late`}
              />
            </div>

            <div className="app-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <AttendanceStatusBadge status="present" />
                <span className="text-xs text-ink-600">
                  {sessionSummary.presentCount} present
                </span>
                <AttendanceStatusBadge status="late" />
                <span className="text-xs text-ink-600">
                  {sessionSummary.lateCount} late
                </span>
                <AttendanceStatusBadge status="absent" />
                <span className="text-xs text-ink-600">
                  {sessionSummary.absentCount} absent
                </span>
                <AttendanceStatusBadge status="left_early" />
                <span className="text-xs text-ink-600">
                  {sessionSummary.leftEarlyCount} left early
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-[200px] max-w-[220px]">
                <SelectField
                  label="Record status"
                  value={recordStatusFilter}
                  options={statusOptions}
                  onChange={(event) =>
                    setRecordStatusFilter(event.target.value as AttendanceStatus | '')
                  }
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActionTarget('recalculate')}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:border-brand-200 hover:text-brand-700"
                >
                  <RotateCcw className="h-4 w-4" />
                  Recalculate
                </button>
                <button
                  type="button"
                  onClick={() => setActionTarget('finalize')}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl bg-ink-950 px-3 text-sm font-medium text-white transition hover:bg-ink-800"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Finalize
                </button>
              </div>
            </div>

            {recordsQuery.isLoading ? (
              <div className="app-surface p-4">
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
                  <p className="text-xs text-ink-500">{recordsCount} records</p>
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
          </div>
        )}
      </SidePanel>

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
