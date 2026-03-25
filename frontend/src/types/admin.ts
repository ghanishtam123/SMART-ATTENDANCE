import type { PaginationQuery } from './common'
import type { User } from './user'

export type AdminAccount = User

export interface AdminListQuery extends PaginationQuery {
  isActive?: boolean
}

export interface CreateAdminPayload {
  fullName: string
  email: string
  password: string
  isActive?: boolean
}

export interface UpdateAdminPayload {
  fullName?: string
  email?: string
  password?: string
}

export interface UpdateAdminStatusPayload {
  isActive: boolean
}
