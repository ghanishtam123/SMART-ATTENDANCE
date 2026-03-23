import type { PaginationQuery } from './common'

export const timetableDayValues = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export type TimetableDayOfWeek = (typeof timetableDayValues)[number]

export interface TimetableEntry {
  id: string
  classGroupId: string | null
  subjectId: string | null
  teacherId: string | null
  classroomId: string | null
  dayOfWeek: TimetableDayOfWeek
  startTime: string
  endTime: string
  cameraIds: string[]
  isActive: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface TimetableListQuery extends PaginationQuery {
  dayOfWeek?: TimetableDayOfWeek
  classGroupId?: string
  teacherId?: string
  classroomId?: string
  isActive?: boolean
}

export interface CreateTimetableEntryInput {
  classGroupId: string
  subjectId: string
  teacherId: string
  classroomId: string
  dayOfWeek: TimetableDayOfWeek
  startTime: string
  endTime: string
  cameraIds?: string[]
  isActive?: boolean
  notes?: string
}

export type UpdateTimetableEntryInput = Partial<CreateTimetableEntryInput>
