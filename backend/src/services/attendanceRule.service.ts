import {
  ATTENDANCE_RULE_DEFAULTS,
} from '../constants/attendance';
import {
  AttendanceComputationInput,
  AttendanceComputationResult,
} from '../types/attendance.types';
import { deriveAttendanceOutcome } from '../utils/attendanceCalculator';

export const attendanceRuleService = {
  evaluateAttendance: (
    input: Omit<
      AttendanceComputationInput,
      'presenceEventWindowMinutes' | 'earlyExitThresholdMinutes'
    > & {
      presenceEventWindowMinutes?: number;
      earlyExitThresholdMinutes?: number;
    },
  ): AttendanceComputationResult => {
    return deriveAttendanceOutcome({
      ...input,
      presenceEventWindowMinutes:
        input.presenceEventWindowMinutes ??
        ATTENDANCE_RULE_DEFAULTS.PRESENCE_EVENT_WINDOW_MINUTES,
      earlyExitThresholdMinutes:
        input.earlyExitThresholdMinutes ??
        ATTENDANCE_RULE_DEFAULTS.EARLY_EXIT_THRESHOLD_MINUTES,
    });
  },
};
