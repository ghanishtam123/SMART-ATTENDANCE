import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { classGroupsApi } from '../../api/classGroups.api'
import { studentsApi } from '../../api/students.api'
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
  CreateStudentPayload,
  Student,
  StudentGender,
  StudentStatus,
  UpdateStudentInput,
} from '../../types/student'
import { getErrorMessage } from '../../utils/format'

const phoneRegex = /^[0-9+\-\s()]{7,20}$/

interface StudentFormValues {
  firstName: string
  lastName: string
  rollNumber: string
  email: string
  phone: string
  gender: '' | StudentGender
  classGroupId: string
  status: StudentStatus
  createLoginAccount: boolean
  userId: string
  login: {
    email: string
    password: string
    isActive: boolean
  }
}

const isValidOptionalEmail = (value: string) =>
  !value || z.string().email().safeParse(value).success

const studentFormSchemaBase = z.object({
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  rollNumber: z.string().trim().min(1, 'Roll number is required.'),
  email: z
    .string()
    .trim()
    .refine(isValidOptionalEmail, {
      message: 'Enter a valid email address.',
    }),
  phone: z
    .string()
    .trim()
    .refine((value) => !value || phoneRegex.test(value), {
      message: 'Enter a valid phone number.',
    }),
  gender: z.enum(['', 'male', 'female', 'other']),
  classGroupId: z.string().trim().min(1, 'Select a class group.'),
  status: z.enum(['active', 'inactive']),
  createLoginAccount: z.boolean(),
  userId: z.string(),
  login: z.object({
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

const buildStudentFormSchema = (isEditMode: boolean) =>
  studentFormSchemaBase.superRefine((value, ctx) => {
    if (isEditMode) {
      return
    }

    if (value.createLoginAccount) {
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

      if (
        value.email.trim() &&
        value.login.email.trim() &&
        value.email.trim().toLowerCase() !== value.login.email.trim().toLowerCase()
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['login', 'email'],
          message: 'Student email and login email must match.',
        })
      }

      return
    }

    if (!value.userId.trim()) {
      return
    }
  })

const studentStatusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const genderOptions = [
  { value: '', label: 'Not specified' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

const getDefaultValues = (
  student?: Student | null,
  linkedUser?: User | null,
): StudentFormValues => ({
  firstName: student?.firstName ?? '',
  lastName: student?.lastName ?? '',
  rollNumber: student?.rollNumber ?? '',
  email: student?.email ?? '',
  phone: student?.phone ?? '',
  gender: (student?.gender ?? '') as '' | StudentGender,
  classGroupId: student?.classGroupId ?? '',
  status: (student?.status ?? 'active') as StudentStatus,
  createLoginAccount: false,
  userId: student?.userId ?? '',
  login: {
    email: student?.email ?? linkedUser?.email ?? '',
    password: '',
    isActive: linkedUser?.isActive ?? true,
  },
})

interface StudentFormProps {
  student?: Student | null
  linkedUser?: User | null
  userOptions: Array<{ label: string; value: string }>
  classGroupOptions: Array<{ label: string; value: string }>
  submitError: string | null
  referenceError?: string | null
  isSubmitting: boolean
  onCancel: () => void
  onSubmit: (values: StudentFormValues) => Promise<void>
}

function StudentForm({
  student,
  linkedUser,
  userOptions,
  classGroupOptions,
  submitError,
  referenceError,
  isSubmitting,
  onCancel,
  onSubmit,
}: StudentFormProps) {
  const isEditMode = Boolean(student)
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(buildStudentFormSchema(isEditMode)),
    defaultValues: getDefaultValues(student, linkedUser),
  })

  const createLoginAccount = useWatch({
    control,
    name: 'createLoginAccount',
  })
  const studentEmail = useWatch({
    control,
    name: 'email',
  })
  const loginEmail = useWatch({
    control,
    name: 'login.email',
  })

  useEffect(() => {
    reset(getDefaultValues(student, linkedUser))
  }, [linkedUser, reset, student])

  useEffect(() => {
    if (isEditMode || !createLoginAccount || !studentEmail.trim() || loginEmail.trim()) {
      return
    }

    setValue('login.email', studentEmail.trim(), {
      shouldDirty: true,
      shouldValidate: false,
    })
  }, [createLoginAccount, isEditMode, loginEmail, setValue, studentEmail])

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 space-y-1">
          <h3 className="text-base font-semibold text-ink-950">Basic Details</h3>
          <p className="text-sm text-ink-500">
            Core student identity and contact information.
          </p>
        </div>

        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <InputField
              label="First name"
              placeholder="Amit"
              error={errors.firstName?.message}
              {...register('firstName')}
            />
            <InputField
              label="Last name"
              placeholder="Kumar"
              error={errors.lastName?.message}
              {...register('lastName')}
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <InputField
              label="Roll number"
              placeholder="BCA001"
              error={errors.rollNumber?.message}
              {...register('rollNumber')}
            />
            <SelectField
              label="Gender"
              options={genderOptions}
              error={errors.gender?.message}
              {...register('gender')}
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <InputField
              label="Email"
              type="email"
              placeholder="amit@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <InputField
              label="Phone"
              placeholder="9999999999"
              error={errors.phone?.message}
              {...register('phone')}
            />
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 space-y-1">
          <h3 className="text-base font-semibold text-ink-950">Academic Details</h3>
          <p className="text-sm text-ink-500">
            Group mapping and operational status used by attendance modules.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <SelectField
            label="Class group"
            options={classGroupOptions}
            placeholder="Select class group"
            error={errors.classGroupId?.message}
            {...register('classGroupId')}
          />
          <SelectField
            label="Status"
            options={studentStatusOptions}
            error={errors.status?.message}
            {...register('status')}
          />
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-ink-950">Login Account Setup</h3>
            <p className="text-sm text-ink-500">
              Enable student portal access from the same student creation flow.
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
              <p>No linked login account is attached to this student yet.</p>
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
                  Create linked student login account
                </span>
                <span className="block text-ink-500">
                  If enabled, the student can sign in using the same email and a
                  generated user account.
                </span>
              </span>
            </label>

            {createLoginAccount ? (
              <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
                <div className="mb-4 space-y-1">
                  <p className="text-sm font-semibold text-ink-950">Login Account Setup</p>
                  <p className="text-sm text-ink-500">
                    These credentials will create the linked student user account.
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <InputField
                    label="Login email"
                    type="email"
                    placeholder="amit@example.com"
                    error={errors.login?.email?.message}
                    {...register('login.email')}
                  />
                  <InputField
                    label="Temporary password"
                    type="password"
                    placeholder="Student@123"
                    error={errors.login?.password?.message}
                    {...register('login.password')}
                  />
                </div>

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
                      Disable this if the login should be created but not usable yet.
                    </span>
                  </span>
                </label>
              </div>
            ) : (
              <SelectField
                label="Link existing student login"
                options={userOptions}
                placeholder="Optional existing student user"
                hint="Leave blank to create only the student record."
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
        submitLabel={student ? 'Save changes' : 'Create student'}
        loadingLabel={student ? 'Saving changes...' : 'Creating student...'}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
      />
    </form>
  )
}

function StudentsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StudentStatus | ''>('')
  const [classGroupFilter, setClassGroupFilter] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search)

  const studentsQuery = useQuery({
    queryKey: ['students', debouncedSearch, statusFilter, classGroupFilter],
    queryFn: () =>
      studentsApi.listStudents({
        page: 1,
        limit: 100,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        classGroupId: classGroupFilter || undefined,
      }),
  })

  const studentUsersQuery = useQuery({
    queryKey: ['users', 'student-options'],
    queryFn: () =>
      usersApi.listUsers({
        page: 1,
        limit: 100,
        role: 'student',
      }),
  })

  const classGroupsQuery = useQuery({
    queryKey: ['class-groups', 'student-options'],
    queryFn: () => classGroupsApi.listClassGroups({ page: 1, limit: 100 }),
  })

  const userMap = useMemo(
    () =>
      new Map(
        (studentUsersQuery.data?.items ?? []).map((user) => [user.id, user] as const),
      ),
    [studentUsersQuery.data?.items],
  )

  const classGroupMap = useMemo(
    () =>
      new Map(
        (classGroupsQuery.data?.items ?? []).map((group) => [group.id, group] as const),
      ),
    [classGroupsQuery.data?.items],
  )

  const userOptions = useMemo(
    () =>
      (studentUsersQuery.data?.items ?? []).map((user) => ({
        value: user.id,
        label: `${user.fullName} • ${user.email}`,
      })),
    [studentUsersQuery.data?.items],
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
    if (studentUsersQuery.isError) {
      return getErrorMessage(
        studentUsersQuery.error,
        'Unable to load student user options.',
      )
    }

    if (classGroupsQuery.isError) {
      return getErrorMessage(
        classGroupsQuery.error,
        'Unable to load class group options.',
      )
    }

    return null
  }, [
    classGroupsQuery.error,
    classGroupsQuery.isError,
    studentUsersQuery.error,
    studentUsersQuery.isError,
  ])

  const saveMutation = useMutation({
    mutationFn: async (values: StudentFormValues) => {
      setFormError(null)

      const basePayload = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        rollNumber: values.rollNumber.trim().toUpperCase(),
        email: values.email.trim() || undefined,
        phone: values.phone.trim() || undefined,
        gender: (values.gender || undefined) as StudentGender | undefined,
        classGroupId: values.classGroupId,
        status: values.status,
      }

      if (editingStudent) {
        const payload: UpdateStudentInput = basePayload
        return studentsApi.updateStudent(editingStudent.id, payload)
      }

      const payload: CreateStudentPayload = {
        ...basePayload,
        createLoginAccount: values.createLoginAccount,
      }

      if (values.createLoginAccount) {
        payload.login = {
          email: values.login.email.trim(),
          password: values.login.password,
          isActive: values.login.isActive,
        }
      } else if (values.userId.trim()) {
        payload.userId = values.userId.trim()
      }

      return studentsApi.createStudent(payload)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['students'] }),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
      ])
      setSuccessMessage(
        editingStudent ? 'Student updated successfully.' : 'Student created successfully.',
      )
      setSheetOpen(false)
      setEditingStudent(null)
      setFormError(null)
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, 'Unable to save the student.'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => studentsApi.deleteStudent(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['students'] })
      setSuccessMessage('Student deleted successfully.')
      setDeleteTarget(null)
    },
  })

  const columns = useMemo<DataTableColumn<Student>[]>(
    () => [
      {
        key: 'student',
        header: 'Student',
        render: (student) => (
          <div className="space-y-1">
            <p className="font-semibold text-ink-950">
              {student.firstName} {student.lastName}
            </p>
            <p className="text-xs text-ink-500">{student.rollNumber}</p>
          </div>
        ),
      },
      {
        key: 'email',
        header: 'Contact',
        render: (student) => (
          <div className="space-y-1">
            <p>{student.email ?? 'No email'}</p>
            <p className="text-xs text-ink-500">{student.phone ?? 'No phone'}</p>
          </div>
        ),
      },
      {
        key: 'group',
        header: 'Class Group',
        render: (student) => {
          const classGroup = classGroupMap.get(student.classGroupId ?? '')

          return (
            <div className="space-y-1">
              <p>{classGroup?.name ?? 'Not assigned'}</p>
              <p className="text-xs text-ink-500">{classGroup?.code ?? ''}</p>
            </div>
          )
        },
      },
      {
        key: 'status',
        header: 'Status',
        render: (student) => (
          <StatusBadge
            label={student.status === 'active' ? 'Active' : 'Inactive'}
            tone={student.status === 'active' ? 'success' : 'warning'}
          />
        ),
      },
      {
        key: 'login',
        header: 'Login',
        render: (student) => {
          const linkedUser = userMap.get(student.userId ?? '')

          return (
            <div className="space-y-2">
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
              <p className="text-xs text-ink-500">
                {linkedUser?.email ?? 'Student-only record'}
              </p>
            </div>
          )
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-28',
        headerClassName: 'text-right',
        render: (student) => (
          <TableActions
            onEdit={() => {
              setEditingStudent(student)
              setFormError(null)
              setSuccessMessage(null)
              setSheetOpen(true)
            }}
            onDelete={() => setDeleteTarget(student)}
          />
        ),
      },
    ],
    [classGroupMap, userMap],
  )

  const referencesLoading = studentUsersQuery.isLoading || classGroupsQuery.isLoading
  const activeLinkedUser = editingStudent ? userMap.get(editingStudent.userId ?? '') : null

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'Students' },
        ]}
        eyebrow="Academics"
        title="Students"
        description="Create student records and optionally provision linked student login accounts in the same flow."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingStudent(null)
              setFormError(null)
              setSuccessMessage(null)
              setSheetOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-ink-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-ink-800"
          >
            <Plus className="h-4 w-4" />
            Add student
          </button>
        }
      />

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_260px]">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch('')}
          placeholder="Search by name, roll number, or email"
        />
        <SelectField
          label="Status"
          value={statusFilter}
          options={[{ value: '', label: 'All statuses' }, ...studentStatusOptions]}
          onChange={(event) =>
            setStatusFilter(event.target.value as StudentStatus | '')
          }
        />
        <SelectField
          label="Class group"
          value={classGroupFilter}
          options={[{ value: '', label: 'All class groups' }, ...classGroupOptions]}
          onChange={(event) => setClassGroupFilter(event.target.value)}
        />
      </div>

      {studentsQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(studentsQuery.error, 'Unable to load students.')}
        />
      ) : studentsQuery.isLoading ? (
        <div className="app-surface p-6">
          <Loader label="Loading students..." />
        </div>
      ) : (
        <DataTable
          data={studentsQuery.data?.items ?? []}
          columns={columns}
          getRowKey={(student) => student.id}
          emptyTitle="No students found."
          emptyDescription="Create the first student record or adjust the selected filters."
        />
      )}

      <SidePanel
        open={sheetOpen}
        title={editingStudent ? 'Edit student' : 'Create student'}
        description="Students can be created as records only or with a linked portal login in the same admin flow."
        onClose={() => {
          setSheetOpen(false)
          setEditingStudent(null)
          setFormError(null)
        }}
      >
        {referencesLoading ? (
          <Loader label="Loading form options..." />
        ) : (
          <StudentForm
            student={editingStudent}
            linkedUser={activeLinkedUser}
            userOptions={userOptions}
            classGroupOptions={classGroupOptions}
            submitError={formError}
            referenceError={referenceError}
            isSubmitting={saveMutation.isPending}
            onCancel={() => {
              setSheetOpen(false)
              setEditingStudent(null)
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
        title="Delete student?"
        description={
          deleteTarget
            ? `${deleteTarget.firstName} ${deleteTarget.lastName} will be removed from the student registry.`
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

export default StudentsPage
