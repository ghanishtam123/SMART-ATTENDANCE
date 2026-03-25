import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { adminsApi } from '../../api/admins.api'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import ErrorMessage from '../../components/common/ErrorMessage'
import Loader from '../../components/common/Loader'
import PageHeader from '../../components/common/PageHeader'
import SearchInput from '../../components/common/SearchInput'
import SidePanel from '../../components/common/SidePanel'
import StatusBadge from '../../components/common/StatusBadge'
import FormActions from '../../components/forms/FormActions'
import InputField from '../../components/forms/InputField'
import DataTable, { type DataTableColumn } from '../../components/tables/DataTable'
import TableActions from '../../components/tables/TableActions'
import { routes } from '../../constants/routes'
import useDebounce from '../../hooks/useDebounce'
import type {
  AdminAccount,
  CreateAdminPayload,
  UpdateAdminPayload,
} from '../../types/admin'
import { getErrorMessage } from '../../utils/format'

const adminFormSchemaBase = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters.'),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string(),
  isActive: z.boolean(),
})

const buildAdminFormSchema = (isEditMode: boolean) =>
  adminFormSchemaBase.superRefine((value, ctx) => {
    const password = value.password.trim()

    if (!isEditMode && password.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'Password must be at least 8 characters long.',
      })
    }

    if (isEditMode && password && password.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'Password must be at least 8 characters long.',
      })
    }
  })

type AdminFormValues = z.infer<typeof adminFormSchemaBase>

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const getDefaultValues = (admin?: AdminAccount | null): AdminFormValues => ({
  fullName: admin?.fullName ?? '',
  email: admin?.email ?? '',
  password: '',
  isActive: admin?.isActive ?? true,
})

interface AdminFormProps {
  admin?: AdminAccount | null
  isSubmitting: boolean
  submitError: string | null
  onCancel: () => void
  onSubmit: (values: AdminFormValues) => Promise<void>
}

function AdminForm({
  admin,
  isSubmitting,
  submitError,
  onCancel,
  onSubmit,
}: AdminFormProps) {
  const isEditMode = Boolean(admin)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdminFormValues>({
    resolver: zodResolver(buildAdminFormSchema(isEditMode)),
    defaultValues: getDefaultValues(admin),
  })

  useEffect(() => {
    reset(getDefaultValues(admin))
  }, [admin, reset])

  const submitHandler = handleSubmit(async (values) => {
    const password = values.password?.trim() ?? ''

    await onSubmit({
      ...values,
      password,
    })
  })

  return (
    <form className="space-y-5" onSubmit={submitHandler}>
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 space-y-1">
          <h3 className="text-base font-semibold text-ink-950">Admin Account</h3>
          <p className="text-sm text-ink-500">Admin access details.</p>
        </div>

        <div className="space-y-5">
          <InputField
            label="Full name"
            placeholder="Admin Name"
            error={errors.fullName?.message}
            {...register('fullName')}
          />
          <InputField
            label="Email address"
            type="email"
            placeholder="admin@example.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <InputField
            label={isEditMode ? 'New password' : 'Password'}
            type="password"
            placeholder={
              isEditMode ? 'Leave blank to keep current password' : 'Minimum 8 characters'
            }
            hint={
              isEditMode ? 'Only set this if you want to rotate the password.' : undefined
            }
            error={errors.password?.message}
            {...register('password')}
          />
          {!isEditMode ? (
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-ink-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
                {...register('isActive')}
              />
              <span className="space-y-1">
                <span className="block font-medium text-ink-950">
                  Keep admin account active
                </span>
                <span className="block text-ink-500">
                  Turn off to create it as inactive.
                </span>
              </span>
            </label>
          ) : null}
        </div>
      </div>

      {submitError ? <ErrorMessage message={submitError} /> : null}

      <FormActions
        submitLabel={isEditMode ? 'Save changes' : 'Create admin'}
        loadingLabel={isEditMode ? 'Saving changes...' : 'Creating admin...'}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
      />
    </form>
  )
}

function AdminsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<AdminAccount | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [statusTarget, setStatusTarget] = useState<{
    admin: AdminAccount
    nextActive: boolean
  } | null>(null)
  const debouncedSearch = useDebounce(search)

  const adminsQuery = useQuery({
    queryKey: ['admins', debouncedSearch, statusFilter],
    queryFn: () =>
      adminsApi.listAdmins({
        page: 1,
        limit: 100,
        search: debouncedSearch || undefined,
        isActive:
          statusFilter === ''
            ? undefined
            : statusFilter === 'active',
      }),
  })

  const saveMutation = useMutation({
    mutationFn: async (values: AdminFormValues) => {
      setFormError(null)

      if (editingAdmin) {
        const payload: UpdateAdminPayload = {
          fullName: values.fullName.trim(),
          email: values.email.trim().toLowerCase(),
        }

        if (values.password?.trim()) {
          payload.password = values.password.trim()
        }

        return adminsApi.updateAdmin(editingAdmin.id, payload)
      }

      const payload: CreateAdminPayload = {
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password!.trim(),
        isActive: values.isActive,
      }

      return adminsApi.createAdmin(payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admins'] })
      setSuccessMessage(
        editingAdmin ? 'Admin account updated successfully.' : 'Admin account created successfully.',
      )
      setSheetOpen(false)
      setEditingAdmin(null)
      setFormError(null)
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, 'Unable to save the admin account.'))
    },
  })

  const statusMutation = useMutation({
    mutationFn: async (target: { admin: AdminAccount; nextActive: boolean }) =>
      adminsApi.updateAdminStatus(target.admin.id, {
        isActive: target.nextActive,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admins'] })
      setSuccessMessage('Admin account status updated successfully.')
      setStatusTarget(null)
    },
  })

  const columns = useMemo<DataTableColumn<AdminAccount>[]>(
    () => [
      {
        key: 'admin',
        header: 'Admin',
        render: (admin) => (
          <div className="space-y-1">
            <p className="font-semibold text-ink-950">{admin.fullName}</p>
            <p className="text-xs text-ink-500">{admin.email}</p>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (admin) => (
          <StatusBadge
            label={admin.isActive ? 'Active' : 'Inactive'}
            tone={admin.isActive ? 'success' : 'warning'}
          />
        ),
      },
      {
        key: 'lastLogin',
        header: 'Last Login',
        render: (admin) => (
          <span className="text-sm text-ink-600">
            {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : 'Never'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-40',
        headerClassName: 'text-right',
        render: (admin) => (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                setStatusTarget({
                  admin,
                  nextActive: !admin.isActive,
                })
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            >
              {admin.isActive ? 'Disable' : 'Enable'}
            </button>
            <TableActions
              onEdit={() => {
                setEditingAdmin(admin)
                setFormError(null)
                setSuccessMessage(null)
                setSheetOpen(true)
              }}
            />
          </div>
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
          { label: 'Admins' },
        ]}
        eyebrow="Administration"
        title="Admins"
        description="Manage administrator accounts."
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
          placeholder="Search by name or email"
        />

        <div className="flex flex-col gap-3 sm:flex-row xl:items-center">
          <label className="flex h-12 min-w-[190px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-brand-200 focus-within:ring-4 focus-within:ring-brand-100/70">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as 'active' | 'inactive' | '')
              }
              className="w-full bg-transparent text-sm text-ink-950 outline-none"
            >
              {statusOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              setEditingAdmin(null)
              setFormError(null)
              setSuccessMessage(null)
              setSheetOpen(true)
            }}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink-950 px-4 text-sm font-medium whitespace-nowrap text-white transition hover:bg-ink-800"
          >
            <Plus className="h-4 w-4" />
            Add admin
          </button>
        </div>
      </div>

      {adminsQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(adminsQuery.error, 'Unable to load admins.')}
        />
      ) : adminsQuery.isLoading ? (
        <div className="app-surface p-6">
          <Loader label="Loading admin accounts..." />
        </div>
      ) : (
        <DataTable
          data={adminsQuery.data?.items ?? []}
          columns={columns}
          getRowKey={(admin) => admin.id}
          emptyTitle="No admin accounts found."
          emptyDescription="Create the first admin account from this page."
        />
      )}

      <SidePanel
        open={sheetOpen}
        title={editingAdmin ? 'Edit admin account' : 'Create admin account'}
        description="This page is dedicated to administrator account management."
        onClose={() => {
          setSheetOpen(false)
          setEditingAdmin(null)
          setFormError(null)
        }}
      >
        <AdminForm
          admin={editingAdmin}
          isSubmitting={saveMutation.isPending}
          submitError={formError}
          onCancel={() => {
            setSheetOpen(false)
            setEditingAdmin(null)
            setFormError(null)
          }}
          onSubmit={async (values) => {
            await saveMutation.mutateAsync(values)
          }}
        />
      </SidePanel>

      <ConfirmDialog
        open={!!statusTarget}
        title={statusTarget?.nextActive ? 'Enable admin account?' : 'Disable admin account?'}
        description={
          statusTarget
            ? `${statusTarget.admin.fullName} will be ${
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

export default AdminsPage
