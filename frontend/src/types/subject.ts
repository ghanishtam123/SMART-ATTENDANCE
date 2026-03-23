import type { PaginationQuery } from './common'

export interface Subject {
  id: string
  name: string
  code: string
  description: string
  creditHours: number | null
  assignedTeacherIds: string[]
  classGroupIds: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface SubjectListQuery extends PaginationQuery {
  isActive?: boolean
  assignedTeacherId?: string
  classGroupId?: string
}

export interface CreateSubjectInput {
  name: string
  code: string
  description: string
  creditHours?: number
  assignedTeacherIds?: string[]
  classGroupIds?: string[]
  isActive?: boolean
}

export type UpdateSubjectInput = Partial<CreateSubjectInput>
