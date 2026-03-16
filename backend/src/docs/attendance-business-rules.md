# Attendance Business Rules

## Core Principle

- `AttendanceEvent` stores raw AI observations.
- `AttendanceRecord` stores one derived attendance outcome per student per session.
- Final attendance is always computed by the backend, never directly trusted from the AI service.

## Session Scope

- Attendance is derived per session.
- A session must be in `completed` or `archived` state before recalculation or finalization runs.
- The attendance roster is currently derived from active students assigned to the session's `classGroupId`.
  This is a practical v1 assumption until timetable/enrollment snapshots are added.

## Valid Events

- Only recognized `AttendanceEvent` entries are used for attendance generation.
- Unknown events are excluded from final attendance records.
- Events are filtered by:
  - matching `sessionId`
  - `isUnknown = false`
  - non-null `studentId`
  - timestamp inside the effective session window
- The effective session window uses:
  - `actualStartTime` when available, otherwise scheduled start
  - `actualEndTime` when available, otherwise scheduled end for completed sessions

## Derived Fields

- `firstSeenAt` = earliest valid event timestamp for the student in the session
- `lastSeenAt` = latest valid event timestamp for the student in the session
- `eventCount` = number of valid recognized events
- `confidenceAverage` = average confidence of valid recognized events

## Presence Duration Assumption

- Presence is estimated, not measured continuously.
- Each recognized event opens a short presence window of `5` minutes by default.
- Overlapping event windows are merged into intervals.
- `totalPresenceMinutes` is the sum of those merged intervals inside the session window.
- This prevents a single frame from counting as full-session attendance while still allowing repeated detections to approximate continuous presence.

## Default Rule Constants

- Presence event window: `5` minutes
- Early-exit threshold: `10` minutes before session end
- Late-entry threshold: controlled per session by `graceMinutesForLate`
- Minimum presence thresholds: controlled per session by `minimumPresenceMinutes` and `minimumPresencePercentage`

## Status Rules

- `absent`
  - no valid recognized events exist, or
  - the student fails both minimum presence thresholds
- `late`
  - the student meets presence criteria, and
  - `firstSeenAt` is after the session grace window
- `left_early`
  - the student meets presence criteria, and
  - `lastSeenAt` is earlier than `10` minutes before the session end
- `present`
  - the student meets presence criteria and is neither late nor left early

## Presence Threshold Rule

- A student is considered to have met the minimum presence requirement when either:
  - `totalPresenceMinutes >= minimumPresenceMinutes`, or
  - `attendancePercentageInSession >= minimumPresencePercentage`

## Status Precedence

- `absent` has highest precedence when there are no valid events or presence is insufficient.
- If both late arrival and early departure happen, the final status becomes `left_early`.
- In that overlap case, remarks preserve the fact that both conditions were detected.

## Finalization

- Recalculate:
  - recomputes and upserts attendance records without marking the session events as processed
- Finalize:
  - recomputes and upserts attendance records
  - sets `finalizedAt`
  - marks all session `AttendanceEvent` rows as `processed = true`
