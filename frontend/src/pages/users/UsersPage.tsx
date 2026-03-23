import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import StatusBadge from '../../components/common/StatusBadge'
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
import { usersApi } from '../../api/users.api'
import { roleLabels } from '../../constants/roles'
import { routes } from '../../constants/routes'
import useDebounce from '../../hooks/useDebounce'
import type {
  CreateUserInput,
  UpdateUserInput,
  User,
  UserRole,
} from '../../types/user'
import { getErrorMessage } from '../../utils/format'

const userFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters.'),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().optional(),
  role: z.enum(['super_admin', 'admin', 'teacher', 'student']),
})

type UserFormValues = z.infer<typeof userFormSchema>

const roleOptions = Object.entries(roleLabels).map(([value, label]) => ({
  value,
  label,
}))

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const getDefaultValues = (user?: User | null): UserFormValues => ({
  fullName: user?.fullName ?? '',
  email: user?.email ?? '',
  password: '',
  role: user?.role ?? 'admin',
})

interface UserFormProps {
  user?: User | null
  isSubmitting: boolean
  submitError: string | null
  onCancel: () => void
  onSubmit: (values: UserFormValues) => Promise<void>
}

function UserForm({
  user,
  isSubmitting,
  submitError,
  onCancel,
  onSubmit,
}: UserFormProps) {
  const isEditMode = !!user
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: getDefaultValues(user),
  })

  useEffect(() => {
    reset(getDefaultValues(user))
  }, [reset, user])

  const submitHandler = handleSubmit(async (values) => {
    const password = values.password?.trim() ?? ''

    if (!isEditMode && password.length < 8) {
      setError('password', {
        message: 'Password must be at least 8 characters long.',
      })
      return
    }

    if (password && password.length < 8) {
      setError('password', {
        message: 'Password must be at least 8 characters long.',
      })
      return
    }

    await onSubmit({
      ...values,
      password,
    })
  })

  return (
    <form className="space-y-5" onSubmit={submitHandler}>
      <InputField
        label="Full name"
        placeholder="Enter full name"
        error={errors.fullName?.message}
        {...register('fullName')}
      />
      <InputField
        label="Email address"
        type="email"
        placeholder="name@example.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <InputField
        label={isEditMode ? 'New password' : 'Password'}
        type="password"
        placeholder={isEditMode ? 'Leave blank to keep current password' : 'Minimum 8 characters'}
        hint={isEditMode ? 'Only set this if you want to rotate the password.' : undefined}
        error={errors.password?.message}
        {...register('password')}
      />
      <SelectField
        label="Role"
        options={roleOptions}
        error={errors.role?.message}
        {...register('role')}
      />

      {submitError ? <ErrorMessage message={submitError} /> : null}

      <FormActions
        submitLabel={isEditMode ? 'Save changes' : 'Create user'}
        loadingLabel={isEditMode ? 'Saving changes...' : 'Creating user...'}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
      />
    </form>
  )
}

function UsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [statusTarget, setStatusTarget] = useState<{
    user: User
    nextActive: boolean
  } | null>(null)
  const debouncedSearch = useDebounce(search)

  const usersQuery = useQuery({
    queryKey: ['users', debouncedSearch, roleFilter, statusFilter],
    queryFn: () =>
      usersApi.listUsers({
        page: 1,
        limit: 100,
        search: debouncedSearch || undefined,
        role: roleFilter || undefined,
        isActive:
          statusFilter === ''
            ? undefined
            : statusFilter === 'active',
      }),
  })

  const saveMutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      setFormError(null)

      if (editingUser) {
        const payload: UpdateUserInput = {
          fullName: values.fullName.trim(),
          email: values.email.trim().toLowerCase(),
          role: values.role,
        }

        if (values.password?.trim()) {
          payload.password = values.password.trim()
        }

        return usersApi.updateUser(editingUser.id, payload)
      }

      const payload: CreateUserInput = {
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password!.trim(),
        role: values.role,
      }

      return usersApi.createUser(payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      setSheetOpen(false)
      setEditingUser(null)
      setFormError(null)
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, 'Unable to save the user.'))
    },
  })

  const statusMutation = useMutation({
    mutationFn: async (target: { user: User; nextActive: boolean }) =>
      usersApi.updateUserStatus(target.user.id, {
        isActive: target.nextActive,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      setStatusTarget(null)
    },
  })

  const totalUsers =
    usersQuery.data?.meta?.totalItems ?? usersQuery.data?.items.length ?? 0

  const columns = useMemo<DataTableColumn<User>[]>(
    () => [
      {
        key: 'user',
        header: 'User',
        render: (user) => (
          <div className="space-y-1">
            <p className="font-semibold text-ink-950">{user.fullName}</p>
            <p className="text-xs text-ink-500">{user.email}</p>
          </div>
        ),
      },
      {
        key: 'role',
        header: 'Role',
        render: (user) => (
          <StatusBadge label={roleLabels[user.role]} tone="brand" />
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (user) => (
          <StatusBadge
            label={user.isActive ? 'Active' : 'Inactive'}
            tone={user.isActive ? 'success' : 'danger'}
          />
        ),
      },
      {
        key: 'lastLogin',
        header: 'Last Login',
        render: (user) => (
          <span className="text-sm text-ink-600">
            {user.lastLoginAt
              ? new Date(user.lastLoginAt).toLocaleString()
              : 'Never'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-40',
        headerClassName: 'text-right',
        render: (user) => (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                setStatusTarget({
                  user,
                  nextActive: !user.isActive,
                })
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            >
              {user.isActive ? 'Disable' : 'Enable'}
            </button>
            <TableActions
              onEdit={() => {
                setEditingUser(user)
                setFormError(null)
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
          { label: 'Users' },
        ]}
        eyebrow="Administration"
        title="Users"
        description="Manage platform accounts, assign roles, and control access status."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingUser(null)
              setFormError(null)
              setSheetOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-ink-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-ink-800"
          >
            <Plus className="h-4 w-4" />
            Add user
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch('')}
          placeholder="Search by name or email"
        />
        <SelectField
          label="Role"
          value={roleFilter}
          options={[{ value: '', label: 'All roles' }, ...roleOptions]}
          onChange={(event) => setRoleFilter(event.target.value as UserRole | '')}
        />
        <SelectField
          label="Status"
          value={statusFilter}
          options={statusOptions}
          onChange={(event) =>
            setStatusFilter(event.target.value as 'active' | 'inactive' | '')
          }
        />
      </div>

      {usersQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(usersQuery.error, 'Unable to load users.')}
        />
      ) : usersQuery.isLoading ? (
        <div className="app-surface p-6">
          <Loader label="Loading users..." />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-sm text-ink-500">
              {totalUsers} user accounts
            </p>
          </div>
          <DataTable
            data={usersQuery.data?.items ?? []}
            columns={columns}
            getRowKey={(user) => user.id}
            emptyTitle="No users found."
            emptyDescription="Adjust your filters or create a new user account."
          />
        </>
      )}

      <SidePanel
        open={sheetOpen}
        title={editingUser ? 'Edit user account' : 'Create user account'}
        description="Use the shared backend user module for controlled account management."
        onClose={() => {
          setSheetOpen(false)
          setEditingUser(null)
          setFormError(null)
        }}
      >
        <UserForm
          user={editingUser}
          submitError={formError}
          isSubmitting={saveMutation.isPending}
          onCancel={() => {
            setSheetOpen(false)
            setEditingUser(null)
            setFormError(null)
          }}
          onSubmit={async (values) => {
            await saveMutation.mutateAsync(values)
          }}
        />
      </SidePanel>

      <ConfirmDialog
        open={!!statusTarget}
        title={
          statusTarget?.nextActive ? 'Activate user account?' : 'Deactivate user account?'
        }
        description={
          statusTarget
            ? `${statusTarget.user.fullName} will be ${
                statusTarget.nextActive ? 'allowed' : 'prevented'
              } from signing in until the status is changed again.`
            : undefined
        }
        confirmLabel={statusTarget?.nextActive ? 'Activate' : 'Deactivate'}
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

export default UsersPage
