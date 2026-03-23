import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { classGroupsApi } from '../../api/classGroups.api'
import { subjectsApi } from '../../api/subjects.api'
import { teachersApi } from '../../api/teachers.api'
import { usersApi } from '../../api/users.api'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import ErrorMessage from '../../components/common/ErrorMessage'
import Loader from '../../components/common/Loader'
import PageHeader from '../../components/common/PageHeader'
import SearchInput from '../../components/common/SearchInput'
import SidePanel from '../../components/common/SidePanel'
import FormActions from '../../components/forms/FormActions'
import InputField from '../../components/forms/InputField'
import SelectField from '../../components/forms/SelectField'
import DataTable, { type DataTableColumn } from '../../components/tables/DataTable'
import TableActions from '../../components/tables/TableActions'
import { routes } from '../../constants/routes'
import useDebounce from '../../hooks/useDebounce'
import type {
  CreateTeacherInput,
  TeacherProfile,
  UpdateTeacherInput,
} from '../../types/teacher'
import { getErrorMessage } from '../../utils/format'

const teacherSchema = z.object({
  userId: z.string().trim().min(1, 'Select a teacher account.'),
  employeeId: z.string().trim().min(1, 'Employee ID is required.'),
  department: z.string().trim().min(2, 'Department is required.'),
  designation: z.string().trim().min(2, 'Designation is required.'),
  subjectsTaught: z.array(z.string()).default([]),
  assignedClassGroups: z.array(z.string()).default([]),
})

type TeacherFormValues = z.input<typeof teacherSchema>
type TeacherSubmitValues = z.output<typeof teacherSchema>

const getDefaultValues = (
  teacher?: TeacherProfile | null,
): TeacherFormValues => ({
  userId: teacher?.userId ?? '',
  employeeId: teacher?.employeeId ?? '',
  department: teacher?.department ?? '',
  designation: teacher?.designation ?? '',
  subjectsTaught: teacher?.subjectsTaught ?? [],
  assignedClassGroups: teacher?.assignedClassGroups ?? [],
})

interface TeacherFormProps {
  teacher?: TeacherProfile | null
  userOptions: Array<{ label: string; value: string }>
  subjectOptions: Array<{ label: string; value: string }>
  classGroupOptions: Array<{ label: string; value: string }>
  submitError: string | null
  referenceError?: string | null
  isSubmitting: boolean
  onCancel: () => void
  onSubmit: (values: TeacherSubmitValues) => Promise<void>
}

function TeacherForm({
  teacher,
  userOptions,
  subjectOptions,
  classGroupOptions,
  submitError,
  referenceError,
  isSubmitting,
  onCancel,
  onSubmit,
}: TeacherFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TeacherFormValues, undefined, TeacherSubmitValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: getDefaultValues(teacher),
  })

  useEffect(() => {
    reset(getDefaultValues(teacher))
  }, [reset, teacher])

  const submitHandler = handleSubmit(async (values) => {
    await onSubmit(values)
  })

  return (
    <form className="space-y-5" onSubmit={submitHandler}>
      <SelectField
        label="Linked user account"
        options={userOptions}
        placeholder="Select a teacher user"
        error={errors.userId?.message}
        {...register('userId')}
      />

      <div className="grid gap-5 md:grid-cols-2">
        <InputField
          label="Employee ID"
          placeholder="EMP-202"
          error={errors.employeeId?.message}
          {...register('employeeId')}
        />
        <InputField
          label="Department"
          placeholder="Computer Science"
          error={errors.department?.message}
          {...register('department')}
        />
      </div>

      <InputField
        label="Designation"
        placeholder="Assistant Professor"
        error={errors.designation?.message}
        {...register('designation')}
      />

      <SelectField
        label="Subjects taught"
        multiple
        options={subjectOptions}
        hint="Hold Ctrl/Cmd to select multiple subjects."
        error={errors.subjectsTaught?.message}
        {...register('subjectsTaught')}
      />

      <SelectField
        label="Assigned class groups"
        multiple
        options={classGroupOptions}
        hint="Link the teacher profile to one or more academic groups."
        error={errors.assignedClassGroups?.message}
        {...register('assignedClassGroups')}
      />

      {referenceError ? <ErrorMessage message={referenceError} /> : null}
      {submitError ? <ErrorMessage message={submitError} /> : null}

      <FormActions
        submitLabel={teacher ? 'Save changes' : 'Create teacher profile'}
        loadingLabel={teacher ? 'Saving changes...' : 'Creating profile...'}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
      />
    </form>
  )
}

function TeachersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<TeacherProfile | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TeacherProfile | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search)
  const debouncedDepartment = useDebounce(departmentFilter)

  const teachersQuery = useQuery({
    queryKey: ['teachers', debouncedSearch, debouncedDepartment],
    queryFn: () =>
      teachersApi.listTeachers({
        page: 1,
        limit: 100,
        search: debouncedSearch || undefined,
        department: debouncedDepartment || undefined,
      }),
  })

  const teacherUsersQuery = useQuery({
    queryKey: ['users', 'teacher-options'],
    queryFn: () =>
      usersApi.listUsers({
        page: 1,
        limit: 100,
        role: 'teacher',
      }),
  })

  const subjectsQuery = useQuery({
    queryKey: ['subjects', 'teacher-options'],
    queryFn: () => subjectsApi.listSubjects({ page: 1, limit: 100 }),
  })

  const classGroupsQuery = useQuery({
    queryKey: ['class-groups', 'teacher-options'],
    queryFn: () => classGroupsApi.listClassGroups({ page: 1, limit: 100 }),
  })

  const userMap = useMemo(
    () =>
      new Map(
        (teacherUsersQuery.data?.items ?? []).map((user) => [user.id, user] as const),
      ),
    [teacherUsersQuery.data?.items],
  )

  const userOptions = useMemo(
    () =>
      (teacherUsersQuery.data?.items ?? []).map((user) => ({
        value: user.id,
        label: `${user.fullName} • ${user.email}`,
      })),
    [teacherUsersQuery.data?.items],
  )

  const subjectOptions = useMemo(
    () =>
      (subjectsQuery.data?.items ?? []).map((subject) => ({
        value: subject.id,
        label: `${subject.code} • ${subject.name}`,
      })),
    [subjectsQuery.data?.items],
  )

  const classGroupOptions = useMemo(
    () =>
      (classGroupsQuery.data?.items ?? []).map((group) => ({
        value: group.id,
        label: `${group.code} • ${group.name}`,
      })),
    [classGroupsQuery.data?.items],
  )

  const referenceError = useMemo(() => {
    const errors = [
      teacherUsersQuery.isError
        ? getErrorMessage(teacherUsersQuery.error, 'Unable to load teacher users.')
        : null,
      subjectsQuery.isError
        ? getErrorMessage(subjectsQuery.error, 'Unable to load subject options.')
        : null,
      classGroupsQuery.isError
        ? getErrorMessage(classGroupsQuery.error, 'Unable to load class group options.')
        : null,
    ].filter(Boolean)

    return errors[0] ?? null
  }, [
    classGroupsQuery.error,
    classGroupsQuery.isError,
    subjectsQuery.error,
    subjectsQuery.isError,
    teacherUsersQuery.error,
    teacherUsersQuery.isError,
  ])

  const saveMutation = useMutation({
    mutationFn: async (values: TeacherSubmitValues) => {
      setFormError(null)

      const basePayload = {
        userId: values.userId,
        employeeId: values.employeeId.trim().toUpperCase(),
        department: values.department.trim(),
        designation: values.designation.trim(),
        subjectsTaught: values.subjectsTaught,
        assignedClassGroups: values.assignedClassGroups,
      }

      if (editingTeacher) {
        const payload: UpdateTeacherInput = basePayload
        return teachersApi.updateTeacher(editingTeacher.id, payload)
      }

      const payload: CreateTeacherInput = basePayload
      return teachersApi.createTeacher(payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teachers'] })
      setSheetOpen(false)
      setEditingTeacher(null)
      setFormError(null)
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, 'Unable to save the teacher profile.'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teachersApi.deleteTeacher(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teachers'] })
      setDeleteTarget(null)
    },
  })

  const columns = useMemo<DataTableColumn<TeacherProfile>[]>(
    () => [
      {
        key: 'teacher',
        header: 'Teacher',
        render: (teacher) => {
          const linkedUser = userMap.get(teacher.userId ?? '')

          return (
            <div className="space-y-1">
              <p className="font-semibold text-ink-950">
                {linkedUser?.fullName ?? 'Linked user not loaded'}
              </p>
              <p className="text-xs text-ink-500">
                {linkedUser?.email ?? teacher.userId}
              </p>
            </div>
          )
        },
      },
      {
        key: 'employeeId',
        header: 'Employee',
        render: (teacher) => (
          <div className="space-y-1">
            <p>{teacher.employeeId}</p>
            <p className="text-xs text-ink-500">{teacher.designation}</p>
          </div>
        ),
      },
      {
        key: 'department',
        header: 'Department',
        render: (teacher) => <span>{teacher.department}</span>,
      },
      {
        key: 'assignments',
        header: 'Assignments',
        render: (teacher) => (
          <div className="space-y-1">
            <p>{teacher.subjectsTaught.length} subject links</p>
            <p className="text-xs text-ink-500">
              {teacher.assignedClassGroups.length} class groups
            </p>
          </div>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-28',
        headerClassName: 'text-right',
        render: (teacher) => (
          <TableActions
            onEdit={() => {
              setEditingTeacher(teacher)
              setFormError(null)
              setSheetOpen(true)
            }}
            onDelete={() => setDeleteTarget(teacher)}
          />
        ),
      },
    ],
    [userMap],
  )

  const referencesLoading =
    teacherUsersQuery.isLoading || subjectsQuery.isLoading || classGroupsQuery.isLoading

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'Teachers' },
        ]}
        eyebrow="Academics"
        title="Teachers"
        description="Link staff user accounts to teaching profiles, subjects, and assigned groups."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingTeacher(null)
              setFormError(null)
              setSheetOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-ink-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-ink-800"
          >
            <Plus className="h-4 w-4" />
            Add teacher
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch('')}
          placeholder="Search by employee ID, designation, or department"
        />
        <InputField
          label="Department filter"
          value={departmentFilter}
          onChange={(event) => setDepartmentFilter(event.target.value)}
          placeholder="Filter by department"
        />
      </div>

      {teachersQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(teachersQuery.error, 'Unable to load teachers.')}
        />
      ) : teachersQuery.isLoading ? (
        <div className="app-surface p-6">
          <Loader label="Loading teacher profiles..." />
        </div>
      ) : (
        <DataTable
          data={teachersQuery.data?.items ?? []}
          columns={columns}
          getRowKey={(teacher) => teacher.id}
          emptyTitle="No teacher profiles found."
          emptyDescription="Create a teacher profile after creating teacher user accounts."
        />
      )}

      <SidePanel
        open={sheetOpen}
        title={editingTeacher ? 'Edit teacher profile' : 'Create teacher profile'}
        description="Teacher profiles connect user accounts to teaching assignments and reporting scope."
        onClose={() => {
          setSheetOpen(false)
          setEditingTeacher(null)
          setFormError(null)
        }}
      >
        {referencesLoading ? (
          <Loader label="Loading form options..." />
        ) : (
          <TeacherForm
            teacher={editingTeacher}
            userOptions={userOptions}
            subjectOptions={subjectOptions}
            classGroupOptions={classGroupOptions}
            submitError={formError}
            referenceError={referenceError}
            isSubmitting={saveMutation.isPending}
            onCancel={() => {
              setSheetOpen(false)
              setEditingTeacher(null)
              setFormError(null)
            }}
            onSubmit={async (values) => {
              await saveMutation.mutateAsync(values)
            }}
          />
        )}
      </SidePanel>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete teacher profile?"
        description={
          deleteTarget
            ? `${deleteTarget.employeeId} will be removed from the teacher profile module.`
            : undefined
        }
        confirmLabel="Delete"
        tone="danger"
        isLoading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id)
          }
        }}
      />
    </div>
  )
}

export default TeachersPage
