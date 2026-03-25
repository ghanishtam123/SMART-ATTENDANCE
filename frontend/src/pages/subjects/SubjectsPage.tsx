import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { classGroupsApi } from '../../api/classGroups.api'
import { subjectsApi } from '../../api/subjects.api'
import { teachersApi } from '../../api/teachers.api'
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
import TextAreaField from '../../components/forms/TextAreaField'
import DataTable, { type DataTableColumn } from '../../components/tables/DataTable'
import TableActions from '../../components/tables/TableActions'
import { routes } from '../../constants/routes'
import useDebounce from '../../hooks/useDebounce'
import type {
  CreateSubjectInput,
  Subject,
  UpdateSubjectInput,
} from '../../types/subject'
import { getErrorMessage } from '../../utils/format'

const subjectSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.'),
  code: z.string().trim().min(1, 'Code is required.'),
  description: z.string().trim().min(2, 'Description is required.'),
  creditHoursText: z.string().optional(),
  assignedTeacherIds: z.array(z.string()).default([]),
  classGroupIds: z.array(z.string()).default([]),
  isActive: z.boolean(),
})

type SubjectFormValues = z.input<typeof subjectSchema>
type SubjectSubmitValues = z.output<typeof subjectSchema>

const getDefaultValues = (subject?: Subject | null): SubjectFormValues => ({
  name: subject?.name ?? '',
  code: subject?.code ?? '',
  description: subject?.description ?? '',
  creditHoursText:
    subject?.creditHours === null || subject?.creditHours === undefined
      ? ''
      : String(subject.creditHours),
  assignedTeacherIds: subject?.assignedTeacherIds ?? [],
  classGroupIds: subject?.classGroupIds ?? [],
  isActive: subject?.isActive ?? true,
})

interface SubjectFormProps {
  subject?: Subject | null
  isSubmitting: boolean
  submitError: string | null
  teacherOptions: Array<{ label: string; value: string }>
  classGroupOptions: Array<{ label: string; value: string }>
  referenceError?: string | null
  onCancel: () => void
  onSubmit: (values: SubjectSubmitValues) => Promise<void>
}

function SubjectForm({
  subject,
  isSubmitting,
  submitError,
  teacherOptions,
  classGroupOptions,
  referenceError,
  onCancel,
  onSubmit,
}: SubjectFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SubjectFormValues, undefined, SubjectSubmitValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: getDefaultValues(subject),
  })

  useEffect(() => {
    reset(getDefaultValues(subject))
  }, [reset, subject])

  const submitHandler = handleSubmit(async (values) => {
    await onSubmit(values)
  })

  return (
    <form className="space-y-5" onSubmit={submitHandler}>
      <div className="grid gap-5 md:grid-cols-2">
        <InputField
          label="Name"
          placeholder="Operating Systems"
          error={errors.name?.message}
          {...register('name')}
        />
        <InputField
          label="Code"
          placeholder="CS401"
          error={errors.code?.message}
          {...register('code')}
        />
      </div>

      <TextAreaField
        label="Description"
        placeholder="Summarize the course purpose and scope"
        error={errors.description?.message}
        {...register('description')}
      />

      <InputField
        label="Credit hours"
        type="number"
        min={0}
        placeholder="3"
        error={errors.creditHoursText?.message}
        {...register('creditHoursText')}
      />

      <SelectField
        label="Assigned teachers"
        multiple
        options={teacherOptions}
        hint="Hold Ctrl/Cmd to select multiple teacher profiles."
        error={errors.assignedTeacherIds?.message}
        {...register('assignedTeacherIds')}
      />

      <SelectField
        label="Class groups"
        multiple
        options={classGroupOptions}
        hint="Link the subject to one or more class groups."
        error={errors.classGroupIds?.message}
        {...register('classGroupIds')}
      />

      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
          {...register('isActive')}
        />
        Keep this subject active
      </label>

      {referenceError ? <ErrorMessage message={referenceError} /> : null}
      {submitError ? <ErrorMessage message={submitError} /> : null}

      <FormActions
        submitLabel={subject ? 'Save changes' : 'Create subject'}
        loadingLabel={subject ? 'Saving changes...' : 'Creating subject...'}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
      />
    </form>
  )
}

function SubjectsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'active' | 'inactive' | ''>('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search)

  const subjectsQuery = useQuery({
    queryKey: ['subjects', debouncedSearch, activeFilter],
    queryFn: () =>
      subjectsApi.listSubjects({
        page: 1,
        limit: 100,
        search: debouncedSearch || undefined,
        isActive:
          activeFilter === ''
            ? undefined
            : activeFilter === 'active',
      }),
  })

  const teacherProfilesQuery = useQuery({
    queryKey: ['teacher-profiles', 'subject-options'],
    queryFn: () => teachersApi.listTeachers({ page: 1, limit: 100 }),
  })

  const classGroupsQuery = useQuery({
    queryKey: ['class-groups', 'subject-options'],
    queryFn: () => classGroupsApi.listClassGroups({ page: 1, limit: 100 }),
  })

  const teacherOptions = useMemo(
    () =>
      (teacherProfilesQuery.data?.items ?? []).map((teacher) => ({
        value: teacher.id,
        label: `${teacher.employeeId} • ${teacher.department}`,
      })),
    [teacherProfilesQuery.data?.items],
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
    if (teacherProfilesQuery.isError) {
      return getErrorMessage(
        teacherProfilesQuery.error,
        'Unable to load teacher options.',
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
    teacherProfilesQuery.error,
    teacherProfilesQuery.isError,
  ])

  const saveMutation = useMutation({
    mutationFn: async (values: SubjectSubmitValues) => {
      setFormError(null)

      const creditHours = values.creditHoursText?.trim()
        ? Number(values.creditHoursText)
        : undefined
      const basePayload = {
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        description: values.description.trim(),
        creditHours,
        assignedTeacherIds: values.assignedTeacherIds,
        classGroupIds: values.classGroupIds,
        isActive: values.isActive,
      }

      if (editingSubject) {
        const payload: UpdateSubjectInput = basePayload
        return subjectsApi.updateSubject(editingSubject.id, payload)
      }

      const payload: CreateSubjectInput = basePayload
      return subjectsApi.createSubject(payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['subjects'] })
      setSheetOpen(false)
      setEditingSubject(null)
      setFormError(null)
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, 'Unable to save the subject.'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subjectsApi.deleteSubject(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['subjects'] })
      setDeleteTarget(null)
    },
  })

  const columns = useMemo<DataTableColumn<Subject>[]>(
    () => [
      {
        key: 'subject',
        header: 'Subject',
        render: (subject) => (
          <div className="space-y-1">
            <p className="font-semibold text-ink-950">{subject.name}</p>
            <p className="text-xs text-ink-500">{subject.code}</p>
          </div>
        ),
      },
      {
        key: 'creditHours',
        header: 'Credits',
        render: (subject) => (
          <span>{subject.creditHours ?? 'Not set'}</span>
        ),
      },
      {
        key: 'assignments',
        header: 'Assignments',
        render: (subject) => (
          <div className="space-y-1">
            <p>{subject.assignedTeacherIds.length} teacher links</p>
            <p className="text-xs text-ink-500">
              {subject.classGroupIds.length} class group links
            </p>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (subject) => (
          <StatusBadge
            label={subject.isActive ? 'Active' : 'Inactive'}
            tone={subject.isActive ? 'success' : 'warning'}
          />
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-28',
        headerClassName: 'text-right',
        render: (subject) => (
          <TableActions
            onEdit={() => {
              setEditingSubject(subject)
              setFormError(null)
              setSheetOpen(true)
            }}
            onDelete={() => setDeleteTarget(subject)}
          />
        ),
      },
    ],
    [],
  )

  const referencesLoading = teacherProfilesQuery.isLoading || classGroupsQuery.isLoading

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'Subjects' },
        ]}
        eyebrow="Curriculum"
        title="Subjects"
        description="Maintain the subject catalog and connect it to teachers and academic groups."
      />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <SearchInput
          wrapperClassName="xl:flex-1"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch('')}
          placeholder="Search by name, code, or description"
        />
        <div className="flex flex-col gap-3 sm:flex-row xl:items-center">
          <label className="flex h-12 min-w-[170px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-brand-200 focus-within:ring-4 focus-within:ring-brand-100/70">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
              Status
            </span>
            <select
              value={activeFilter}
              onChange={(event) =>
                setActiveFilter(event.target.value as 'active' | 'inactive' | '')
              }
              className="w-full bg-transparent text-sm text-ink-950 outline-none"
            >
              {[
                { value: '', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ].map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setEditingSubject(null)
              setFormError(null)
              setSheetOpen(true)
            }}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink-950 px-4 text-sm font-medium whitespace-nowrap text-white transition hover:bg-ink-800"
          >
            <Plus className="h-4 w-4" />
            Add subject
          </button>
        </div>
      </div>

      {subjectsQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(subjectsQuery.error, 'Unable to load subjects.')}
        />
      ) : subjectsQuery.isLoading ? (
        <div className="app-surface p-6">
          <Loader label="Loading subjects..." />
        </div>
      ) : (
        <DataTable
          data={subjectsQuery.data?.items ?? []}
          columns={columns}
          getRowKey={(subject) => subject.id}
          emptyTitle="No subjects found."
          emptyDescription="Add the first subject to start building your curriculum."
        />
      )}

      <SidePanel
        open={sheetOpen}
        title={editingSubject ? 'Edit subject' : 'Create subject'}
        description="Subject metadata drives timetable planning, session creation, and attendance reporting."
        onClose={() => {
          setSheetOpen(false)
          setEditingSubject(null)
          setFormError(null)
        }}
      >
        {referencesLoading ? (
          <Loader label="Loading form options..." />
        ) : (
          <SubjectForm
            subject={editingSubject}
            submitError={formError}
            referenceError={referenceError}
            teacherOptions={teacherOptions}
            classGroupOptions={classGroupOptions}
            isSubmitting={saveMutation.isPending}
            onCancel={() => {
              setSheetOpen(false)
              setEditingSubject(null)
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
        title="Delete subject?"
        description={
          deleteTarget
            ? `${deleteTarget.name} will be removed from the subject catalog.`
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

export default SubjectsPage
