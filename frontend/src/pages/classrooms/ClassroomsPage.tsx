import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { classroomsApi } from '../../api/classrooms.api'
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
  Classroom,
  CreateClassroomInput,
  UpdateClassroomInput,
} from '../../types/classroom'
import { getErrorMessage } from '../../utils/format'

const classroomSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.'),
  code: z.string().trim().min(1, 'Code is required.'),
  building: z.string().trim().min(1, 'Building is required.'),
  floor: z.string().trim().min(1, 'Floor is required.'),
  capacity: z.coerce.number().int().positive('Capacity must be a positive number.'),
  cameraIdsText: z.string().optional(),
  isActive: z.boolean(),
})

type ClassroomFormValues = z.input<typeof classroomSchema>
type ClassroomSubmitValues = z.output<typeof classroomSchema>

const parseCameraIds = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const getDefaultValues = (
  classroom?: Classroom | null,
): ClassroomFormValues => ({
  name: classroom?.name ?? '',
  code: classroom?.code ?? '',
  building: classroom?.building ?? '',
  floor: classroom?.floor ?? '',
  capacity: classroom?.capacity ?? 1,
  cameraIdsText: classroom?.cameraIds.join(', ') ?? '',
  isActive: classroom?.isActive ?? true,
})

interface ClassroomFormProps {
  classroom?: Classroom | null
  isSubmitting: boolean
  submitError: string | null
  onCancel: () => void
  onSubmit: (values: ClassroomSubmitValues) => Promise<void>
}

function ClassroomForm({
  classroom,
  isSubmitting,
  submitError,
  onCancel,
  onSubmit,
}: ClassroomFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClassroomFormValues, undefined, ClassroomSubmitValues>({
    resolver: zodResolver(classroomSchema),
    defaultValues: getDefaultValues(classroom),
  })

  useEffect(() => {
    reset(getDefaultValues(classroom))
  }, [classroom, reset])

  const submitHandler = handleSubmit(async (values) => {
    await onSubmit(values)
  })

  return (
    <form className="space-y-5" onSubmit={submitHandler}>
      <div className="grid gap-5 md:grid-cols-2">
        <InputField
          label="Name"
          placeholder="Main Lecture Hall"
          error={errors.name?.message}
          {...register('name')}
        />
        <InputField
          label="Code"
          placeholder="LH-01"
          error={errors.code?.message}
          {...register('code')}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <InputField
          label="Building"
          placeholder="Block A"
          error={errors.building?.message}
          {...register('building')}
        />
        <InputField
          label="Floor"
          placeholder="2nd Floor"
          error={errors.floor?.message}
          {...register('floor')}
        />
      </div>

      <InputField
        label="Capacity"
        type="number"
        error={errors.capacity?.message}
        {...register('capacity')}
      />

      <TextAreaField
        label="Camera IDs"
        placeholder="cam-01, cam-02"
        hint="Separate multiple camera identifiers with commas."
        error={errors.cameraIdsText?.message}
        {...register('cameraIdsText')}
      />

      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
          {...register('isActive')}
        />
        Keep this classroom active
      </label>

      {submitError ? <ErrorMessage message={submitError} /> : null}

      <FormActions
        submitLabel={classroom ? 'Save changes' : 'Create classroom'}
        loadingLabel={classroom ? 'Saving changes...' : 'Creating classroom...'}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
      />
    </form>
  )
}

function ClassroomsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'active' | 'inactive' | ''>('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Classroom | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search)

  const classroomsQuery = useQuery({
    queryKey: ['classrooms', debouncedSearch, activeFilter],
    queryFn: () =>
      classroomsApi.listClassrooms({
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
    mutationFn: async (values: ClassroomSubmitValues) => {
      setFormError(null)

      const basePayload = {
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        building: values.building.trim(),
        floor: values.floor.trim(),
        capacity: values.capacity,
        cameraIds: parseCameraIds(values.cameraIdsText),
        isActive: values.isActive,
      }

      if (editingClassroom) {
        const payload: UpdateClassroomInput = basePayload
        return classroomsApi.updateClassroom(editingClassroom.id, payload)
      }

      const payload: CreateClassroomInput = basePayload
      return classroomsApi.createClassroom(payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['classrooms'] })
      setSheetOpen(false)
      setEditingClassroom(null)
      setFormError(null)
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, 'Unable to save the classroom.'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => classroomsApi.deleteClassroom(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['classrooms'] })
      setDeleteTarget(null)
    },
  })

  const columns = useMemo<DataTableColumn<Classroom>[]>(
    () => [
      {
        key: 'room',
        header: 'Classroom',
        render: (classroom) => (
          <div className="space-y-1">
            <p className="font-semibold text-ink-950">{classroom.name}</p>
            <p className="text-xs text-ink-500">{classroom.code}</p>
          </div>
        ),
      },
      {
        key: 'location',
        header: 'Location',
        render: (classroom) => (
          <div className="space-y-1">
            <p>{classroom.building}</p>
            <p className="text-xs text-ink-500">{classroom.floor}</p>
          </div>
        ),
      },
      {
        key: 'capacity',
        header: 'Capacity',
        render: (classroom) => <span>{classroom.capacity} seats</span>,
      },
      {
        key: 'cameras',
        header: 'Cameras',
        render: (classroom) => (
          <span>{classroom.cameraIds.length} configured</span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (classroom) => (
          <StatusBadge
            label={classroom.isActive ? 'Active' : 'Inactive'}
            tone={classroom.isActive ? 'success' : 'warning'}
          />
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-28',
        headerClassName: 'text-right',
        render: (classroom) => (
          <TableActions
            onEdit={() => {
              setEditingClassroom(classroom)
              setFormError(null)
              setSheetOpen(true)
            }}
            onDelete={() => setDeleteTarget(classroom)}
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
          { label: 'Classrooms' },
        ]}
        eyebrow="Infrastructure"
        title="Classrooms"
        description="Track physical rooms, capacity, and connected camera coverage."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingClassroom(null)
              setFormError(null)
              setSheetOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-ink-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-ink-800"
          >
            <Plus className="h-4 w-4" />
            Add classroom
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch('')}
          placeholder="Search by name, code, building, or floor"
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

      {classroomsQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(
            classroomsQuery.error,
            'Unable to load classrooms.',
          )}
        />
      ) : classroomsQuery.isLoading ? (
        <div className="app-surface p-6">
          <Loader label="Loading classrooms..." />
        </div>
      ) : (
        <DataTable
          data={classroomsQuery.data?.items ?? []}
          columns={columns}
          getRowKey={(classroom) => classroom.id}
          emptyTitle="No classrooms found."
          emptyDescription="Add your first classroom to start mapping teaching spaces."
        />
      )}

      <SidePanel
        open={sheetOpen}
        title={editingClassroom ? 'Edit classroom' : 'Create classroom'}
        description="Store location and device metadata so sessions and live monitoring can reference the correct room."
        onClose={() => {
          setSheetOpen(false)
          setEditingClassroom(null)
          setFormError(null)
        }}
      >
        <ClassroomForm
          classroom={editingClassroom}
          submitError={formError}
          isSubmitting={saveMutation.isPending}
          onCancel={() => {
            setSheetOpen(false)
            setEditingClassroom(null)
            setFormError(null)
          }}
          onSubmit={async (values) => {
            await saveMutation.mutateAsync(values)
          }}
        />
      </SidePanel>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete classroom?"
        description={
          deleteTarget
            ? `${deleteTarget.name} will be removed from the classroom registry.`
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

export default ClassroomsPage
