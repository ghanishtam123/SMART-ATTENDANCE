# Smart Attendance Backend

Production-structured backend for the **AI-Based Smart Classroom Attendance and Monitoring System Using Face Recognition** project.

This service is responsible for authentication, academic master data, session lifecycle management, AI observation ingestion, attendance derivation, analytics, alerts, and audit logging. Face recognition itself stays outside this codebase and is expected to run in a separate Python AI service.

## Tech Stack

- Node.js
- Express.js
- TypeScript
- MongoDB
- Mongoose
- Zod for environment validation

## Getting Started

1. Copy `.env.example` to `.env`.
2. Update environment values for your local machine.
3. Install dependencies:

```bash
npm install
```

4. Start the development server:

```bash
npm run dev
```

5. Build for production:

```bash
npm run build
```

6. Clean compiled output explicitly when needed:

```bash
npm run clean
```

6. Start the compiled server:

```bash
npm start
```

## Available Scripts

- `npm run dev` - Start the server in watch mode with `nodemon` and `ts-node`
- `npm run clean` - Remove generated `dist/` output
- `npm run build` - Compile TypeScript into `dist/`
- `npm start` - Run the compiled production server
- `npm run typecheck` - Run TypeScript checks without emitting files
- `npm run seed:super-admin -- --fullName "System Admin" --email admin@example.com --password "StrongPass123!"` - Create an initial super admin directly in MongoDB

## Environment Variables

- `NODE_ENV` - runtime environment (`development`, `test`, `production`)
- `PORT` - HTTP server port
- `API_PREFIX` - versioned API prefix, default `/api/v1`
- `MONGODB_URI` - MongoDB connection string
- `CORS_ORIGIN` - allowed frontend origin or comma-separated origins
- `LOG_LEVEL` - pino log level
- `RATE_LIMIT_WINDOW_MS` - rate limit window in milliseconds
- `RATE_LIMIT_MAX_REQUESTS` - max requests per window
- `JWT_SECRET` - secret used to sign access tokens
- `JWT_EXPIRES_IN` - access token lifetime
- `BCRYPT_SALT_ROUNDS` - password hashing cost
- `AUTH_BOOTSTRAP_ENABLED` - enables one-time initial `super_admin` registration when no users exist
- `AUTH_BOOTSTRAP_SECRET` - secret required for bootstrap registration
- `AI_INTERNAL_API_KEY` - internal API key used by the Python AI service for event ingestion

## Local Run Commands

```bash
cp .env.example .env
npm install
npm run typecheck
npm run dev
```

To create the first administrator without using bootstrap registration:

```bash
npm run seed:super-admin -- --fullName "System Admin" --email admin@example.com --password "StrongPass123!"
```

To build and run the compiled app:

```bash
npm run build
npm start
```

## First Admin Setup

Choose one of these flows:

1. Bootstrap registration

- keep `AUTH_BOOTSTRAP_ENABLED=true`
- set `AUTH_BOOTSTRAP_SECRET` in `.env`
- send `POST /api/v1/auth/register` with the `x-bootstrap-secret` header
- create the first user with role `super_admin`

2. Seed script

- run `npm run seed:super-admin -- --fullName "System Admin" --email admin@example.com --password "StrongPass123!"`
- this inserts the first `super_admin` directly into MongoDB

## Backend Modules

- `config` for environment loading, database connection, and structured logging.
- `constants` for roles, statuses, and shared enums.
- `models` for MongoDB collections and indexes.
- `validators` for request body, params, and query validation.
- `middleware` for auth, RBAC, request validation, logging, 404 handling, and centralized errors.
- `services` for business logic, attendance rules, analytics, audit logging, and AI ingestion.
- `controllers` for thin HTTP handlers.
- `routes` for versioned route registration.
- `types` for shared TypeScript contracts.
- `docs` for API contracts, attendance rules, and roadmap notes.
- `scripts` for developer utilities such as seeding the first super admin.

## Route Summary

- Health
  - `GET /health`
- Auth
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `GET /api/v1/auth/me`
- Students
  - `GET|POST /api/v1/students`
  - `GET|PATCH|DELETE /api/v1/students/:id`
- Teachers
  - `GET|POST /api/v1/teachers`
  - `GET|PATCH|DELETE /api/v1/teachers/:id`
- Classrooms
  - `GET|POST /api/v1/classrooms`
  - `GET|PATCH|DELETE /api/v1/classrooms/:id`
- Class groups
  - `GET|POST /api/v1/class-groups`
  - `GET|PATCH|DELETE /api/v1/class-groups/:id`
- Subjects
  - `GET|POST /api/v1/subjects`
  - `GET|PATCH|DELETE /api/v1/subjects/:id`
- Sessions
  - `GET|POST /api/v1/sessions`
  - `GET|PATCH|DELETE /api/v1/sessions/:id`
  - `POST /api/v1/sessions/:id/start`
  - `POST /api/v1/sessions/:id/complete`
  - `POST /api/v1/sessions/:id/archive`
- AI ingestion
  - `POST /api/v1/ai/recognition-events`
- Alerts
  - `GET /api/v1/alerts/unknown-faces`
  - `PATCH /api/v1/alerts/unknown-faces/:id/reviewed`
- Attendance
  - `POST /api/v1/attendance/sessions/:sessionId/recalculate`
  - `POST /api/v1/attendance/sessions/:sessionId/finalize`
  - `GET /api/v1/attendance/sessions/:sessionId/records`
  - `GET /api/v1/attendance/sessions/:sessionId/summary`
  - `GET /api/v1/attendance/class-groups/:classGroupId/summary`
  - `GET /api/v1/attendance/students/:studentId/history`
- Analytics
  - `GET /api/v1/analytics/attendance-overview`
  - `GET /api/v1/analytics/low-attendance`
  - `GET /api/v1/analytics/late-entries`
  - `GET /api/v1/analytics/session-absentees/:sessionId`

## Authentication and Authorization

- `POST /api/v1/auth/register` creates users.
- If no user exists yet, the first `super_admin` can be created only when `AUTH_BOOTSTRAP_ENABLED=true` and a valid bootstrap secret is sent in the `x-bootstrap-secret` header.
- After bootstrap:
  - `super_admin` can create `super_admin`, `admin`, and `teacher`
  - `admin` can create `teacher`
- `POST /api/v1/auth/login` returns a JWT access token.
- `GET /api/v1/auth/me` returns the authenticated user profile.

## Deployment And Config

- Use `NODE_ENV=production` in deployed environments.
- Set explicit production values for `JWT_SECRET`, `AI_INTERNAL_API_KEY`, and `CORS_ORIGIN`.
- Keep `AUTH_BOOTSTRAP_ENABLED=false` after the initial administrator is created.
- The app refuses unsafe production defaults such as wildcard CORS or placeholder secrets.
- MongoDB runs with `autoIndex=false` in production for safer startup behavior.

## Developer Docs

- API overview: `src/docs/api-overview.md`
- Attendance rules: `src/docs/attendance-business-rules.md`
- Future enhancements and limitations: `src/docs/future-enhancements.md`

## Integration Notes

- Frontend clients should use the versioned base URL under `API_PREFIX`, typically `/api/v1`.
- The Python AI service should send raw observations only to `POST /api/v1/ai/recognition-events`.
- Final attendance is derived from stored `AttendanceEvent` rows after session completion, not directly from incoming AI payloads.
- `npm run build` now clears stale compiled files before emitting `dist/`, which avoids old route or module artifacts during local iteration.

## Operational Hardening

- Audit logs are stored for key actions such as login, user creation, student changes, session lifecycle changes, attendance finalization, and alert review.
- AI ingestion remains protected by the internal API key middleware on `/api/v1/ai/*`.
- Request validation is applied across body/query/param endpoints that accept user input.
- Centralized error handling normalizes invalid JSON, duplicate key errors, validation errors, and malformed identifiers.

## Current Scope

- Session-centric attendance derived from raw AI observations.
- Teacher/admin APIs for master data, sessions, reports, and analytics.
- Protected internal AI ingestion endpoint for recognition events.
- Audit trail for key operational actions.

## Known Limitations And Future Work

- Session attendance currently uses active class-group students rather than frozen enrollment snapshots.
- JSON reporting endpoints are ready, but CSV/PDF export is not implemented yet.
- WebSocket live updates, timetable automation, student self-dashboard support, and anti-spoofing flags are planned next-stage enhancements.
