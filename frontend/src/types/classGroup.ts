import type { PaginationQuery } from './common'

export interface ClassGroup {
  id: string
  name: string
  code: string
  department: string
  semester: number
  section: string
  academicYear: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ClassGroupListQuery extends PaginationQuery {
  department?: string
  semester?: number
  academicYear?: string
  isActive?: boolean
}

export interface CreateClassGroupInput {
  name: string
  code: string
  department: string
  semester: number
  section: string
  academicYear: string
  isActive?: boolean
}

export type UpdateClassGroupInput = Partial<CreateClassGroupInput>
