import { AttendanceStatus } from '../constants/attendance';

export interface AttendanceComputationInput {
  sessionStartAt: Date;
  sessionEndAt: Date;
  eventTimestamps: Date[];
  confidences: number[];
  graceMinutesForLate: number;
  minimumPresenceMinutes: number;
  minimumPresencePercentage: number;
  presenceEventWindowMinutes: number;
  earlyExitThresholdMinutes: number;
}

export interface AttendanceComputationResult {
  status: AttendanceStatus;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  totalPresenceMinutes: number;
  attendancePercentageInSession: number;
  confidenceAverage: number | null;
  eventCount: number;
  remarks: string | null;
  lateArrival: boolean;
  leftEarly: boolean;
}
