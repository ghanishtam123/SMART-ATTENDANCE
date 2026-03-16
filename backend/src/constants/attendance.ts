export enum AttendanceStatus {
  PRESENT = 'present',
  LATE = 'late',
  ABSENT = 'absent',
  LEFT_EARLY = 'left_early',
}

export const ATTENDANCE_STATUS_VALUES = Object.values(AttendanceStatus);

export const ATTENDANCE_RULE_DEFAULTS = {
  PRESENCE_EVENT_WINDOW_MINUTES: 5,
  EARLY_EXIT_THRESHOLD_MINUTES: 10,
} as const;
