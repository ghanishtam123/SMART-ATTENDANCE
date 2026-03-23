import { adminRoles } from '../constants/roles'
import { routes } from '../constants/routes'
import type { UserRole } from '../types/user'

export const getDashboardRouteForRole = (role: UserRole) => {
  switch (role) {
    case 'super_admin':
    case 'admin':
      return routes.adminDashboard
    case 'teacher':
      return routes.teacherDashboard
    case 'student':
      return routes.studentDashboard
  }
}

export const hasAnyRole = (
  role: UserRole | null | undefined,
  allowedRoles: UserRole[],
) => !!role && allowedRoles.includes(role)

export const isAdminRole = (role: UserRole | null | undefined) =>
  !!role && adminRoles.includes(role)
