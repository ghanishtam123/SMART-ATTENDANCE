import type { PaginationQuery } from './common'

export interface Classroom {
  id: string
  name: string
  code: string
  building: string
  floor: string
  capacity: number
  cameraIds: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ClassroomListQuery extends PaginationQuery {
  building?: string
  isActive?: boolean
}

export interface CreateClassroomInput {
  name: string
  code: string
  building: string
  floor: string
  capacity: number
  cameraIds?: string[]
  isActive?: boolean
}

export type UpdateClassroomInput = Partial<CreateClassroomInput>
