import type {
  DateRangeQuery,
  EntityCodeReference,
  ExportFormat,
  PaginationMeta,
  PaginationQuery,
} from './common'
import type { AttendanceStatus } from './attendance'
import type { Session } from './session'

export interface AttendanceOverview {
  from: string | null
  to: string | null
  totalSessions: number
  totalStudents: number
  attendancePercentage: number
  presentCount: number
  lateCount: number
  absentCount: number
  leftEarlyCount: number
  unknownFaceAlertCount: number
}

export interface AttendanceOverviewQuery extends DateRangeQuery {
  classGroupId?: string
}

export interface AnalyticsOverviewExportQuery extends AttendanceOverviewQuery {
  format?: ExportFormat
}

export interface LowAttendanceQuery extends PaginationQuery, DateRangeQuery {
  classGroupId?: string
  threshold?: number
}

export interface LateEntriesQuery extends PaginationQuery, DateRangeQuery {
  classGroupId?: string
}

export type SessionAbsenteesQuery = PaginationQuery

export interface LowAttendanceStudent {
  studentId: string
  fullName: string
  rollNumber: string
  email: string | null
  totalSessions: number
  attendedSessions: number
  absentSessions: number
  presentCount: number
  lateCount: number
  leftEarlyCount: number
  attendancePercentage: number
  classGroup: EntityCodeReference
}

export interface LateEntry {
  attendanceRecordId: string
  sessionId: string
  studentId: string
  fullName: string
  rollNumber: string
  sessionTitle: string | null
  scheduledDate: string
  scheduledStartTime: string
  firstSeenAt: string | null
  lateThresholdAt: string | null
  lateByMinutes: number
  finalStatus: AttendanceStatus
  classGroup: EntityCodeReference
  subject: EntityCodeReference
}

export interface SessionAbsentee {
  attendanceRecordId: string
  studentId: string
  fullName: string
  rollNumber: string
  email: string | null
  phone: string | null
  remarks: string | null
  finalizedAt: string | null
}

export interface SessionAbsenteesMeta extends PaginationMeta {
  session: Session
}
