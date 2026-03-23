import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { classGroupsApi } from '../../api/classGroups.api'
import EmptyState from '../../components/common/EmptyState'
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
  ClassGroup,
  CreateClassGroupInput,
  UpdateClassGroupInput,
} from '../../types/classGroup'
import { getErrorMessage } from '../../utils/format'

const classGroupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.'),
  code: z.string().trim().min(1, 'Code is required.'),
  department: z.string().trim().min(2, 'Department is required.'),
  semester: z.coerce.number().int().positive('Semester must be a positive number.'),
  section: z.string().trim().min(1, 'Section is required.'),
  academicYear: z.string().trim().min(4, 'Academic year is required.'),
  isActive: z.boolean(),
})

type ClassGroupFormValues = z.input<typeof classGroupSchema>
type ClassGroupSubmitValues = z.output<typeof classGroupSchema>

const getDefaultValues = (
  classGroup?: ClassGroup | null,
): ClassGroupFormValues => ({
  name: classGroup?.name ?? '',
  code: classGroup?.code ?? '',
  department: classGroup?.department ?? '',
  semester: classGroup?.semester ?? 1,
  section: classGroup?.section ?? '',
  academicYear: classGroup?.academicYear ?? '',
  isActive: classGroup?.isActive ?? true,
})

interface ClassGroupFormProps {
  classGroup?: ClassGroup | null
  isSubmitting: boolean
  submitError: string | null
  onCancel: () => void
  onSubmit: (values: ClassGroupSubmitValues) => Promise<void>
}

function ClassGroupForm({
  classGroup,
  isSubmitting,
  submitError,
  onCancel,
  onSubmit,
}: ClassGroupFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClassGroupFormValues, undefined, ClassGroupSubmitValues>({
    resolver: zodResolver(classGroupSchema),
    defaultValues: getDefaultValues(classGroup),
  })

  useEffect(() => {
    reset(getDefaultValues(classGroup))
  }, [classGroup, reset])

  const submitHandler = handleSubmit(async (values) => {
    await onSubmit(values)
  })

  return (
    <form className="space-y-5" onSubmit={submitHandler}>
      <div className="grid gap-5 md:grid-cols-2">
        <InputField
          label="Name"
          placeholder="BSc Computer Science A"
          error={errors.name?.message}
          {...register('name')}
        />
        <InputField
          label="Code"
          placeholder="CS-A"
          error={errors.code?.message}
          {...register('code')}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <InputField
          label="Department"
          placeholder="Computer Science"
          error={errors.department?.message}
          {...register('department')}
        />
        <InputField
          label="Semester"
          type="number"
          error={errors.semester?.message}
          {...register('semester')}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <InputField
          label="Section"
          placeholder="A"
          error={errors.section?.message}
          {...register('section')}
        />
        <InputField
          label="Academic year"
          placeholder="2025-2026"
          error={errors.academicYear?.message}
          {...register('academicYear')}
        />
      </div>

      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
          {...register('isActive')}
        />
        Keep this class group active
      </label>

      {submitError ? <ErrorMessage message={submitError} /> : null}

      <FormActions
        submitLabel={classGroup ? 'Save changes' : 'Create class group'}
        loadingLabel={classGroup ? 'Saving changes...' : 'Creating class group...'}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
      />
    </form>
  )
}

function ClassGroupsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'active' | 'inactive' | ''>('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ClassGroup | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClassGroup | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search)

  const classGroupsQuery = useQuery({
    queryKey: ['class-groups', debouncedSearch, activeFilter],
    queryFn: () =>
      classGroupsApi.listClassGroups({
        page: 1,
        limit: 100,
        search: debouncedSearch || undefined,
        isActive:
          activeFilter === ''
            ? undefined
            : activeFilter === 'active',
      }),
  })

  const saveMutation = useMutation({
    mutationFn: async (values: ClassGroupSubmitValues) => {
      setFormError(null)

      if (editingGroup) {
        const payload: UpdateClassGroupInput = {
          ...values,
          code: values.code.trim().toUpperCase(),
          section: values.section.trim().toUpperCase(),
        }

        return classGroupsApi.updateClassGroup(editingGroup.id, payload)
      }

      const payload: CreateClassGroupInput = {
        ...values,
        code: values.code.trim().toUpperCase(),
        section: values.section.trim().toUpperCase(),
      }

      return classGroupsApi.createClassGroup(payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['class-groups'] })
      setSheetOpen(false)
      setEditingGroup(null)
      setFormError(null)
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, 'Unable to save the class group.'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => classGroupsApi.deleteClassGroup(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['class-groups'] })
      setDeleteTarget(null)
    },
  })

  const columns = useMemo<DataTableColumn<ClassGroup>[]>(
    () => [
      {
        key: 'name',
        header: 'Group',
        render: (group) => (
          <div className="space-y-1">
            <p className="font-semibold text-ink-950">{group.name}</p>
            <p className="text-xs text-ink-500">{group.code}</p>
          </div>
        ),
      },
      {
        key: 'department',
        header: 'Department',
        render: (group) => <span>{group.department}</span>,
      },
      {
        key: 'term',
        header: 'Term',
        render: (group) => (
          <div className="space-y-1">
            <p>Semester {group.semester}</p>
            <p className="text-xs text-ink-500">
              Section {group.section} • {group.academicYear}
            </p>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (group) => (
          <StatusBadge
            label={group.isActive ? 'Active' : 'Inactive'}
            tone={group.isActive ? 'success' : 'warning'}
          />
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-28',
        headerClassName: 'text-right',
        render: (group) => (
          <TableActions
            onEdit={() => {
              setEditingGroup(group)
              setFormError(null)
              setSheetOpen(true)
            }}
            onDelete={() => setDeleteTarget(group)}
          />
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'Class Groups' },
        ]}
        eyebrow="Academics"
        title="Class Groups"
        description="Manage academic cohorts, sections, and intake structure."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingGroup(null)
              setFormError(null)
              setSheetOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-ink-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-ink-800"
          >
            <Plus className="h-4 w-4" />
            Add class group
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch('')}
          placeholder="Search by name, code, department, or academic year"
        />
        <SelectField
          label="Status"
          value={activeFilter}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
          onChange={(event) =>
            setActiveFilter(event.target.value as 'active' | 'inactive' | '')
          }
        />
      </div>

      {classGroupsQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(
            classGroupsQuery.error,
            'Unable to load class groups.',
          )}
        />
      ) : classGroupsQuery.isLoading ? (
        <div className="app-surface p-6">
          <Loader label="Loading class groups..." />
        </div>
      ) : classGroupsQuery.data?.items.length ? (
        <DataTable
          data={classGroupsQuery.data.items}
          columns={columns}
          getRowKey={(group) => group.id}
          emptyTitle="No class groups found."
          emptyDescription="Adjust your filters or create a new class group."
        />
      ) : (
        <EmptyState
          title="No class groups found."
          description="Adjust your filters or create the first class group for your institution."
        />
      )}

      <SidePanel
        open={sheetOpen}
        title={editingGroup ? 'Edit class group' : 'Create class group'}
        description="Keep academic metadata structured so sessions and attendance can be mapped cleanly."
        onClose={() => {
          setSheetOpen(false)
          setEditingGroup(null)
          setFormError(null)
        }}
      >
        <ClassGroupForm
          classGroup={editingGroup}
          submitError={formError}
          isSubmitting={saveMutation.isPending}
          onCancel={() => {
            setSheetOpen(false)
            setEditingGroup(null)
            setFormError(null)
          }}
          onSubmit={async (values) => {
            await saveMutation.mutateAsync(values)
          }}
        />
      </SidePanel>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete class group?"
        description={
          deleteTarget
            ? `${deleteTarget.name} will be removed from the master data module.`
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

export default ClassGroupsPage
