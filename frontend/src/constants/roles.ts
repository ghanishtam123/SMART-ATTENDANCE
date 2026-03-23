import type { UserRole } from '../types/user'

export const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  teacher: 'Teacher',
  student: 'Student',
}

export const adminRoles: UserRole[] = ['super_admin', 'admin']

export const staffRoles: UserRole[] = ['super_admin', 'admin', 'teacher']

export const studentRoles: UserRole[] = ['student']
