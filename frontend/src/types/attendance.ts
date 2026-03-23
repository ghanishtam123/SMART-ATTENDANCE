import type {
  DateRangeQuery,
  ExportFormat,
  PaginationQuery,
} from './common'
import type { ClassGroup } from './classGroup'
import type { Session } from './session'

export const attendanceStatusValues = [
  'present',
  'late',
  'absent',
  'left_early',
] as const

export type AttendanceStatus = (typeof attendanceStatusValues)[number]

export interface AttendanceRecord {
  id: string
  sessionId: string | null
  studentId: string | null
  classGroupId: string | null
  subjectId: string | null
  teacherId: string | null
  status: AttendanceStatus
  firstSeenAt: string | null
  lastSeenAt: string | null
  totalPresenceMinutes: number
  attendancePercentageInSession: number
  confidenceAverage: number | null
  eventCount: number
  remarks: string | null
  finalizedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AttendanceLifecycleSummary {
  sessionId: string
  totalStudentsEvaluated: number
  recordsUpserted: number
  statusBreakdown: Record<AttendanceStatus, number>
  finalized: boolean
  finalizedAt: string | null
}

export interface SessionAttendanceSummary {
  session: Session
  totalStudents: number
  recordsGenerated: number
  attendancePercentage: number
  presentCount: number
  lateCount: number
  absentCount: number
  leftEarlyCount: number
  unknownFaceAlertCount: number
}

export interface ClassGroupAttendanceSummary {
  classGroup: ClassGroup
  from: string | null
  to: string | null
  totalSessions: number
  totalStudents: number
  recordsGenerated: number
  attendancePercentage: number
  presentCount: number
  lateCount: number
  absentCount: number
  leftEarlyCount: number
  unknownFaceAlertCount: number
}

export interface SessionAttendanceRecordsQuery
  extends PaginationQuery,
    DateRangeQuery {
  status?: AttendanceStatus
}

export interface StudentAttendanceHistoryQuery
  extends PaginationQuery,
    DateRangeQuery {
  status?: AttendanceStatus
}

export type ClassGroupAttendanceSummaryQuery = DateRangeQuery

export interface SessionAttendanceExportQuery {
  format?: ExportFormat
}

export interface StudentAttendanceExportQuery extends DateRangeQuery {
  format?: ExportFormat
  status?: AttendanceStatus
}

export interface ClassGroupAttendanceExportQuery extends DateRangeQuery {
  format?: ExportFormat
}
