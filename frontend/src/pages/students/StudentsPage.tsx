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
  login: {
    email: string
    password: string
  }
}

const studentFormSchemaBase = z.object({
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  rollNumber: z.string().trim().min(1, 'Roll number is required.'),
  email: z.string().trim().email('Enter a valid email address.'),
  phone: z
    .string()
    .trim()
    .refine((value) => !value || phoneRegex.test(value), {
      message: 'Enter a valid phone number.',
    }),
  gender: z.enum(['', 'male', 'female', 'other']),
  classGroupId: z.string().trim().min(1, 'Select a class group.'),
  status: z.enum(['active', 'inactive']),
  login: z.object({
    email: z.string().trim().email('Enter a valid login email address.'),
    password: z.string().trim().min(8, 'Password must be at least 8 characters.'),
  }),
})

const buildStudentFormSchema = (isEditMode: boolean) =>
  studentFormSchemaBase.superRefine((value, ctx) => {
    if (isEditMode) {
      return
    }

    if (value.email.trim().toLowerCase() !== value.login.email.trim().toLowerCase()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['login', 'email'],
        message: 'Student email and login email must match.',
      })
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
  login: {
    email: student?.email ?? linkedUser?.email ?? '',
    password: '',
  },
})

interface StudentFormProps {
  student?: Student | null
  linkedUser?: User | null
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
    if (isEditMode || !studentEmail.trim() || loginEmail.trim()) {
      return
    }

    setValue('login.email', studentEmail.trim(), {
      shouldDirty: true,
      shouldValidate: false,
    })
  }, [isEditMode, loginEmail, setValue, studentEmail])

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
          <p className="text-sm text-ink-500">Group and status settings.</p>
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
            <h3 className="text-base font-semibold text-ink-950">
              Student Login Account (Required)
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
                label="Login email"
                type="email"
                placeholder="amit@example.com"
                error={errors.login?.email?.message}
                {...register('login.email')}
              />
              <InputField
                label="Temporary Password"
                type="password"
                placeholder="Student@123"
                error={errors.login?.password?.message}
                {...register('login.password')}
              />
            </div>
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
        email: values.email.trim(),
        createLoginAccount: true,
        login: {
          email: values.login.email.trim().toLowerCase(),
          password: values.login.password,
          isActive: true,
        },
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
        description="Create student records and required linked student login accounts in the same flow."
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
          placeholder="Search by name, roll number, or email"
        />
        <div className="flex flex-col gap-3 sm:flex-row xl:items-center">
          <label className="flex h-12 min-w-[170px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-brand-200 focus-within:ring-4 focus-within:ring-brand-100/70">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StudentStatus | '')
              }
              className="w-full bg-transparent text-sm text-ink-950 outline-none"
            >
              {[{ value: '', label: 'All statuses' }, ...studentStatusOptions].map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-12 min-w-[220px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-brand-200 focus-within:ring-4 focus-within:ring-brand-100/70">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
              Group
            </span>
            <select
              value={classGroupFilter}
              onChange={(event) => setClassGroupFilter(event.target.value)}
              className="w-full bg-transparent text-sm text-ink-950 outline-none"
            >
              {[{ value: '', label: 'All class groups' }, ...classGroupOptions].map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setEditingStudent(null)
              setFormError(null)
              setSuccessMessage(null)
              setSheetOpen(true)
            }}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink-950 px-4 text-sm font-medium whitespace-nowrap text-white transition hover:bg-ink-800"
          >
            <Plus className="h-4 w-4" />
            Add student
          </button>
        </div>
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
          emptyDescription="Create the first student record and linked login account or adjust the selected filters."
        />
      )}

      <SidePanel
        open={sheetOpen}
        title={editingStudent ? 'Edit student' : 'Create student'}
        description="Create a student and login account."
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
