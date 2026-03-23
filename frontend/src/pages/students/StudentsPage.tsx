import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
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
import type {
  CreateStudentInput,
  Student,
  StudentGender,
  StudentStatus,
  UpdateStudentInput,
} from '../../types/student'
import { getErrorMessage } from '../../utils/format'

const phoneRegex = /^[0-9+\-\s()]{7,20}$/

const studentSchema = z.object({
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  rollNumber: z.string().trim().min(1, 'Roll number is required.'),
  email: z
    .string()
    .trim()
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: 'Enter a valid email address.',
    }),
  phone: z
    .string()
    .trim()
    .refine((value) => !value || phoneRegex.test(value), {
      message: 'Enter a valid phone number.',
    }),
  gender: z.enum(['', 'male', 'female', 'other']),
  userId: z.string().optional(),
  classGroupId: z.string().trim().min(1, 'Select a class group.'),
  status: z.enum(['active', 'inactive']),
})

type StudentFormValues = z.infer<typeof studentSchema>

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

const getDefaultValues = (student?: Student | null): StudentFormValues => ({
  firstName: student?.firstName ?? '',
  lastName: student?.lastName ?? '',
  rollNumber: student?.rollNumber ?? '',
  email: student?.email ?? '',
  phone: student?.phone ?? '',
  gender: (student?.gender ?? '') as '' | StudentGender,
  userId: student?.userId ?? '',
  classGroupId: student?.classGroupId ?? '',
  status: (student?.status ?? 'active') as StudentStatus,
})

interface StudentFormProps {
  student?: Student | null
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
  userOptions,
  classGroupOptions,
  submitError,
  referenceError,
  isSubmitting,
  onCancel,
  onSubmit,
}: StudentFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: getDefaultValues(student),
  })

  useEffect(() => {
    reset(getDefaultValues(student))
  }, [reset, student])

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-5 md:grid-cols-2">
        <InputField
          label="First name"
          placeholder="Aarav"
          error={errors.firstName?.message}
          {...register('firstName')}
        />
        <InputField
          label="Last name"
          placeholder="Sharma"
          error={errors.lastName?.message}
          {...register('lastName')}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <InputField
          label="Roll number"
          placeholder="CS-2025-001"
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
          placeholder="student@example.com"
          hint="If a linked student user is selected, this should match that account email."
          error={errors.email?.message}
          {...register('email')}
        />
        <InputField
          label="Phone"
          placeholder="+91 9876543210"
          error={errors.phone?.message}
          {...register('phone')}
        />
      </div>

      <SelectField
        label="Linked user account"
        options={userOptions}
        placeholder="Optional student user link"
        error={errors.userId?.message}
        {...register('userId')}
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
          label="Status"
          options={studentStatusOptions}
          error={errors.status?.message}
          {...register('status')}
        />
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
        userId: values.userId?.trim() ? values.userId : undefined,
        classGroupId: values.classGroupId,
        status: values.status,
      }

      if (editingStudent) {
        const payload: UpdateStudentInput = {
          ...basePayload,
          userId: values.userId?.trim() ? values.userId : null,
        }

        return studentsApi.updateStudent(editingStudent.id, payload)
      }

      const payload: CreateStudentInput = basePayload
      return studentsApi.createStudent(payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['students'] })
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
        key: 'linkedUser',
        header: 'Linked Account',
        render: (student) => {
          const linkedUser = userMap.get(student.userId ?? '')

          return (
            <span className="text-sm text-ink-600">
              {linkedUser ? linkedUser.fullName : 'Not linked'}
            </span>
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

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'Students' },
        ]}
        eyebrow="Academics"
        title="Students"
        description="Maintain student records, optional linked login accounts, and class group mapping."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingStudent(null)
              setFormError(null)
              setSheetOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-ink-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-ink-800"
          >
            <Plus className="h-4 w-4" />
            Add student
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_260px]">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch('')}
          placeholder="Search by name, roll number, email, or remarks"
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
        description="Student records drive attendance history, analytics, and the linked student portal."
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
