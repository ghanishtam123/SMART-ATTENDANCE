import { UserRole } from '../constants/roles';

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedUser extends AuthTokenPayload {
  studentId: string | null;
}

export interface SafeUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  linkedStudentId: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}
