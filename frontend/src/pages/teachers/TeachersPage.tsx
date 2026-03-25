import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
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
import StatusBadge from '../../components/common/StatusBadge'
import FormActions from '../../components/forms/FormActions'
import InputField from '../../components/forms/InputField'
import MultiOptionField from '../../components/forms/MultiOptionField'
import DataTable, { type DataTableColumn } from '../../components/tables/DataTable'
import TableActions from '../../components/tables/TableActions'
import { routes } from '../../constants/routes'
import useDebounce from '../../hooks/useDebounce'
import type { User } from '../../types/user'
import type {
  CreateTeacherPayload,
  TeacherProfile,
  UpdateTeacherInput,
} from '../../types/teacher'
import { getErrorMessage } from '../../utils/format'

interface TeacherFormValues {
  employeeId: string
  department: string
  designation: string
  subjectsTaught: string[]
  assignedClassGroups: string[]
  login: {
    fullName: string
    email: string
    password: string
  }
}

const teacherFormSchemaBase = z.object({
  employeeId: z.string().trim().min(1, 'Employee ID is required.'),
  department: z.string().trim().min(2, 'Department is required.'),
  designation: z.string().trim().min(2, 'Designation is required.'),
  subjectsTaught: z.array(z.string()),
  assignedClassGroups: z.array(z.string()),
  login: z.object({
    fullName: z.string().trim(),
    email: z.string().trim().email('Enter a valid login email address.'),
    password: z.string().trim(),
  }),
})

const buildTeacherFormSchema = (isEditMode: boolean) =>
  teacherFormSchemaBase.superRefine((value, ctx) => {
    if (isEditMode) {
      return
    }

    if (value.login.fullName.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['login', 'fullName'],
        message: 'Teacher full name is required.',
      })
    }

    if (value.login.password.trim().length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['login', 'password'],
        message: 'Password must be at least 8 characters.',
      })
    }
  })

const getDefaultValues = (
  teacher?: TeacherProfile | null,
  linkedUser?: User | null,
): TeacherFormValues => ({
  employeeId: teacher?.employeeId ?? '',
  department: teacher?.department ?? '',
  designation: teacher?.designation ?? '',
  subjectsTaught: teacher?.subjectsTaught ?? [],
  assignedClassGroups: teacher?.assignedClassGroups ?? [],
  login: {
    fullName: linkedUser?.fullName ?? '',
    email: linkedUser?.email ?? '',
    password: '',
  },
})

interface TeacherFormProps {
  teacher?: TeacherProfile | null
  linkedUser?: User | null
  subjectOptions: Array<{ label: string; value: string }>
  classGroupOptions: Array<{ label: string; value: string }>
  submitError: string | null
  referenceError?: string | null
  isSubmitting: boolean
  onCancel: () => void
  onSubmit: (values: TeacherFormValues) => Promise<void>
}

function TeacherForm({
  teacher,
  linkedUser,
  subjectOptions,
  classGroupOptions,
  submitError,
  referenceError,
  isSubmitting,
  onCancel,
  onSubmit,
}: TeacherFormProps) {
  const isEditMode = Boolean(teacher)
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TeacherFormValues, undefined, TeacherFormValues>({
    resolver: zodResolver(buildTeacherFormSchema(isEditMode)),
    defaultValues: getDefaultValues(teacher, linkedUser),
  })

  useEffect(() => {
    reset(getDefaultValues(teacher, linkedUser))
  }, [linkedUser, reset, teacher])

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 space-y-1">
          <h3 className="text-base font-semibold text-ink-950">
            Professional Details
          </h3>
          <p className="text-sm text-ink-500">Core profile details.</p>
        </div>

        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <InputField
              label="Employee ID"
              placeholder="EMP001"
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
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 space-y-1">
          <h3 className="text-base font-semibold text-ink-950">
            Teaching Assignments
          </h3>
          <p className="text-sm text-ink-500">
            Link the teacher profile to subjects and class groups.
          </p>
        </div>

        <div className="space-y-5">
          <Controller
            control={control}
            name="subjectsTaught"
            render={({ field }) => (
              <MultiOptionField
                label="Subjects taught"
                options={subjectOptions}
                value={field.value}
                onChange={field.onChange}
                hint="Choose one or more subjects linked to this teacher."
                error={errors.subjectsTaught?.message}
                emptyMessage="No subjects available yet."
              />
            )}
          />

          <Controller
            control={control}
            name="assignedClassGroups"
            render={({ field }) => (
              <MultiOptionField
                label="Assigned class groups"
                options={classGroupOptions}
                value={field.value}
                onChange={field.onChange}
                hint="Choose the academic groups this teacher will be responsible for."
                error={errors.assignedClassGroups?.message}
                emptyMessage="No class groups available yet."
              />
            )}
          />
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-ink-950">
              Teacher Login Account (Required)
            </h3>
            <p className="text-sm text-ink-500">Login is created automatically.</p>
          </div>
          {isEditMode ? (
            <StatusBadge
              label={
                linkedUser
                  ? linkedUser.isActive
                    ? 'Login Enabled'
                    : 'Login Disabled'
                  : 'No Login Account'
              }
              tone={
                linkedUser ? (linkedUser.isActive ? 'success' : 'warning') : 'neutral'
              }
            />
          ) : null}
        </div>

        {isEditMode ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-ink-600">
            {linkedUser ? (
              <div className="space-y-1">
                <p className="font-medium text-ink-900">{linkedUser.fullName}</p>
                <p>{linkedUser.email}</p>
                <p className="text-xs text-ink-500">Password is managed separately.</p>
              </div>
            ) : (
              <p>No linked login account.</p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
            <div className="grid gap-5 md:grid-cols-2">
              <InputField
                label="Full name"
                placeholder="Teacher One"
                error={errors.login?.fullName?.message}
                {...register('login.fullName')}
              />
              <InputField
                label="Login email"
                type="email"
                placeholder="teacher1@example.com"
                error={errors.login?.email?.message}
                {...register('login.email')}
              />
            </div>

            <InputField
              label="Temporary Password"
              type="password"
              placeholder="Teacher@123"
              error={errors.login?.password?.message}
              {...register('login.password')}
            />
          </div>
        )}
      </div>

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
  const [statusTarget, setStatusTarget] = useState<{
    teacher: TeacherProfile
    linkedUser: User
    nextActive: boolean
  } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
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
    mutationFn: async (values: TeacherFormValues) => {
      setFormError(null)

      const basePayload = {
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

      const payload: CreateTeacherPayload = {
        ...basePayload,
        createLoginAccount: true,
        login: {
          fullName: values.login.fullName.trim(),
          email: values.login.email.trim().toLowerCase(),
          password: values.login.password,
          isActive: true,
        },
      }

      return teachersApi.createTeacher(payload)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teachers'] }),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
      ])
      setSuccessMessage(
        editingTeacher
          ? 'Teacher profile updated successfully.'
          : 'Teacher profile created successfully.',
      )
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
      setSuccessMessage('Teacher profile deleted successfully.')
      setDeleteTarget(null)
    },
  })

  const statusMutation = useMutation({
    mutationFn: async (target: {
      teacher: TeacherProfile
      linkedUser: User
      nextActive: boolean
    }) =>
      usersApi.updateUserStatus(target.linkedUser.id, {
        isActive: target.nextActive,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teachers'] }),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
      ])
      setSuccessMessage('Teacher login status updated successfully.')
      setStatusTarget(null)
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
                {linkedUser?.fullName ?? 'No linked login'}
              </p>
              <p className="text-xs text-ink-500">
                {linkedUser?.email ?? 'Profile only'}
              </p>
            </div>
          )
        },
      },
      {
        key: 'employeeId',
        header: 'Professional',
        render: (teacher) => (
          <div className="space-y-1">
            <p>{teacher.employeeId}</p>
            <p className="text-xs text-ink-500">
              {teacher.department} • {teacher.designation}
            </p>
          </div>
        ),
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
        key: 'login',
        header: 'Login',
        render: (teacher) => {
          const linkedUser = userMap.get(teacher.userId ?? '')

          return (
            <StatusBadge
              label={
                linkedUser
                  ? linkedUser.isActive
                    ? 'Login Enabled'
                    : 'Login Disabled'
                  : 'No Login Account'
              }
              tone={
                linkedUser ? (linkedUser.isActive ? 'success' : 'warning') : 'neutral'
              }
            />
          )
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-44',
        headerClassName: 'text-right',
        render: (teacher) => {
          const linkedUser = userMap.get(teacher.userId ?? '')

          return (
            <div className="flex items-center justify-end gap-2">
              {linkedUser ? (
                <button
                  type="button"
                  onClick={() =>
                    setStatusTarget({
                      teacher,
                      linkedUser,
                      nextActive: !linkedUser.isActive,
                    })
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                >
                  {linkedUser.isActive ? 'Disable' : 'Enable'}
                </button>
              ) : null}
              <TableActions
                onEdit={() => {
                  setEditingTeacher(teacher)
                  setFormError(null)
                  setSuccessMessage(null)
                  setSheetOpen(true)
                }}
                onDelete={() => setDeleteTarget(teacher)}
              />
            </div>
          )
        },
      },
    ],
    [userMap],
  )

  const referencesLoading =
    teacherUsersQuery.isLoading || subjectsQuery.isLoading || classGroupsQuery.isLoading
  const activeLinkedUser = editingTeacher ? userMap.get(editingTeacher.userId ?? '') : null

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'Teachers' },
        ]}
        eyebrow="Academics"
        title="Teachers"
        description="Create teacher profiles and required linked teacher login accounts together from one admin form."
      />

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <SearchInput
          wrapperClassName="xl:flex-1"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch('')}
          placeholder="Search by employee ID, designation, or department"
        />
        <div className="flex flex-col gap-3 sm:flex-row xl:items-center">
          <label className="flex h-12 min-w-[220px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-brand-200 focus-within:ring-4 focus-within:ring-brand-100/70">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
              Dept
            </span>
            <input
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              placeholder="Filter by department"
              className="w-full bg-transparent text-sm text-ink-950 placeholder:text-ink-400 outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setEditingTeacher(null)
              setFormError(null)
              setSuccessMessage(null)
              setSheetOpen(true)
            }}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink-950 px-4 text-sm font-medium whitespace-nowrap text-white transition hover:bg-ink-800"
          >
            <Plus className="h-4 w-4" />
            Add teacher
          </button>
        </div>
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
          emptyDescription="Create a teacher profile and linked login account in the same flow."
        />
      )}

      <SidePanel
        open={sheetOpen}
        title={editingTeacher ? 'Edit teacher profile' : 'Create teacher profile'}
        description="Create a teacher profile and login."
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
            linkedUser={activeLinkedUser}
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

      <ConfirmDialog
        open={!!statusTarget}
        title={
          statusTarget?.nextActive ? 'Enable teacher login?' : 'Disable teacher login?'
        }
        description={
          statusTarget
            ? `${statusTarget.linkedUser.fullName} will be ${
                statusTarget.nextActive ? 'enabled' : 'disabled'
              }.`
            : undefined
        }
        confirmLabel={statusTarget?.nextActive ? 'Enable' : 'Disable'}
        tone={statusTarget?.nextActive ? 'brand' : 'danger'}
        isLoading={statusMutation.isPending}
        onCancel={() => setStatusTarget(null)}
        onConfirm={() => {
          if (statusTarget) {
            statusMutation.mutate(statusTarget)
          }
        }}
      />
    </div>
  )
}

export default TeachersPage
