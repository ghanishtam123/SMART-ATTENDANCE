import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
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
import SelectField from '../../components/forms/SelectField'
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
  createLoginAccount: boolean
  userId: string
  login: {
    fullName: string
    email: string
    password: string
    isActive: boolean
  }
}

const isValidOptionalEmail = (value: string) =>
  !value || z.string().email().safeParse(value).success

const teacherFormSchemaBase = z.object({
  employeeId: z.string().trim().min(1, 'Employee ID is required.'),
  department: z.string().trim().min(2, 'Department is required.'),
  designation: z.string().trim().min(2, 'Designation is required.'),
  subjectsTaught: z.array(z.string()),
  assignedClassGroups: z.array(z.string()),
  createLoginAccount: z.boolean(),
  userId: z.string(),
  login: z.object({
    fullName: z.string(),
    email: z
      .string()
      .trim()
      .refine(isValidOptionalEmail, {
        message: 'Enter a valid login email address.',
      }),
    password: z.string(),
    isActive: z.boolean(),
  }),
})

const buildTeacherFormSchema = (isEditMode: boolean) =>
  teacherFormSchemaBase.superRefine((value, ctx) => {
    if (isEditMode) {
      return
    }

    if (value.createLoginAccount) {
      if (value.login.fullName.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['login', 'fullName'],
          message: 'Teacher full name is required.',
        })
      }

      if (!value.login.email.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['login', 'email'],
          message: 'Login email is required when login creation is enabled.',
        })
      }

      if (value.login.password.trim().length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['login', 'password'],
          message: 'Password must be at least 8 characters.',
        })
      }

      return
    }

    if (!value.userId.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['userId'],
        message: 'Select an existing teacher login account or enable login creation.',
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
  createLoginAccount: !teacher,
  userId: teacher?.userId ?? '',
  login: {
    fullName: linkedUser?.fullName ?? '',
    email: linkedUser?.email ?? '',
    password: '',
    isActive: linkedUser?.isActive ?? true,
  },
})

interface TeacherFormProps {
  teacher?: TeacherProfile | null
  linkedUser?: User | null
  userOptions: Array<{ label: string; value: string }>
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
  userOptions,
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

  const createLoginAccount = useWatch({
    control,
    name: 'createLoginAccount',
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
          <p className="text-sm text-ink-500">
            Core profile details for the teacher record.
          </p>
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
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-ink-950">Login Account Setup</h3>
            <p className="text-sm text-ink-500">
              Teacher login is usually created here so the profile is ready in one step.
            </p>
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
                <p className="text-xs text-ink-500">
                  Manage password and active status from the Users module.
                </p>
              </div>
            ) : (
              <p>No linked login account is attached to this teacher profile yet.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-ink-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
                {...register('createLoginAccount')}
              />
              <span className="space-y-1">
                <span className="block font-medium text-ink-950">
                  Create linked teacher login account
                </span>
                <span className="block text-ink-500">
                  Enabled by default so the teacher profile and login are provisioned
                  together.
                </span>
              </span>
            </label>

            {createLoginAccount ? (
              <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
                <div className="mb-4 space-y-1">
                  <p className="text-sm font-semibold text-ink-950">Login Account Setup</p>
                  <p className="text-sm text-ink-500">
                    These credentials will create the linked teacher user account.
                  </p>
                </div>

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
                  label="Temporary password"
                  type="password"
                  placeholder="Teacher@123"
                  error={errors.login?.password?.message}
                  {...register('login.password')}
                />

                <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-4 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
                    {...register('login.isActive')}
                  />
                  <span className="space-y-1">
                    <span className="block font-medium text-ink-950">
                      Keep login account active
                    </span>
                    <span className="block text-ink-500">
                      Disable this if the teacher login should be provisioned but not
                      used yet.
                    </span>
                  </span>
                </label>
              </div>
            ) : (
              <SelectField
                label="Link existing teacher login"
                options={userOptions}
                placeholder="Select existing teacher user"
                error={errors.userId?.message}
                {...register('userId')}
              />
            )}
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
        createLoginAccount: values.createLoginAccount,
      }

      if (values.createLoginAccount) {
        payload.login = {
          fullName: values.login.fullName.trim(),
          email: values.login.email.trim(),
          password: values.login.password,
          isActive: values.login.isActive,
        }
      } else if (values.userId.trim()) {
        payload.userId = values.userId.trim()
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
        className: 'w-28',
        headerClassName: 'text-right',
        render: (teacher) => (
          <TableActions
            onEdit={() => {
              setEditingTeacher(teacher)
              setFormError(null)
              setSuccessMessage(null)
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
        description="Create teacher profiles and linked teacher login accounts together from one admin form."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingTeacher(null)
              setFormError(null)
              setSuccessMessage(null)
              setSheetOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-ink-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-ink-800"
          >
            <Plus className="h-4 w-4" />
            Add teacher
          </button>
        }
      />

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      ) : null}

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
          emptyDescription="Create a teacher profile and optionally provision the login in the same flow."
        />
      )}

      <SidePanel
        open={sheetOpen}
        title={editingTeacher ? 'Edit teacher profile' : 'Create teacher profile'}
        description="Teacher profiles connect professional data, teaching assignments, and linked login access."
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
