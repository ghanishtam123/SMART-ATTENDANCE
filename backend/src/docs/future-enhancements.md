# Future Enhancements

## Known Limitations

- Attendance roster is derived from the current active students in a class group rather than an immutable session-time enrollment snapshot.
- Presence duration is estimated from repeated recognition events and does not represent continuous biometric tracking.
- Raw face embeddings are intentionally not stored in MongoDB in this version.
- Audit logs are written internally, but there is no dedicated admin audit browsing API yet.
- Export endpoints currently return JSON only; CSV and PDF generation are still future work.
- Real-time updates are not pushed over WebSocket or SSE in this version.

## Planned Enhancements

- Timetable integration for auto-generated sessions and stronger schedule conflict checks.
- Enrollment snapshotting so attendance uses the exact class roster at session creation time.
- Anti-spoofing flags from the AI service, including liveness or suspicious-frame metadata.
- Student self-dashboard for personal attendance history and notification visibility.
- CSV and PDF export jobs for reports and formal attendance sheets.
- WebSocket live updates for session attendance dashboards and unknown-face alerts.
- Background jobs for archival, analytics precomputation, and scheduled report generation.
- Stronger AI integration features such as signed payloads, retry ids, and idempotency keys.

## Extension Notes

- Timetable integration should plug into the existing `Session` creation flow rather than bypass it.
- Anti-spoofing or liveness signals should be added to `AttendanceEvent.metadata` first, then promoted into explicit fields only when the signal contract stabilizes.
- Student self-dashboard APIs can reuse the existing attendance-history and analytics service patterns with student-scoped authorization.
- CSV or PDF export is best added as async job generation to avoid blocking dashboard requests.
- Live updates should sit beside the existing REST APIs instead of replacing them, so dashboards can combine initial REST loads with WebSocket or SSE subscriptions.
