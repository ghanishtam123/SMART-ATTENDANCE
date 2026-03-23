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

export interface CreateTeacherInput {
  userId: string
  employeeId: string
  department: string
  designation: string
  subjectsTaught?: string[]
  assignedClassGroups?: string[]
}

export type UpdateTeacherInput = Partial<CreateTeacherInput>
