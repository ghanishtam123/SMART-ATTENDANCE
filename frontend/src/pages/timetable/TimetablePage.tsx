import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { classGroupsApi } from '../../api/classGroups.api'
import { classroomsApi } from '../../api/classrooms.api'
import { subjectsApi } from '../../api/subjects.api'
import { teachersApi } from '../../api/teachers.api'
import { timetableApi } from '../../api/timetable.api'
import { usersApi } from '../../api/users.api'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import ErrorMessage from '../../components/common/ErrorMessage'
import Loader from '../../components/common/Loader'
import PageHeader from '../../components/common/PageHeader'
import SidePanel from '../../components/common/SidePanel'
import StatusBadge from '../../components/common/StatusBadge'
import FormActions from '../../components/forms/FormActions'
import InputField from '../../components/forms/InputField'
import SelectField from '../../components/forms/SelectField'
import TextAreaField from '../../components/forms/TextAreaField'
import DataTable, { type DataTableColumn } from '../../components/tables/DataTable'
import TableActions from '../../components/tables/TableActions'
import { routes } from '../../constants/routes'
import type {
  CreateTimetableEntryInput,
  TimetableDayOfWeek,
  TimetableEntry,
  UpdateTimetableEntryInput,
} from '../../types/timetable'
import { timetableDayValues } from '../../types/timetable'
import { formatTimeRange, getErrorMessage } from '../../utils/format'

const dayOptions = timetableDayValues.map((day) => ({
  value: day,
  label: day.charAt(0).toUpperCase() + day.slice(1),
}))

const timetableSchema = z
  .object({
    classGroupId: z.string().trim().min(1, 'Select a class group.'),
    subjectId: z.string().trim().min(1, 'Select a subject.'),
    teacherId: z.string().trim().min(1, 'Select a teacher.'),
    classroomId: z.string().trim().min(1, 'Select a classroom.'),
    dayOfWeek: z.enum(timetableDayValues),
    startTime: z.string().trim().min(1, 'Start time is required.'),
    endTime: z.string().trim().min(1, 'End time is required.'),
    cameraIdsText: z.string().optional(),
    notes: z.string().optional(),
    isActive: z.boolean(),
  })
  .refine((values) => values.startTime < values.endTime, {
    path: ['endTime'],
    message: 'End time must be after the start time.',
  })

type TimetableFormValues = z.input<typeof timetableSchema>
type TimetableSubmitValues = z.output<typeof timetableSchema>

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const parseCameraIds = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const getDefaultValues = (
  entry?: TimetableEntry | null,
): TimetableFormValues => ({
  classGroupId: entry?.classGroupId ?? '',
  subjectId: entry?.subjectId ?? '',
  teacherId: entry?.teacherId ?? '',
  classroomId: entry?.classroomId ?? '',
  dayOfWeek: entry?.dayOfWeek ?? 'monday',
  startTime: entry?.startTime ?? '',
  endTime: entry?.endTime ?? '',
  cameraIdsText: entry?.cameraIds.join(', ') ?? '',
  notes: entry?.notes ?? '',
  isActive: entry?.isActive ?? true,
})

interface TimetableFormProps {
  entry?: TimetableEntry | null
  classGroupOptions: Array<{ label: string; value: string }>
  subjectOptions: Array<{ label: string; value: string }>
  teacherOptions: Array<{ label: string; value: string }>
  classroomOptions: Array<{ label: string; value: string }>
  submitError: string | null
  referenceError?: string | null
  isSubmitting: boolean
  onCancel: () => void
  onSubmit: (values: TimetableSubmitValues) => Promise<void>
}

function TimetableEntryForm({
  entry,
  classGroupOptions,
  subjectOptions,
  teacherOptions,
  classroomOptions,
  submitError,
  referenceError,
  isSubmitting,
  onCancel,
  onSubmit,
}: TimetableFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TimetableFormValues, undefined, TimetableSubmitValues>({
    resolver: zodResolver(timetableSchema),
    defaultValues: getDefaultValues(entry),
  })

  useEffect(() => {
    reset(getDefaultValues(entry))
  }, [entry, reset])

  const submitHandler = handleSubmit(async (values) => {
    await onSubmit(values)
  })

  return (
    <form className="space-y-5" onSubmit={submitHandler}>
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
        <SelectField
          label="Day of week"
          options={dayOptions}
          error={errors.dayOfWeek?.message}
          {...register('dayOfWeek')}
        />
        <InputField
          label="Start time"
          type="time"
          error={errors.startTime?.message}
          {...register('startTime')}
        />
        <InputField
          label="End time"
          type="time"
          error={errors.endTime?.message}
          {...register('endTime')}
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
        placeholder="Add scheduling context or setup notes"
        error={errors.notes?.message}
        {...register('notes')}
      />

      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
          {...register('isActive')}
        />
        Keep this timetable entry active
      </label>

      {referenceError ? <ErrorMessage message={referenceError} /> : null}
      {submitError ? <ErrorMessage message={submitError} /> : null}

      <FormActions
        submitLabel={entry ? 'Save changes' : 'Create entry'}
        loadingLabel={entry ? 'Saving changes...' : 'Creating entry...'}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
      />
    </form>
  )
}

function TimetablePage() {
  const queryClient = useQueryClient()
  const [dayFilter, setDayFilter] = useState<TimetableDayOfWeek | ''>('')
  const [classGroupFilter, setClassGroupFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [statusTarget, setStatusTarget] = useState<{
    entry: TimetableEntry
    nextActive: boolean
  } | null>(null)

  const timetableQuery = useQuery({
    queryKey: ['timetable', dayFilter, classGroupFilter, statusFilter],
    queryFn: () =>
      timetableApi.listTimetableEntries({
        page: 1,
        limit: 100,
        dayOfWeek: dayFilter || undefined,
        classGroupId: classGroupFilter || undefined,
        isActive:
          statusFilter === ''
            ? undefined
            : statusFilter === 'active',
      }),
  })

  const classGroupsQuery = useQuery({
    queryKey: ['class-groups', 'timetable-options'],
    queryFn: () => classGroupsApi.listClassGroups({ page: 1, limit: 100 }),
  })

  const subjectsQuery = useQuery({
    queryKey: ['subjects', 'timetable-options'],
    queryFn: () => subjectsApi.listSubjects({ page: 1, limit: 100 }),
  })

  const teacherProfilesQuery = useQuery({
    queryKey: ['teachers', 'timetable-options'],
    queryFn: () => teachersApi.listTeachers({ page: 1, limit: 100 }),
  })

  const teacherUsersQuery = useQuery({
    queryKey: ['users', 'timetable-teacher-options'],
    queryFn: () => usersApi.listUsers({ page: 1, limit: 100, role: 'teacher' }),
  })

  const classroomsQuery = useQuery({
    queryKey: ['classrooms', 'timetable-options'],
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
    mutationFn: async (values: TimetableSubmitValues) => {
      setFormError(null)

      const basePayload = {
        classGroupId: values.classGroupId,
        subjectId: values.subjectId,
        teacherId: values.teacherId,
        classroomId: values.classroomId,
        dayOfWeek: values.dayOfWeek,
        startTime: values.startTime,
        endTime: values.endTime,
        cameraIds: parseCameraIds(values.cameraIdsText),
        notes: values.notes?.trim() || undefined,
        isActive: values.isActive,
      }

      if (editingEntry) {
        const payload: UpdateTimetableEntryInput = basePayload
        return timetableApi.updateTimetableEntry(editingEntry.id, payload)
      }

      const payload: CreateTimetableEntryInput = basePayload
      return timetableApi.createTimetableEntry(payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['timetable'] })
      setSheetOpen(false)
      setEditingEntry(null)
      setFormError(null)
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, 'Unable to save the timetable entry.'))
    },
  })

  const statusMutation = useMutation({
    mutationFn: async (target: { entry: TimetableEntry; nextActive: boolean }) =>
      timetableApi.updateTimetableEntry(target.entry.id, {
        isActive: target.nextActive,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['timetable'] })
      setStatusTarget(null)
    },
  })

  const totalEntries =
    timetableQuery.data?.meta.totalItems ?? timetableQuery.data?.items.length ?? 0

  const columns = useMemo<DataTableColumn<TimetableEntry>[]>(
    () => [
      {
        key: 'schedule',
        header: 'Schedule',
        render: (entry) => (
          <div className="space-y-1">
            <p className="font-semibold capitalize text-ink-950">{entry.dayOfWeek}</p>
            <p className="text-xs text-ink-500">
              {formatTimeRange(entry.startTime, entry.endTime)}
            </p>
          </div>
        ),
      },
      {
        key: 'classGroup',
        header: 'Class Group',
        render: (entry) => (
          <span>{classGroupLabelMap.get(entry.classGroupId ?? '') ?? 'Not linked'}</span>
        ),
      },
      {
        key: 'subject',
        header: 'Subject',
        render: (entry) => (
          <span>{subjectLabelMap.get(entry.subjectId ?? '') ?? 'Not linked'}</span>
        ),
      },
      {
        key: 'teacher',
        header: 'Teacher',
        render: (entry) => (
          <span>{teacherLabelMap.get(entry.teacherId ?? '') ?? 'Not linked'}</span>
        ),
      },
      {
        key: 'classroom',
        header: 'Classroom',
        render: (entry) => (
          <div className="space-y-1">
            <p>{classroomLabelMap.get(entry.classroomId ?? '') ?? 'Not linked'}</p>
            <p className="text-xs text-ink-500">
              {entry.cameraIds.length
                ? `${entry.cameraIds.length} camera override(s)`
                : 'Uses classroom cameras'}
            </p>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (entry) => (
          <StatusBadge
            label={entry.isActive ? 'Active' : 'Inactive'}
            tone={entry.isActive ? 'success' : 'warning'}
          />
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-44',
        headerClassName: 'text-right',
        render: (entry) => (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                setStatusTarget({
                  entry,
                  nextActive: !entry.isActive,
                })
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            >
              {entry.isActive ? 'Disable' : 'Enable'}
            </button>
            <TableActions
              onEdit={() => {
                setEditingEntry(entry)
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

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'Timetable' },
        ]}
        eyebrow="Scheduling"
        title="Timetable"
        description="Manage reusable weekly schedule entries that can later drive session creation."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingEntry(null)
              setFormError(null)
              setSheetOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-ink-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-ink-800"
          >
            <Plus className="h-4 w-4" />
            Add entry
          </button>
        }
      />

      {referenceError ? <ErrorMessage message={referenceError} /> : null}

      <div className="grid gap-4 lg:grid-cols-[220px_280px_200px]">
        <SelectField
          label="Day"
          value={dayFilter}
          options={[{ value: '', label: 'All days' }, ...dayOptions]}
          onChange={(event) => setDayFilter(event.target.value as TimetableDayOfWeek | '')}
        />
        <SelectField
          label="Class group"
          value={classGroupFilter}
          options={[{ value: '', label: 'All class groups' }, ...classGroupOptions]}
          onChange={(event) => setClassGroupFilter(event.target.value)}
        />
        <SelectField
          label="Status"
          value={statusFilter}
          options={statusOptions}
          onChange={(event) =>
            setStatusFilter(event.target.value as 'active' | 'inactive' | '')
          }
        />
      </div>

      {timetableQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(
            timetableQuery.error,
            'Unable to load timetable entries.',
          )}
        />
      ) : timetableQuery.isLoading ? (
        <div className="app-surface p-6">
          <Loader label="Loading timetable entries..." />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-sm text-ink-500">{totalEntries} timetable entries</p>
          </div>
          <DataTable
            data={timetableQuery.data?.items ?? []}
            columns={columns}
            getRowKey={(entry) => entry.id}
            emptyTitle="No timetable entries found."
            emptyDescription="Adjust the filters or create a new weekly entry."
          />
        </>
      )}

      <SidePanel
        open={sheetOpen}
        title={editingEntry ? 'Edit timetable entry' : 'Create timetable entry'}
        description="Define a reusable class schedule block without altering the existing session workflow."
        onClose={() => {
          setSheetOpen(false)
          setEditingEntry(null)
          setFormError(null)
        }}
      >
        <TimetableEntryForm
          entry={editingEntry}
          classGroupOptions={classGroupOptions}
          subjectOptions={subjectOptions}
          teacherOptions={teacherOptions}
          classroomOptions={classroomOptions}
          submitError={formError}
          referenceError={referenceError}
          isSubmitting={saveMutation.isPending}
          onCancel={() => {
            setSheetOpen(false)
            setEditingEntry(null)
            setFormError(null)
          }}
          onSubmit={async (values) => {
            await saveMutation.mutateAsync(values)
          }}
        />
      </SidePanel>

      <ConfirmDialog
        open={!!statusTarget}
        title={
          statusTarget?.nextActive
            ? 'Activate timetable entry?'
            : 'Deactivate timetable entry?'
        }
        description={
          statusTarget
            ? `This schedule block will be ${
                statusTarget.nextActive ? 'available' : 'hidden'
              } for future timetable use.`
            : undefined
        }
        confirmLabel={statusTarget?.nextActive ? 'Activate' : 'Deactivate'}
        tone={statusTarget?.nextActive ? 'brand' : 'danger'}
        isLoading={statusMutation.isPending}
        onCancel={() => setStatusTarget(null)}
        onConfirm={async () => {
          if (statusTarget) {
            await statusMutation.mutateAsync(statusTarget)
          }
        }}
      />
    </div>
  )
}

export default TimetablePage
