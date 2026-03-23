export const userRoleValues = [
  'super_admin',
  'admin',
  'teacher',
  'student',
] as const

export type UserRole = (typeof userRoleValues)[number]

export interface User {
  id: string
  fullName: string
  email: string
  role: UserRole
  linkedStudentId: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface UserListQuery {
  page?: number
  limit?: number
  search?: string
  role?: UserRole
  isActive?: boolean
}

export interface CreateUserInput {
  fullName: string
  email: string
  password: string
  role: UserRole
}

export interface UpdateUserInput {
  fullName?: string
  email?: string
  password?: string
  role?: UserRole
}

export interface UpdateUserStatusInput {
  isActive: boolean
}
