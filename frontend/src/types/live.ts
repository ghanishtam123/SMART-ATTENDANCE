import type { UnknownFaceAlert } from './alert'
import type { Session } from './session'

export interface ActiveSessionsQuery {
  limit?: number
}

export interface RecentItemsQuery {
  limit?: number
}

export interface LiveCounters {
  totalEvents: number
  unknownFaceAlerts: number
  attendanceRecords: number
}

export interface LiveActiveSession extends Session {
  liveCounters: LiveCounters
}

export interface LiveEventSummary {
  totalEvents: number
  recognizedEvents: number
  unknownEvents: number
  lastEventAt: string | null
}

export interface LiveAlertSummary {
  totalAlerts: number
  reviewedAlerts: number
  pendingAlerts: number
  lastAlertAt: string | null
}

export interface LiveAttendanceSummary {
  totalRecords: number
  presentCount: number
  lateCount: number
  absentCount: number
  leftEarlyCount: number
}

export interface LiveSessionOverview {
  session: Session
  eventSummary: LiveEventSummary
  alertSummary: LiveAlertSummary
  attendanceSummary: LiveAttendanceSummary
}

export interface AttendanceBoundingBox {
  x: number
  y: number
  w: number
  h: number
}

export interface RecentSessionEvent {
  eventId: string
  sessionId: string
  studentId: string | null
  fullName: string | null
  rollNumber: string | null
  cameraId: string
  isUnknown: boolean
  confidence: number
  eventTimestamp: string
  processed: boolean
  boundingBox: AttendanceBoundingBox | null
}

export type RecentSessionAlert = UnknownFaceAlert
