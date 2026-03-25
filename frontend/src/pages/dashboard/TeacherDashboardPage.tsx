import { useMutation, useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  CalendarDays,
  Clock3,
  MapPin,
  Play,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { classGroupsApi } from '../../api/classGroups.api'
import { classroomsApi } from '../../api/classrooms.api'
import { sessionsApi } from '../../api/sessions.api'
import { subjectsApi } from '../../api/subjects.api'
import { teachersApi } from '../../api/teachers.api'
import { timetableApi } from '../../api/timetable.api'
import EmptyState from '../../components/common/EmptyState'
import ErrorMessage from '../../components/common/ErrorMessage'
import Loader from '../../components/common/Loader'
import PageHeader from '../../components/common/PageHeader'
import StatusBadge from '../../components/common/StatusBadge'
import { routes } from '../../constants/routes'
import { useAuth } from '../../hooks/useAuth'
import type { Session, SessionStatus } from '../../types/session'
import type { TimetableDayOfWeek, TimetableEntry } from '../../types/timetable'
import { formatDate, formatTimeRange, getErrorMessage } from '../../utils/format'

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

const weekdayLabels: TimetableDayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

const getTodayDate = () => new Date().toISOString().slice(0, 10)
const getTodayDayOfWeek = (): TimetableDayOfWeek => weekdayLabels[new Date().getDay()]

const getRuntimeState = (
  entry: TimetableEntry,
  linkedSession: Session | null,
): {
  badgeLabel: string
  badgeTone: 'neutral' | 'brand' | 'success' | 'warning'
  canStart: boolean
} => {
  if (linkedSession) {
    if (linkedSession.status === 'active' || linkedSession.status === 'started') {
      return {
        badgeLabel: 'Running',
        badgeTone: 'brand',
        canStart: false,
      }
    }

    if (linkedSession.status === 'completed' || linkedSession.status === 'archived') {
      return {
        badgeLabel: 'Completed',
        badgeTone: 'success',
        canStart: false,
      }
    }

    return {
      badgeLabel: linkedSession.status.charAt(0).toUpperCase() + linkedSession.status.slice(1),
      badgeTone: sessionStatusToneMap[linkedSession.status],
      canStart: true,
    }
  }

  return {
    badgeLabel: entry.isActive ? 'Scheduled' : 'Inactive',
    badgeTone: entry.isActive ? 'neutral' : 'warning',
    canStart: entry.isActive,
  }
}

function TeacherDashboardPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [actionError, setActionError] = useState<string | null>(null)
  const [startingEntryId, setStartingEntryId] = useState<string | null>(null)

  const today = useMemo(() => getTodayDate(), [])
  const todayDay = useMemo(() => getTodayDayOfWeek(), [])

  const teacherProfileQuery = useQuery({
    queryKey: ['teachers', 'dashboard-profile', currentUser?.id],
    enabled: !!currentUser?.id,
    queryFn: async () => {
      const response = await teachersApi.listTeachers({
        page: 1,
        limit: 1,
        userId: currentUser!.id,
      })

      return response.items[0] ?? null
    },
  })

  const timetableQuery = useQuery({
    queryKey: ['timetable', 'teacher-dashboard', teacherProfileQuery.data?.id, todayDay],
    enabled: !!teacherProfileQuery.data?.id,
    queryFn: () =>
      timetableApi.listTimetableEntries({
        page: 1,
        limit: 20,
        teacherId: teacherProfileQuery.data!.id,
        dayOfWeek: todayDay,
        isActive: true,
      }),
  })

  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'teacher-dashboard', teacherProfileQuery.data?.id, today],
    enabled: !!teacherProfileQuery.data?.id,
    queryFn: () =>
      sessionsApi.listSessions({
        page: 1,
        limit: 50,
        teacherId: teacherProfileQuery.data!.id,
        scheduledDate: today,
      }),
  })

  const subjectsQuery = useQuery({
    queryKey: ['subjects', 'teacher-dashboard'],
    enabled: !!timetableQuery.data?.items.length,
    queryFn: () => subjectsApi.listSubjects({ page: 1, limit: 100 }),
  })

  const classGroupsQuery = useQuery({
    queryKey: ['class-groups', 'teacher-dashboard'],
    enabled: !!timetableQuery.data?.items.length,
    queryFn: () => classGroupsApi.listClassGroups({ page: 1, limit: 100 }),
  })

  const classroomsQuery = useQuery({
    queryKey: ['classrooms', 'teacher-dashboard'],
    enabled: !!timetableQuery.data?.items.length,
    queryFn: () => classroomsApi.listClassrooms({ page: 1, limit: 100 }),
  })

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

  const sessionsByTimetableId = useMemo(
    () =>
      new Map(
        (sessionsQuery.data?.items ?? [])
          .filter((session) => session.timetableEntryId)
          .map((session) => [session.timetableEntryId!, session] as const),
      ),
    [sessionsQuery.data?.items],
  )

  const startSessionMutation = useMutation({
    mutationFn: async (entry: TimetableEntry) => {
      setActionError(null)
      setStartingEntryId(entry.id)
      return sessionsApi.createSessionFromTimetable({ timetableEntryId: entry.id })
    },
    onSuccess: (session) => {
      navigate(routes.sessionDetails.replace(':sessionId', session.id))
    },
    onError: (error) => {
      setActionError(
        getErrorMessage(error, 'Unable to start a session from this timetable entry.'),
      )
    },
    onSettled: () => {
      setStartingEntryId(null)
    },
  })

  const referenceError = useMemo(() => {
    const errors = [
      teacherProfileQuery.isError
        ? getErrorMessage(teacherProfileQuery.error, 'Unable to load the teacher profile.')
        : null,
      timetableQuery.isError
        ? getErrorMessage(timetableQuery.error, "Unable to load today's classes.")
        : null,
      sessionsQuery.isError
        ? getErrorMessage(sessionsQuery.error, "Unable to load today's sessions.")
        : null,
      subjectsQuery.isError
        ? getErrorMessage(subjectsQuery.error, 'Unable to load subjects.')
        : null,
      classGroupsQuery.isError
        ? getErrorMessage(classGroupsQuery.error, 'Unable to load class groups.')
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
    sessionsQuery.error,
    sessionsQuery.isError,
    subjectsQuery.error,
    subjectsQuery.isError,
    teacherProfileQuery.error,
    teacherProfileQuery.isError,
    timetableQuery.error,
    timetableQuery.isError,
  ])

  const isLoading =
    teacherProfileQuery.isLoading ||
    timetableQuery.isLoading ||
    sessionsQuery.isLoading ||
    subjectsQuery.isLoading ||
    classGroupsQuery.isLoading ||
    classroomsQuery.isLoading

  const todayEntries = timetableQuery.data?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: routes.dashboard }]}
        eyebrow="Teacher Overview"
        title="Today's Classes"
        description={`Review today's timetable and start attendance sessions when each class begins. ${formatDate(
          today,
        )}`}
      />

      {referenceError ? <ErrorMessage message={referenceError} /> : null}
      {actionError ? <ErrorMessage message={actionError} /> : null}

      {isLoading ? (
        <div className="app-surface p-6">
          <Loader label="Loading today's classes..." />
        </div>
      ) : !teacherProfileQuery.data ? (
        <ErrorMessage message="Teacher profile not found for the current account." />
      ) : todayEntries.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No classes scheduled for today"
          description="There are no timetable entries assigned to you for today."
        />
      ) : (
        <div className="grid gap-4">
          {todayEntries.map((entry) => {
            const linkedSession = sessionsByTimetableId.get(entry.id) ?? null
            const runtimeState = getRuntimeState(entry, linkedSession)

            return (
              <article key={entry.id} className="app-surface p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <h2 className="text-xl font-semibold text-ink-950">
                          {subjectLabelMap.get(entry.subjectId ?? '') ?? 'Subject not linked'}
                        </h2>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-ink-600">
                          <span className="inline-flex items-center gap-2">
                            <Clock3 className="h-4 w-4 text-brand-600" />
                            {formatTimeRange(entry.startTime, entry.endTime)}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-brand-600" />
                            {classGroupLabelMap.get(entry.classGroupId ?? '') ?? 'Class group not linked'}
                          </span>
                          {entry.classroomId ? (
                            <span className="inline-flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-brand-600" />
                              {classroomLabelMap.get(entry.classroomId) ?? 'Classroom not linked'}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <StatusBadge
                        label={runtimeState.badgeLabel}
                        tone={runtimeState.badgeTone}
                      />
                    </div>

                    {entry.notes ? (
                      <p className="text-sm leading-6 text-ink-500">{entry.notes}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {linkedSession ? (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(routes.sessionDetails.replace(':sessionId', linkedSession.id))
                        }
                        className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-ink-700 transition hover:border-brand-200 hover:text-brand-700"
                      >
                        Open Session
                      </button>
                    ) : null}

                    {runtimeState.canStart ? (
                      <button
                        type="button"
                        onClick={() => {
                          void startSessionMutation.mutateAsync(entry)
                        }}
                        disabled={startSessionMutation.isPending && startingEntryId === entry.id}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-ink-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Play className="h-4 w-4" />
                        {startSessionMutation.isPending && startingEntryId === entry.id
                          ? 'Starting...'
                          : 'Start Session'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default TeacherDashboardPage
