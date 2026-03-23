import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'

import { classGroupsApi } from '../../api/classGroups.api'
import { classroomsApi } from '../../api/classrooms.api'
import { sessionsApi } from '../../api/sessions.api'
import { subjectsApi } from '../../api/subjects.api'
import { teachersApi } from '../../api/teachers.api'
import { usersApi } from '../../api/users.api'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import ErrorMessage from '../../components/common/ErrorMessage'
import Loader from '../../components/common/Loader'
import PageHeader from '../../components/common/PageHeader'
import SearchInput from '../../components/common/SearchInput'
import SidePanel from '../../components/common/SidePanel'
import StatusBadge from '../../components/common/StatusBadge'
import FormActions from '../../components/forms/FormActions'
import InputField from '../../components/forms/InputField'
import SelectField from '../../components/forms/SelectField'
import TextAreaField from '../../components/forms/TextAreaField'
import DataTable, { type DataTableColumn } from '../../components/tables/DataTable'
import TableActions from '../../components/tables/TableActions'
import { routes } from '../../constants/routes'
import useDebounce from '../../hooks/useDebounce'
import type {
  CreateSessionInput,
  Session,
  SessionStatus,
  UpdateSessionInput,
} from '../../types/session'
import { sessionStatusValues } from '../../types/session'
import {
  formatDate,
  formatTimeRange,
  getErrorMessage,
} from '../../utils/format'

const statusOptions = [
  { value: '', label: 'All statuses' },
  ...sessionStatusValues.map((status) => ({
    value: status,
    label: status.charAt(0).toUpperCase() + status.slice(1),
  })),
]

const statusToneMap: Record<
  SessionStatus,
  'neutral' | 'brand' | 'success' | 'warning'
> = {
  created: 'neutral',
  started: 'brand',
  active: 'brand',
  completed: 'success',
  archived: 'warning',
}

const sessionSchema = z
  .object({
    title: z.string().optional(),
    classGroupId: z.string().trim().min(1, 'Select a class group.'),
    subjectId: z.string().trim().min(1, 'Select a subject.'),
    teacherId: z.string().trim().min(1, 'Select a teacher.'),
    classroomId: z.string().trim().min(1, 'Select a classroom.'),
    scheduledDate: z.string().trim().min(1, 'Scheduled date is required.'),
    scheduledStartTime: z.string().trim().min(1, 'Start time is required.'),
    scheduledEndTime: z.string().trim().min(1, 'End time is required.'),
    graceMinutesForLate: z.coerce
      .number()
      .int()
      .min(0, 'Grace minutes cannot be negative.'),
    minimumPresenceMinutes: z.coerce
      .number()
      .int()
      .positive('Minimum presence minutes must be a positive number.'),
    minimumPresencePercentage: z.coerce
      .number()
      .min(1, 'Presence percentage must be at least 1.')
      .max(100, 'Presence percentage cannot exceed 100.'),
    cameraIdsText: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (values) => values.scheduledStartTime < values.scheduledEndTime,
    {
      path: ['scheduledEndTime'],
      message: 'End time must be after the start time.',
    },
  )

type SessionFormValues = z.input<typeof sessionSchema>
type SessionSubmitValues = z.output<typeof sessionSchema>
type SessionActionType = 'start' | 'complete' | 'archive'

const parseCameraIds = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const getDefaultValues = (session?: Session | null): SessionFormValues => ({
  title: session?.title ?? '',
  classGroupId: session?.classGroupId ?? '',
  subjectId: session?.subjectId ?? '',
  teacherId: session?.teacherId ?? '',
  classroomId: session?.classroomId ?? '',
  scheduledDate: session?.scheduledDate ?? '',
  scheduledStartTime: session?.scheduledStartTime ?? '',
  scheduledEndTime: session?.scheduledEndTime ?? '',
  graceMinutesForLate: session?.graceMinutesForLate ?? 5,
  minimumPresenceMinutes: session?.minimumPresenceMinutes ?? 15,
  minimumPresencePercentage: session?.minimumPresencePercentage ?? 50,
  cameraIdsText: session?.cameraIds.join(', ') ?? '',
  notes: session?.notes ?? '',
})

const canStartSession = (status: SessionStatus) => status === 'created'
const canCompleteSession = (status: SessionStatus) =>
  status === 'started' || status === 'active'
const canArchiveSession = (status: SessionStatus) => status === 'completed'

const getSessionPath = (sessionId: string) =>
  routes.sessionDetails.replace(':sessionId', sessionId)

interface SessionFormProps {
  session?: Session | null
  classGroupOptions: Array<{ label: string; value: string }>
  subjectOptions: Array<{ label: string; value: string }>
  teacherOptions: Array<{ label: string; value: string }>
  classroomOptions: Array<{ label: string; value: string }>
  submitError: string | null
  referenceError?: string | null
  isSubmitting: boolean
  onCancel: () => void
  onSubmit: (values: SessionSubmitValues) => Promise<void>
}

function SessionForm({
  session,
  classGroupOptions,
  subjectOptions,
  teacherOptions,
  classroomOptions,
  submitError,
  referenceError,
  isSubmitting,
  onCancel,
  onSubmit,
}: SessionFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SessionFormValues, undefined, SessionSubmitValues>({
    resolver: zodResolver(sessionSchema),
    defaultValues: getDefaultValues(session),
  })

  useEffect(() => {
    reset(getDefaultValues(session))
  }, [reset, session])

  const submitHandler = handleSubmit(async (values) => {
    await onSubmit(values)
  })

  return (
    <form className="space-y-5" onSubmit={submitHandler}>
      <InputField
        label="Session title"
        placeholder="Optional human-friendly title"
        error={errors.title?.message}
        {...register('title')}
      />

      <div className="grid gap-5 md:grid-cols-2">
        <SelectField
          label="Class group"
          options={classGroupOptions}
          placeholder="Select class group"
          error={errors.classGroupId?.message}
          {...register('classGroupId')}
        />
        <SelectField
          label="Subject"
          options={subjectOptions}
          placeholder="Select subject"
          error={errors.subjectId?.message}
          {...register('subjectId')}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <SelectField
          label="Teacher"
          options={teacherOptions}
          placeholder="Select teacher"
          error={errors.teacherId?.message}
          {...register('teacherId')}
        />
        <SelectField
          label="Classroom"
          options={classroomOptions}
          placeholder="Select classroom"
          error={errors.classroomId?.message}
          {...register('classroomId')}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <InputField
          label="Scheduled date"
          type="date"
          error={errors.scheduledDate?.message}
          {...register('scheduledDate')}
        />
        <InputField
          label="Start time"
          type="time"
          error={errors.scheduledStartTime?.message}
          {...register('scheduledStartTime')}
        />
        <InputField
          label="End time"
          type="time"
          error={errors.scheduledEndTime?.message}
          {...register('scheduledEndTime')}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <InputField
          label="Grace minutes"
          type="number"
          min={0}
          error={errors.graceMinutesForLate?.message}
          {...register('graceMinutesForLate')}
        />
        <InputField
          label="Minimum presence minutes"
          type="number"
          min={1}
          error={errors.minimumPresenceMinutes?.message}
          {...register('minimumPresenceMinutes')}
        />
        <InputField
          label="Minimum presence %"
          type="number"
          min={1}
          max={100}
          error={errors.minimumPresencePercentage?.message}
          {...register('minimumPresencePercentage')}
        />
      </div>

      <InputField
        label="Camera IDs"
        placeholder="cam-01, cam-02"
        hint="Optional override for camera identifiers. Leave blank to use the classroom defaults."
        error={errors.cameraIdsText?.message}
        {...register('cameraIdsText')}
      />

      <TextAreaField
        label="Notes"
        placeholder="Add operational notes for this session"
        error={errors.notes?.message}
        {...register('notes')}
      />

      {referenceError ? <ErrorMessage message={referenceError} /> : null}
      {submitError ? <ErrorMessage message={submitError} /> : null}

      <FormActions
        submitLabel={session ? 'Save changes' : 'Create session'}
        loadingLabel={session ? 'Saving changes...' : 'Creating session...'}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
      />
    </form>
  )
}

function SessionsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<SessionStatus | ''>('')
  const [classGroupFilter, setClassGroupFilter] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<{
    session: Session
    action: SessionActionType
  } | null>(null)
  const debouncedSearch = useDebounce(search)

  const sessionsQuery = useQuery({
    queryKey: [
      'sessions',
      debouncedSearch,
      dateFilter,
      statusFilter,
      classGroupFilter,
      teacherFilter,
      subjectFilter,
    ],
    queryFn: () =>
      sessionsApi.listSessions({
        page: 1,
        limit: 100,
        search: debouncedSearch || undefined,
        scheduledDate: dateFilter || undefined,
        status: statusFilter || undefined,
        classGroupId: classGroupFilter || undefined,
        teacherId: teacherFilter || undefined,
        subjectId: subjectFilter || undefined,
      }),
  })

  const classGroupsQuery = useQuery({
    queryKey: ['class-groups', 'session-options'],
    queryFn: () => classGroupsApi.listClassGroups({ page: 1, limit: 100 }),
  })

  const subjectsQuery = useQuery({
    queryKey: ['subjects', 'session-options'],
    queryFn: () => subjectsApi.listSubjects({ page: 1, limit: 100 }),
  })

  const teacherProfilesQuery = useQuery({
    queryKey: ['teachers', 'session-options'],
    queryFn: () => teachersApi.listTeachers({ page: 1, limit: 100 }),
  })

  const teacherUsersQuery = useQuery({
    queryKey: ['users', 'session-teacher-options'],
    queryFn: () => usersApi.listUsers({ page: 1, limit: 100, role: 'teacher' }),
  })

  const classroomsQuery = useQuery({
    queryKey: ['classrooms', 'session-options'],
    queryFn: () => classroomsApi.listClassrooms({ page: 1, limit: 100 }),
  })

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

  const classroomLabelMap = useMemo(
    () =>
      new Map(
        (classroomsQuery.data?.items ?? []).map((classroom) => [
          classroom.id,
          `${classroom.code} • ${classroom.name}`,
        ]),
      ),
    [classroomsQuery.data?.items],
  )

  const teacherUserMap = useMemo(
    () =>
      new Map(
        (teacherUsersQuery.data?.items ?? []).map((user) => [user.id, user] as const),
      ),
    [teacherUsersQuery.data?.items],
  )

  const teacherLabelMap = useMemo(
    () =>
      new Map(
        (teacherProfilesQuery.data?.items ?? []).map((teacher) => {
          const linkedUser = teacher.userId ? teacherUserMap.get(teacher.userId) : null
          const label = linkedUser
            ? `${linkedUser.fullName} • ${teacher.employeeId}`
            : teacher.employeeId

          return [teacher.id, label] as const
        }),
      ),
    [teacherProfilesQuery.data?.items, teacherUserMap],
  )

  const classGroupOptions = useMemo(
    () =>
      (classGroupsQuery.data?.items ?? []).map((group) => ({
        value: group.id,
        label: `${group.code} • ${group.name}`,
      })),
    [classGroupsQuery.data?.items],
  )

  const subjectOptions = useMemo(
    () =>
      (subjectsQuery.data?.items ?? []).map((subject) => ({
        value: subject.id,
        label: `${subject.code} • ${subject.name}`,
      })),
    [subjectsQuery.data?.items],
  )

  const teacherOptions = useMemo(
    () =>
      (teacherProfilesQuery.data?.items ?? []).map((teacher) => ({
        value: teacher.id,
        label: teacherLabelMap.get(teacher.id) ?? teacher.employeeId,
      })),
    [teacherLabelMap, teacherProfilesQuery.data?.items],
  )

  const classroomOptions = useMemo(
    () =>
      (classroomsQuery.data?.items ?? []).map((classroom) => ({
        value: classroom.id,
        label: `${classroom.code} • ${classroom.name}`,
      })),
    [classroomsQuery.data?.items],
  )

  const referenceError = useMemo(() => {
    const errors = [
      classGroupsQuery.isError
        ? getErrorMessage(classGroupsQuery.error, 'Unable to load class groups.')
        : null,
      subjectsQuery.isError
        ? getErrorMessage(subjectsQuery.error, 'Unable to load subjects.')
        : null,
      teacherProfilesQuery.isError
        ? getErrorMessage(teacherProfilesQuery.error, 'Unable to load teachers.')
        : null,
      teacherUsersQuery.isError
        ? getErrorMessage(teacherUsersQuery.error, 'Unable to load teacher users.')
        : null,
      classroomsQuery.isError
        ? getErrorMessage(classroomsQuery.error, 'Unable to load classrooms.')
        : null,
    ].filter(Boolean)

    return errors[0] ?? null
  }, [
    classGroupsQuery.error,
    classGroupsQuery.isError,
    classroomsQuery.error,
    classroomsQuery.isError,
    subjectsQuery.error,
    subjectsQuery.isError,
    teacherProfilesQuery.error,
    teacherProfilesQuery.isError,
    teacherUsersQuery.error,
    teacherUsersQuery.isError,
  ])

  const saveMutation = useMutation({
    mutationFn: async (values: SessionSubmitValues) => {
      setFormError(null)

      const basePayload = {
        title: values.title?.trim() || undefined,
        classGroupId: values.classGroupId,
        subjectId: values.subjectId,
        teacherId: values.teacherId,
        classroomId: values.classroomId,
        scheduledDate: values.scheduledDate,
        scheduledStartTime: values.scheduledStartTime,
        scheduledEndTime: values.scheduledEndTime,
        graceMinutesForLate: values.graceMinutesForLate,
        minimumPresenceMinutes: values.minimumPresenceMinutes,
        minimumPresencePercentage: values.minimumPresencePercentage,
        cameraIds: parseCameraIds(values.cameraIdsText),
        notes: values.notes?.trim() || undefined,
      }

      if (editingSession) {
        const payload: UpdateSessionInput = basePayload
        return sessionsApi.updateSession(editingSession.id, payload)
      }

      const payload: CreateSessionInput = basePayload
      return sessionsApi.createSession(payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      setSheetOpen(false)
      setEditingSession(null)
      setFormError(null)
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, 'Unable to save the session.'))
    },
  })

  const actionMutation = useMutation({
    mutationFn: async (target: { session: Session; action: SessionActionType }) => {
      if (target.action === 'start') {
        return sessionsApi.startSession(target.session.id)
      }

      if (target.action === 'complete') {
        return sessionsApi.completeSession(target.session.id)
      }

      return sessionsApi.archiveSession(target.session.id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      setActionTarget(null)
    },
  })

  const totalSessions =
    sessionsQuery.data?.meta.totalItems ?? sessionsQuery.data?.items.length ?? 0

  const columns = useMemo<DataTableColumn<Session>[]>(
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
              {formatTimeRange(
                session.scheduledStartTime,
                session.scheduledEndTime,
              )}
            </p>
          </div>
        ),
      },
      {
        key: 'class',
        header: 'Class / Subject',
        render: (session) => (
          <div className="space-y-1">
            <p>{classGroupLabelMap.get(session.classGroupId ?? '') ?? 'Not linked'}</p>
            <p className="text-xs text-ink-500">
              {subjectLabelMap.get(session.subjectId ?? '') ?? 'Subject not linked'}
            </p>
          </div>
        ),
      },
      {
        key: 'teacher',
        header: 'Teacher',
        render: (session) => (
          <div className="space-y-1">
            <p>{teacherLabelMap.get(session.teacherId ?? '') ?? 'Not linked'}</p>
            <p className="text-xs text-ink-500">
              {classroomLabelMap.get(session.classroomId ?? '') ?? 'Classroom not linked'}
            </p>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (session) => (
          <div className="space-y-2">
            <StatusBadge
              label={session.status.charAt(0).toUpperCase() + session.status.slice(1)}
              tone={statusToneMap[session.status]}
            />
            <p className="text-xs text-ink-500">
              {session.actualStartTime
                ? `Started ${formatDate(session.actualStartTime)}`
                : 'Not started yet'}
            </p>
          </div>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-[280px]',
        headerClassName: 'text-right',
        render: (session) => (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              to={getSessionPath(session.id)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            >
              View
            </Link>
            {canStartSession(session.status) ? (
              <button
                type="button"
                onClick={() => setActionTarget({ session, action: 'start' })}
                className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700 transition hover:bg-brand-100"
              >
                Start
              </button>
            ) : null}
            {canCompleteSession(session.status) ? (
              <button
                type="button"
                onClick={() => setActionTarget({ session, action: 'complete' })}
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 transition hover:bg-emerald-100"
              >
                Complete
              </button>
            ) : null}
            {canArchiveSession(session.status) ? (
              <button
                type="button"
                onClick={() => setActionTarget({ session, action: 'archive' })}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 transition hover:bg-amber-100"
              >
                Archive
              </button>
            ) : null}
            <TableActions
              onEdit={() => {
                setEditingSession(session)
                setFormError(null)
                setSheetOpen(true)
              }}
            />
          </div>
        ),
      },
    ],
    [classGroupLabelMap, classroomLabelMap, subjectLabelMap, teacherLabelMap],
  )

  const actionCopy = useMemo(() => {
    if (!actionTarget) {
      return null
    }

    if (actionTarget.action === 'start') {
      return {
        title: 'Start session?',
        description:
          'Attendance and live monitoring will begin using the current session configuration.',
        confirmLabel: 'Start session',
        tone: 'brand' as const,
      }
    }

    if (actionTarget.action === 'complete') {
      return {
        title: 'Complete session?',
        description:
          'The session will stop accepting live updates and move to a completed state.',
        confirmLabel: 'Complete session',
        tone: 'brand' as const,
      }
    }

    return {
      title: 'Archive session?',
      description:
        'The session will be moved to archive for historical access and reporting.',
      confirmLabel: 'Archive session',
      tone: 'danger' as const,
    }
  }, [actionTarget])

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'Sessions' },
        ]}
        eyebrow="Operations"
        title="Sessions"
        description="Create and manage classroom sessions, then drive the session lifecycle from scheduled to archived."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingSession(null)
              setFormError(null)
              setSheetOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-ink-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-ink-800"
          >
            <Plus className="h-4 w-4" />
            Add session
          </button>
        }
      />

      {referenceError ? <ErrorMessage message={referenceError} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="block space-y-2 md:col-span-2 xl:col-span-3">
          <span className="text-sm font-medium text-ink-800">Search</span>
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch('')}
            placeholder="Search by title or notes"
          />
        </label>
        <InputField
          label="Date"
          type="date"
          value={dateFilter}
          onChange={(event) => setDateFilter(event.target.value)}
        />
        <SelectField
          label="Status"
          value={statusFilter}
          options={statusOptions}
          onChange={(event) => setStatusFilter(event.target.value as SessionStatus | '')}
        />
        <SelectField
          label="Class group"
          value={classGroupFilter}
          options={[{ value: '', label: 'All class groups' }, ...classGroupOptions]}
          onChange={(event) => setClassGroupFilter(event.target.value)}
        />
        <SelectField
          label="Teacher"
          value={teacherFilter}
          options={[{ value: '', label: 'All teachers' }, ...teacherOptions]}
          onChange={(event) => setTeacherFilter(event.target.value)}
        />
        <SelectField
          label="Subject"
          value={subjectFilter}
          options={[{ value: '', label: 'All subjects' }, ...subjectOptions]}
          onChange={(event) => setSubjectFilter(event.target.value)}
        />
      </div>

      {sessionsQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(sessionsQuery.error, 'Unable to load sessions.')}
        />
      ) : sessionsQuery.isLoading ? (
        <div className="app-surface p-6">
          <Loader label="Loading sessions..." />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-sm text-ink-500">{totalSessions} sessions</p>
          </div>
          <DataTable
            data={sessionsQuery.data?.items ?? []}
            columns={columns}
            getRowKey={(session) => session.id}
            emptyTitle="No sessions found."
            emptyDescription="Adjust the filters or create a new classroom session."
          />
        </>
      )}

      <SidePanel
        open={sheetOpen}
        title={editingSession ? 'Edit session' : 'Create session'}
        description="Set the academic context, schedule, and attendance thresholds for this session."
        onClose={() => {
          setSheetOpen(false)
          setEditingSession(null)
          setFormError(null)
        }}
      >
        <SessionForm
          session={editingSession}
          classGroupOptions={classGroupOptions}
          subjectOptions={subjectOptions}
          teacherOptions={teacherOptions}
          classroomOptions={classroomOptions}
          submitError={formError}
          referenceError={referenceError}
          isSubmitting={saveMutation.isPending}
          onCancel={() => {
            setSheetOpen(false)
            setEditingSession(null)
            setFormError(null)
          }}
          onSubmit={async (values) => {
            await saveMutation.mutateAsync(values)
          }}
        />
      </SidePanel>

      <ConfirmDialog
        open={!!actionTarget}
        title={actionCopy?.title ?? 'Update session?'}
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

export default SessionsPage
