export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  TEACHER = 'teacher',
  STUDENT = 'student',
}

export const USER_ROLE_VALUES = Object.values(UserRole);

export const ADMIN_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
];

export const ADMIN_MANAGED_USER_ROLES: UserRole[] = [
  UserRole.TEACHER,
  UserRole.STUDENT,
];
