import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarClock,
  Camera,
  ChevronLeft,
  ClipboardList,
  ShieldCheck,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

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
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import { routes } from '../../constants/routes'
import { useAuth } from '../../hooks/useAuth'
import type { Session, SessionStatus } from '../../types/session'
import { formatDate, formatDateTime, formatTimeRange, getErrorMessage } from '../../utils/format'
import { isAdminRole } from '../../utils/role'

type SessionActionType = 'start' | 'complete' | 'archive'

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

const canStartSession = (status: SessionStatus) => status === 'created'
const canCompleteSession = (status: SessionStatus) =>
  status === 'started' || status === 'active'
const canArchiveSession = (status: SessionStatus) => status === 'completed'

function DetailRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
        {label}
      </dt>
      <dd className="mt-2 text-sm text-ink-900">{value}</dd>
    </div>
  )
}

function SessionDetailsPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const [actionTarget, setActionTarget] = useState<{
    session: Session
    action: SessionActionType
  } | null>(null)

  const sessionQuery = useQuery({
    queryKey: ['sessions', 'detail', sessionId],
    enabled: !!sessionId,
    queryFn: () => sessionsApi.getSessionById(sessionId!),
  })

  const classGroupsQuery = useQuery({
    queryKey: ['class-groups', 'session-detail-options'],
    queryFn: () => classGroupsApi.listClassGroups({ page: 1, limit: 100 }),
  })

  const subjectsQuery = useQuery({
    queryKey: ['subjects', 'session-detail-options'],
    queryFn: () => subjectsApi.listSubjects({ page: 1, limit: 100 }),
  })

  const teacherProfilesQuery = useQuery({
    queryKey: ['teachers', 'session-detail-options'],
    queryFn: () => teachersApi.listTeachers({ page: 1, limit: 100 }),
  })

  const shouldLoadTeacherUsers = isAdminRole(role)

  const teacherUsersQuery = useQuery({
    queryKey: ['users', 'session-detail-teacher-options'],
    enabled: shouldLoadTeacherUsers,
    queryFn: () => usersApi.listUsers({ page: 1, limit: 100, role: 'teacher' }),
  })

  const classroomsQuery = useQuery({
    queryKey: ['classrooms', 'session-detail-options'],
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
            : `${teacher.designation} • ${teacher.employeeId}`

          return [teacher.id, label] as const
        }),
      ),
    [teacherProfilesQuery.data?.items, teacherUserMap],
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
      shouldLoadTeacherUsers && teacherUsersQuery.isError
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
    shouldLoadTeacherUsers,
    teacherUsersQuery.error,
    teacherUsersQuery.isError,
  ])

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
      await queryClient.invalidateQueries({ queryKey: ['sessions', 'detail', sessionId] })
      setActionTarget(null)
    },
  })

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

  if (!sessionId) {
    return <ErrorMessage message="Session ID is missing from the route." />
  }

  if (sessionQuery.isLoading) {
    return (
      <div className="app-surface p-6">
        <Loader label="Loading session details..." />
      </div>
    )
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return (
      <ErrorMessage
        message={getErrorMessage(
          sessionQuery.error,
          'Unable to load the requested session.',
        )}
      />
    )
  }

  const session = sessionQuery.data
  const sessionTitle =
    session.title?.trim() ||
    subjectLabelMap.get(session.subjectId ?? '') ||
    'Session details'

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'Sessions', href: routes.sessions },
          { label: 'Session Details' },
        ]}
        eyebrow="Operations"
        title={sessionTitle}
        description="Review the academic context, schedule, thresholds, and lifecycle state of this classroom session."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              to={routes.sessions}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-ink-700 transition hover:border-brand-200 hover:text-brand-700"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Link>
            {canStartSession(session.status) ? (
              <button
                type="button"
                onClick={() => setActionTarget({ session, action: 'start' })}
                className="rounded-2xl bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Start session
              </button>
            ) : null}
            {canCompleteSession(session.status) ? (
              <button
                type="button"
                onClick={() => setActionTarget({ session, action: 'complete' })}
                className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                Complete session
              </button>
            ) : null}
            {canArchiveSession(session.status) ? (
              <button
                type="button"
                onClick={() => setActionTarget({ session, action: 'archive' })}
                className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-amber-600"
              >
                Archive session
              </button>
            ) : null}
          </div>
        }
      />

      {referenceError ? <ErrorMessage message={referenceError} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Status"
          value={session.status.charAt(0).toUpperCase() + session.status.slice(1)}
          hint={
            session.actualStartTime
              ? `Actual start: ${formatDateTime(session.actualStartTime)}`
              : 'Session has not started yet.'
          }
          icon={ClipboardList}
        />
        <StatCard
          label="Scheduled"
          value={formatDate(session.scheduledDate)}
          hint={formatTimeRange(session.scheduledStartTime, session.scheduledEndTime)}
          icon={CalendarClock}
          accent="amber"
        />
        <StatCard
          label="Attendance Rule"
          value={`${session.minimumPresencePercentage}%`}
          hint={`${session.minimumPresenceMinutes} min minimum • ${session.graceMinutesForLate} min grace`}
          icon={ShieldCheck}
          accent="emerald"
        />
        <StatCard
          label="Camera Setup"
          value={session.cameraIds.length ? `${session.cameraIds.length} linked` : 'Default'}
          hint={
            session.cameraIds.length
              ? session.cameraIds.join(', ')
              : 'No session override cameras configured.'
          }
          icon={Camera}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
        <section className="app-surface p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink-950">Session information</h2>
              <p className="mt-1 text-sm text-ink-500">
                Academic links, schedule context, and descriptive notes.
              </p>
            </div>
            <StatusBadge
              label={session.status.charAt(0).toUpperCase() + session.status.slice(1)}
              tone={statusToneMap[session.status]}
            />
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <DetailRow label="Session ID" value={session.id} />
            <DetailRow
              label="Title"
              value={session.title?.trim() || 'No custom title'}
            />
            <DetailRow
              label="Class group"
              value={classGroupLabelMap.get(session.classGroupId ?? '') ?? 'Not linked'}
            />
            <DetailRow
              label="Subject"
              value={subjectLabelMap.get(session.subjectId ?? '') ?? 'Not linked'}
            />
            <DetailRow
              label="Teacher"
              value={teacherLabelMap.get(session.teacherId ?? '') ?? 'Not linked'}
            />
            <DetailRow
              label="Classroom"
              value={classroomLabelMap.get(session.classroomId ?? '') ?? 'Not linked'}
            />
            <DetailRow label="Scheduled date" value={formatDate(session.scheduledDate)} />
            <DetailRow
              label="Scheduled time"
              value={formatTimeRange(
                session.scheduledStartTime,
                session.scheduledEndTime,
              )}
            />
          </dl>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <h3 className="text-sm font-semibold text-ink-800">Notes</h3>
            <p className="mt-2 text-sm leading-6 text-ink-600">
              {session.notes?.trim() || 'No notes were added for this session.'}
            </p>
          </div>
        </section>

        <div className="space-y-6">
          <section className="app-surface p-6">
            <h2 className="text-lg font-semibold text-ink-950">Execution timeline</h2>
            <p className="mt-1 text-sm text-ink-500">
              Scheduled milestones and actual runtime timestamps.
            </p>

            <dl className="mt-6 space-y-4">
              <DetailRow
                label="Actual start"
                value={formatDateTime(session.actualStartTime)}
              />
              <DetailRow
                label="Actual end"
                value={formatDateTime(session.actualEndTime)}
              />
              <DetailRow label="Created at" value={formatDateTime(session.createdAt)} />
              <DetailRow label="Updated at" value={formatDateTime(session.updatedAt)} />
            </dl>
          </section>

          <section className="app-surface p-6">
            <h2 className="text-lg font-semibold text-ink-950">Camera identifiers</h2>
            <p className="mt-1 text-sm text-ink-500">
              Session-level camera overrides used for recognition ingestion.
            </p>

            {session.cameraIds.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {session.cameraIds.map((cameraId) => (
                  <span
                    key={cameraId}
                    className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700"
                  >
                    {cameraId}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-ink-500">
                No session-specific camera IDs were set. The classroom defaults will be used.
              </p>
            )}
          </section>
        </div>
      </div>

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

export default SessionDetailsPage
