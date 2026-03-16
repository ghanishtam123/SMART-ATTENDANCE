import {
  ATTENDANCE_RULE_DEFAULTS,
  AttendanceStatus,
} from '../constants/attendance';
import {
  AttendanceComputationInput,
  AttendanceComputationResult,
} from '../types/attendance.types';

interface PresenceInterval {
  start: Date;
  end: Date;
}

const roundTo = (value: number, precision = 2): number => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const getMinutesBetween = (startAt: Date, endAt: Date): number => {
  return Math.max(0, (endAt.getTime() - startAt.getTime()) / 60000);
};

const mergePresenceWindows = (
  timestamps: Date[],
  sessionEndAt: Date,
  windowMinutes: number = ATTENDANCE_RULE_DEFAULTS.PRESENCE_EVENT_WINDOW_MINUTES,
): PresenceInterval[] => {
  if (timestamps.length === 0) {
    return [];
  }

  const sortedTimestamps = [...timestamps].sort(
    (left, right) => left.getTime() - right.getTime(),
  );
  const windowMs = windowMinutes * 60 * 1000;

  // Each observation opens a short forward window to approximate continuous presence.
  return sortedTimestamps.reduce<PresenceInterval[]>((intervals, timestamp) => {
    const nextInterval: PresenceInterval = {
      start: timestamp,
      end: new Date(
        Math.min(sessionEndAt.getTime(), timestamp.getTime() + windowMs),
      ),
    };

    const previousInterval = intervals[intervals.length - 1];

    if (
      previousInterval &&
      nextInterval.start.getTime() <= previousInterval.end.getTime()
    ) {
      previousInterval.end = new Date(
        Math.max(previousInterval.end.getTime(), nextInterval.end.getTime()),
      );
      return intervals;
    }

    intervals.push(nextInterval);
    return intervals;
  }, []);
};

export const estimatePresenceMinutes = (
  timestamps: Date[],
  sessionEndAt: Date,
  windowMinutes: number = ATTENDANCE_RULE_DEFAULTS.PRESENCE_EVENT_WINDOW_MINUTES,
): number => {
  const intervals = mergePresenceWindows(timestamps, sessionEndAt, windowMinutes);

  return Math.round(
    intervals.reduce((totalMinutes, interval) => {
      return totalMinutes + getMinutesBetween(interval.start, interval.end);
    }, 0),
  );
};

export const deriveAttendanceOutcome = (
  input: AttendanceComputationInput,
): AttendanceComputationResult => {
  const {
    sessionStartAt,
    sessionEndAt,
    eventTimestamps,
    confidences,
    graceMinutesForLate,
    minimumPresenceMinutes,
    minimumPresencePercentage,
    presenceEventWindowMinutes,
    earlyExitThresholdMinutes,
  } = input;

  const eventCount = eventTimestamps.length;

  if (eventCount === 0) {
    return {
      status: AttendanceStatus.ABSENT,
      firstSeenAt: null,
      lastSeenAt: null,
      totalPresenceMinutes: 0,
      attendancePercentageInSession: 0,
      confidenceAverage: null,
      eventCount: 0,
      remarks: 'No recognized observations were recorded for the session.',
      lateArrival: false,
      leftEarly: false,
    };
  }

  const sortedTimestamps = [...eventTimestamps].sort(
    (left, right) => left.getTime() - right.getTime(),
  );
  const firstSeenAt = sortedTimestamps[0];
  const lastSeenAt = sortedTimestamps[sortedTimestamps.length - 1];
  const totalPresenceMinutes = estimatePresenceMinutes(
    sortedTimestamps,
    sessionEndAt,
    presenceEventWindowMinutes,
  );
  const sessionDurationMinutes = Math.max(
    1,
    Math.round(getMinutesBetween(sessionStartAt, sessionEndAt)),
  );
  const attendancePercentageInSession = roundTo(
    Math.min(100, (totalPresenceMinutes / sessionDurationMinutes) * 100),
  );
  const confidenceAverage = roundTo(
    confidences.reduce((total, confidence) => total + confidence, 0) /
      confidences.length,
    4,
  );
  const lateArrival =
    firstSeenAt.getTime() >
    sessionStartAt.getTime() + graceMinutesForLate * 60 * 1000;
  const leftEarly =
    lastSeenAt.getTime() <
    sessionEndAt.getTime() - earlyExitThresholdMinutes * 60 * 1000;
  const meetsPresenceThreshold =
    totalPresenceMinutes >= minimumPresenceMinutes ||
    attendancePercentageInSession >= minimumPresencePercentage;

  if (!meetsPresenceThreshold) {
    return {
      status: AttendanceStatus.ABSENT,
      firstSeenAt,
      lastSeenAt,
      totalPresenceMinutes,
      attendancePercentageInSession,
      confidenceAverage,
      eventCount,
      remarks:
        'Recognized observations were below the required presence duration or percentage threshold.',
      lateArrival,
      leftEarly,
    };
  }

  if (leftEarly && lateArrival) {
    return {
      status: AttendanceStatus.LEFT_EARLY,
      firstSeenAt,
      lastSeenAt,
      totalPresenceMinutes,
      attendancePercentageInSession,
      confidenceAverage,
      eventCount,
      remarks: 'Late arrival and early departure were both detected.',
      lateArrival,
      leftEarly,
    };
  }

  if (leftEarly) {
    return {
      status: AttendanceStatus.LEFT_EARLY,
      firstSeenAt,
      lastSeenAt,
      totalPresenceMinutes,
      attendancePercentageInSession,
      confidenceAverage,
      eventCount,
      remarks: 'Student left before the early-exit threshold near session end.',
      lateArrival,
      leftEarly,
    };
  }

  if (lateArrival) {
    return {
      status: AttendanceStatus.LATE,
      firstSeenAt,
      lastSeenAt,
      totalPresenceMinutes,
      attendancePercentageInSession,
      confidenceAverage,
      eventCount,
      remarks: 'Student was first seen after the allowed grace window.',
      lateArrival,
      leftEarly,
    };
  }

  return {
    status: AttendanceStatus.PRESENT,
    firstSeenAt,
    lastSeenAt,
    totalPresenceMinutes,
    attendancePercentageInSession,
    confidenceAverage,
    eventCount,
    remarks: null,
    lateArrival,
    leftEarly,
  };
};
