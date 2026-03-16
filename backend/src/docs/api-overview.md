# API Overview

## Base

- Health check: `GET /health`
- API base: `/api/v1`

## Authentication

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`

### Sample Register Payload

```json
{
  "fullName": "System Administrator",
  "email": "admin@example.com",
  "password": "StrongPass123!",
  "role": "super_admin"
}
```

### Sample Login Payload

```json
{
  "email": "admin@example.com",
  "password": "StrongPass123!"
}
```

## Master Data

- `GET|POST /api/v1/students`
- `GET|PATCH|DELETE /api/v1/students/:id`
- `GET|POST /api/v1/teachers`
- `GET|PATCH|DELETE /api/v1/teachers/:id`
- `GET|POST /api/v1/classrooms`
- `GET|PATCH|DELETE /api/v1/classrooms/:id`
- `GET|POST /api/v1/class-groups`
- `GET|PATCH|DELETE /api/v1/class-groups/:id`
- `GET|POST /api/v1/subjects`
- `GET|PATCH|DELETE /api/v1/subjects/:id`

### Sample Class Group Create Payload

```json
{
  "name": "BCA 3rd Year A",
  "code": "BCA3A",
  "department": "Computer Science",
  "semester": 6,
  "section": "A",
  "academicYear": "2025-2026",
  "isActive": true
}
```

### Sample Classroom Create Payload

```json
{
  "name": "Smart Room 101",
  "code": "SR101",
  "building": "Main Block",
  "floor": "1",
  "capacity": 60,
  "cameraIds": ["cam-01"],
  "isActive": true
}
```

### Sample Student Create Payload

```json
{
  "firstName": "Aarav",
  "lastName": "Sharma",
  "rollNumber": "CSE-2026-001",
  "email": "aarav.sharma@example.com",
  "phone": "+91-9876543210",
  "gender": "male",
  "classGroupId": "mongoId",
  "status": "active"
}
```

### Sample Subject Create Payload

```json
{
  "name": "Artificial Intelligence",
  "code": "AI601",
  "description": "AI fundamentals and practical applications",
  "creditHours": 4,
  "assignedTeacherIds": [],
  "classGroupIds": ["mongoId"],
  "isActive": true
}
```

### Sample Teacher Profile Create Payload

```json
{
  "userId": "mongoId",
  "employeeId": "EMP-1001",
  "department": "Computer Science",
  "designation": "Assistant Professor",
  "subjectsTaught": ["mongoId"],
  "assignedClassGroups": ["mongoId"]
}
```

## Sessions

- `GET|POST /api/v1/sessions`
- `GET|PATCH|DELETE /api/v1/sessions/:id`
- `POST /api/v1/sessions/:id/start`
- `POST /api/v1/sessions/:id/complete`
- `POST /api/v1/sessions/:id/archive`

### Sample Session Create Payload

```json
{
  "classGroupId": "mongoId",
  "subjectId": "mongoId",
  "teacherId": "mongoId",
  "classroomId": "mongoId",
  "cameraIds": ["cam-01", "cam-02"],
  "scheduledDate": "2026-03-12",
  "scheduledStartTime": "10:00",
  "scheduledEndTime": "11:00",
  "graceMinutesForLate": 10,
  "minimumPresenceMinutes": 30,
  "minimumPresencePercentage": 60,
  "notes": "Regular lecture session"
}
```

## AI Contract

### Endpoint

- `POST /api/v1/ai/recognition-events`

### Security

- Header: `x-api-key: <AI_INTERNAL_API_KEY>`
- This endpoint is intended for the internal Python AI service only.

### Request Body

```json
{
  "sessionId": "mongoId",
  "cameraId": "cam-01",
  "events": [
    {
      "studentId": "mongoId-or-null",
      "isUnknown": false,
      "confidence": 0.94,
      "timestamp": "2026-03-12T10:15:30.000Z",
      "boundingBox": {
        "x": 100,
        "y": 120,
        "w": 80,
        "h": 80
      }
    }
  ]
}
```

### Sample Accepted Response Shape

```json
{
  "success": true,
  "message": "Recognition events ingested successfully.",
  "data": {
    "sessionId": "mongoId",
    "cameraId": "cam-01",
    "totalEventsReceived": 3,
    "recognizedEventCount": 2,
    "unknownEventCount": 1
  }
}
```

### Validation Rules

- `sessionId` is required and must be a valid MongoDB ObjectId.
- `cameraId` is required.
- `events` must be a non-empty array.
- `confidence` must be between `0` and `1`.
- `timestamp` must be a valid ISO datetime string.
- If `isUnknown` is `true`, `studentId` must be `null`.
- If `isUnknown` is `false`, `studentId` must be a valid student id.
- If the session defines `cameraIds`, the provided `cameraId` must belong to that session.

### Current Phase Behavior

- The backend validates the request and session/student references.
- The backend stores every observation as an `AttendanceEvent`.
- Unknown detections are also stored as `UnknownFaceAlert` records for review.
- The backend returns an accepted ingestion summary.

## Face Profile Metadata

- `FaceProfile` stores face-registration metadata only in this phase.
- Raw embeddings are intentionally not stored in MongoDB in this version.
- The Python AI service is assumed to manage actual embedding files or secure external storage.

## Unknown Face Alerts

- `GET /api/v1/alerts/unknown-faces`
- `PATCH /api/v1/alerts/unknown-faces/:id/reviewed`

### Sample Alert Review Payload

```json
{
  "notes": "Reviewed by admin after manual verification."
}
```

## Attendance Processing

- `POST /api/v1/attendance/sessions/:sessionId/recalculate`
- `POST /api/v1/attendance/sessions/:sessionId/finalize`
- `GET /api/v1/attendance/sessions/:sessionId/records`
- `GET /api/v1/attendance/sessions/:sessionId/summary`
- `GET /api/v1/attendance/class-groups/:classGroupId/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/v1/attendance/students/:studentId/history`

### Sample Attendance Record Response Shape

```json
{
  "id": "mongoId",
  "sessionId": "mongoId",
  "studentId": "mongoId",
  "status": "late",
  "firstSeenAt": "2026-03-12T10:12:00.000Z",
  "lastSeenAt": "2026-03-12T10:57:00.000Z",
  "totalPresenceMinutes": 38,
  "attendancePercentageInSession": 63.33,
  "confidenceAverage": 0.9475,
  "eventCount": 12,
  "remarks": "Student was first seen after the allowed grace window.",
  "finalizedAt": "2026-03-12T11:10:00.000Z"
}
```

### Attendance Processing Notes

- Attendance is derived from stored `AttendanceEvent` rows, not directly from AI payloads.
- Recalculation upserts attendance records without marking raw events as processed.
- Finalization recalculates, stamps `finalizedAt`, and marks session events as processed.

## Analytics

- `GET /api/v1/analytics/attendance-overview?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/v1/analytics/low-attendance?threshold=75&page=1&limit=10`
- `GET /api/v1/analytics/late-entries?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=10`
- `GET /api/v1/analytics/session-absentees/:sessionId?page=1&limit=10`

## Notes For Frontend And AI Teams

- API responses use a standardized success envelope with `success`, `message`, `data`, and optional `meta`.
- Resource responses expose `id` and not `_id`.
- Most dashboard routes support `page` and `limit`, and several also support `from` / `to` date filtering.
- The AI integration contract is intentionally append-only: store observations first, derive attendance later.

### Summary Metrics Returned By Reporting Endpoints

- total sessions
- total students
- attendance percentage
- present count
- late count
- absent count
- left early count
- unknown face alert count
