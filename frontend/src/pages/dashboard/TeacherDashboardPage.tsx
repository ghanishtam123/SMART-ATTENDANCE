import { useMutation, useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  CalendarDays,
  Clock3,
  MapPin,
  Play,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
import type { Session } from '../../types/session'
import type { TimetableDayOfWeek, TimetableEntry } from '../../types/timetable'
import { formatDate, formatTime, formatTimeRange, getErrorMessage } from '../../utils/format'

const weekdayLabels: TimetableDayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

type TeacherDashboardState =
  | 'upcoming'
  | 'ready_to_start'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'missed'

const getTodayDate = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
const getTodayDayOfWeek = (date = new Date()): TimetableDayOfWeek => weekdayLabels[date.getDay()]
const getTimeValueInMinutes = (value: string) => {
  const [hours = '0', minutes = '0'] = value.split(':')
  return Number(hours) * 60 + Number(minutes)
}

const getTeacherDashboardState = (
  entry: TimetableEntry,
  linkedSession: Session | null,
  nowMinutes: number,
): TeacherDashboardState => {
  if (linkedSession) {
    if (linkedSession.status === 'active' || linkedSession.status === 'started') {
      return 'running'
    }

    if (linkedSession.status === 'completed' || linkedSession.status === 'archived') {
      return 'completed'
    }
  }

  if (!entry.isActive) {
    return 'cancelled'
  }

  const startMinutes = getTimeValueInMinutes(entry.startTime)
  const endMinutes = getTimeValueInMinutes(entry.endTime)

  if (nowMinutes < startMinutes) {
    return 'upcoming'
  }

  if (nowMinutes >= endMinutes) {
    return 'missed'
  }

  return 'ready_to_start'
}

const teacherDashboardStateMeta: Record<
  TeacherDashboardState,
  {
    badgeLabel: string
    badgeTone: 'neutral' | 'brand' | 'success' | 'warning' | 'danger'
  }
> = {
  upcoming: {
    badgeLabel: 'Upcoming',
    badgeTone: 'neutral',
  },
  ready_to_start: {
    badgeLabel: 'Ready to Start',
    badgeTone: 'brand',
  },
  running: {
    badgeLabel: 'Running',
    badgeTone: 'brand',
  },
  completed: {
    badgeLabel: 'Completed',
    badgeTone: 'success',
  },
  cancelled: {
    badgeLabel: 'Cancelled',
    badgeTone: 'warning',
  },
  missed: {
    badgeLabel: 'Missed',
    badgeTone: 'danger',
  },
}

function TeacherDashboardPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [actionError, setActionError] = useState<string | null>(null)
  const [startingEntryId, setStartingEntryId] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date())
    }, 60_000)

    return () => window.clearInterval(intervalId)
  }, [])

  const today = useMemo(() => getTodayDate(now), [now])
  const todayDay = useMemo(() => getTodayDayOfWeek(now), [now])
  const nowMinutes = useMemo(() => now.getHours() * 60 + now.getMinutes(), [now])

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
    refetchInterval: 60_000,
    queryFn: () =>
      timetableApi.listTimetableEntries({
        page: 1,
        limit: 20,
        teacherId: teacherProfileQuery.data!.id,
        dayOfWeek: todayDay,
      }),
  })

  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'teacher-dashboard', teacherProfileQuery.data?.id, today],
    enabled: !!teacherProfileQuery.data?.id,
    refetchInterval: 60_000,
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

  const todayEntries = useMemo(
    () =>
      [...(timetableQuery.data?.items ?? [])].sort(
        (left, right) =>
          getTimeValueInMinutes(left.startTime) - getTimeValueInMinutes(right.startTime),
      ),
    [timetableQuery.data?.items],
  )

  const dashboardEntries = useMemo(
    () =>
      todayEntries.map((entry) => {
        const linkedSession = sessionsByTimetableId.get(entry.id) ?? null
        const state = getTeacherDashboardState(entry, linkedSession, nowMinutes)

        return {
          entry,
          linkedSession,
          state,
          statusMeta: teacherDashboardStateMeta[state],
        }
      }),
    [nowMinutes, sessionsByTimetableId, todayEntries],
  )

  const renderEntryCard = (
    entry: TimetableEntry,
    linkedSession: Session | null,
    state: TeacherDashboardState,
  ) => (
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
              label={teacherDashboardStateMeta[state].badgeLabel}
              tone={teacherDashboardStateMeta[state].badgeTone}
            />
          </div>

          {entry.notes ? <p className="text-sm leading-6 text-ink-500">{entry.notes}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {state === 'running' && linkedSession ? (
            <button
              type="button"
              onClick={() => navigate(routes.sessionDetails.replace(':sessionId', linkedSession.id))}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-ink-700 transition hover:border-brand-200 hover:text-brand-700"
            >
              Go to Session
            </button>
          ) : null}

          {state === 'completed' && linkedSession ? (
            <button
              type="button"
              onClick={() => navigate(routes.sessionDetails.replace(':sessionId', linkedSession.id))}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-ink-700 transition hover:border-brand-200 hover:text-brand-700"
            >
              View Session
            </button>
          ) : null}

          {state === 'upcoming' ? (
            <button
              type="button"
              disabled
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-ink-500"
            >
              Starts at {formatTime(entry.startTime)}
            </button>
          ) : null}

          {state === 'ready_to_start' ? (
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

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: routes.dashboard }]}
        eyebrow="Teacher Overview"
        title="Today's Timetable"
        description={`Review today's classes and start attendance only when the timetable start time is reached. ${formatDate(
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
          {dashboardEntries.map(({ entry, linkedSession, state }) =>
            renderEntryCard(entry, linkedSession, state),
          )}
        </div>
      )}
    </div>
  )
}

export default TeacherDashboardPage
