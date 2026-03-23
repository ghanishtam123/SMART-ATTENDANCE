import type {
  DateRangeQuery,
  EntityCodeReference,
  ExportFormat,
  PaginationQuery,
} from './common'
import type { AttendanceStatus } from './attendance'
import type { ClassGroup } from './classGroup'
import type { Student, FaceProfileSummary } from './student'
import type { User } from './user'

export interface StudentAttendanceOverview {
  studentId: string
  threshold: number
  totalSessions: number
  attendedSessions: number
  attendancePercentage: number
  presentCount: number
  lateCount: number
  absentCount: number
  leftEarlyCount: number
  lowAttendanceStatus: {
    threshold: number
    isLowAttendance: boolean
  }
}

export interface StudentPortalProfile {
  user: User
  student: Student
  classGroup: ClassGroup | null
  faceProfile: FaceProfileSummary | null
  attendanceOverview: StudentAttendanceOverview
}

export interface StudentPortalOverviewQuery extends DateRangeQuery {
  threshold?: number
}

export interface StudentPortalAttendanceHistoryQuery
  extends PaginationQuery,
    DateRangeQuery {
  status?: AttendanceStatus
}

export interface StudentPortalSubjectsQuery
  extends PaginationQuery,
    DateRangeQuery {
  threshold?: number
}

export interface StudentPortalSessionHistoryQuery
  extends PaginationQuery,
    DateRangeQuery {
  status?: AttendanceStatus
}

export interface StudentPortalAttendanceExportQuery extends DateRangeQuery {
  search?: string
  status?: AttendanceStatus
  format?: ExportFormat
}

export interface StudentAttendanceHistoryItem {
  attendanceRecordId: string
  sessionId: string
  status: AttendanceStatus
  firstSeenAt: string | null
  lastSeenAt: string | null
  totalPresenceMinutes: number
  attendancePercentageInSession: number
  confidenceAverage: number | null
  eventCount: number
  finalizedAt: string | null
  remarks: string | null
  session: {
    id: string
    title: string | null
    scheduledDate: string
    scheduledStartTime: string
    scheduledEndTime: string
    status: string
  }
  subject: EntityCodeReference
  classGroup: EntityCodeReference
}

export interface StudentSubjectAttendanceItem {
  subjectId: string
  subject: {
    name: string | null
    code: string | null
    description: string | null
    creditHours: number | null
  }
  totalSessions: number
  attendedSessions: number
  presentCount: number
  lateCount: number
  absentCount: number
  leftEarlyCount: number
  attendancePercentage: number
  lowAttendanceStatus: {
    threshold: number
    isLowAttendance: boolean
  }
}

export interface StudentSessionHistoryItem {
  sessionId: string
  attendanceRecordId: string
  title: string | null
  scheduledDate: string
  scheduledStartTime: string
  scheduledEndTime: string
  sessionStatus: string
  attendanceStatus: AttendanceStatus
  firstSeenAt: string | null
  lastSeenAt: string | null
  totalPresenceMinutes: number
  attendancePercentageInSession: number
  finalizedAt: string | null
  subject: EntityCodeReference
  classroom: EntityCodeReference & {
    building?: string | null
  }
}
