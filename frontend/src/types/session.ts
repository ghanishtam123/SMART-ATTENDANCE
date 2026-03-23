import type { PaginationQuery } from './common'

export const sessionStatusValues = [
  'created',
  'started',
  'active',
  'completed',
  'archived',
] as const

export type SessionStatus = (typeof sessionStatusValues)[number]

export interface Session {
  id: string
  title: string | null
  classGroupId: string | null
  subjectId: string | null
  teacherId: string | null
  classroomId: string | null
  cameraIds: string[]
  scheduledDate: string
  scheduledStartTime: string
  scheduledEndTime: string
  actualStartTime: string | null
  actualEndTime: string | null
  graceMinutesForLate: number
  minimumPresenceMinutes: number
  minimumPresencePercentage: number
  status: SessionStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface SessionListQuery extends PaginationQuery {
  scheduledDate?: string
  teacherId?: string
  classGroupId?: string
  subjectId?: string
  status?: SessionStatus
}

export interface CreateSessionInput {
  title?: string
  classGroupId: string
  subjectId: string
  teacherId: string
  classroomId: string
  cameraIds?: string[]
  scheduledDate: string
  scheduledStartTime: string
  scheduledEndTime: string
  graceMinutesForLate: number
  minimumPresenceMinutes: number
  minimumPresencePercentage: number
  notes?: string
}

export type UpdateSessionInput = Partial<CreateSessionInput>
