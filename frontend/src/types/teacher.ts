import type { PaginationQuery } from './common'

export interface TeacherProfile {
  id: string
  userId: string | null
  employeeId: string
  department: string
  designation: string
  subjectsTaught: string[]
  assignedClassGroups: string[]
  createdAt: string
  updatedAt: string
}

export interface TeacherListQuery extends PaginationQuery {
  department?: string
  designation?: string
  userId?: string
}

export interface TeacherLoginDetails {
  fullName: string
  email: string
  password: string
  isActive: boolean
}

export interface CreateTeacherPayload {
  employeeId: string
  department: string
  designation: string
  subjectsTaught?: string[]
  assignedClassGroups?: string[]
  createLoginAccount: true
  login: TeacherLoginDetails
}

export type CreateTeacherInput = CreateTeacherPayload

export interface UpdateTeacherInput {
  userId?: string
  employeeId?: string
  department?: string
  designation?: string
  subjectsTaught?: string[]
  assignedClassGroups?: string[]
}
