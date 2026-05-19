import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Camera,
  MonitorPlay,
  Radar,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { liveApi } from '../../api/live.api'
import EmptyState from '../../components/common/EmptyState'
import ErrorMessage from '../../components/common/ErrorMessage'
import Loader from '../../components/common/Loader'
import PageHeader from '../../components/common/PageHeader'
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import { routes } from '../../constants/routes'
import type {
  LiveActiveSession,
  RecentSessionAlert,
  RecentSessionEvent,
} from '../../types/live'
import { formatDate, formatDateTime, formatTimeRange, getErrorMessage } from '../../utils/format'

const LIVE_POLL_INTERVAL = 5000

const getLiveSessionLabel = (session: LiveActiveSession) =>
  session.title?.trim() || `Session ${session.id.slice(0, 8)}`

function LiveMonitoringPage() {
  const [selectedSessionId, setSelectedSessionId] = useState('')

  const activeSessionsQuery = useQuery({
    queryKey: ['live', 'active-sessions'],
    queryFn: () => liveApi.getActiveSessions({ limit: 10 }),
    refetchInterval: LIVE_POLL_INTERVAL,
    refetchIntervalInBackground: true,
  })

  const activeSessions = useMemo(
    () => activeSessionsQuery.data ?? [],
    [activeSessionsQuery.data],
  )
  const effectiveSelectedSessionId = useMemo(() => {
    if (!activeSessions.length) {
      return ''
    }

    return activeSessions.some((session) => session.id === selectedSessionId)
      ? selectedSessionId
      : activeSessions[0].id
  }, [activeSessions, selectedSessionId])

  const sessionOverviewQuery = useQuery({
    queryKey: ['live', 'session-overview', effectiveSelectedSessionId],
    enabled: !!effectiveSelectedSessionId,
    queryFn: () => liveApi.getSessionOverview(effectiveSelectedSessionId),
    refetchInterval: LIVE_POLL_INTERVAL,
    refetchIntervalInBackground: true,
  })

  const recentEventsQuery = useQuery({
    queryKey: ['live', 'recent-events', effectiveSelectedSessionId],
    enabled: !!effectiveSelectedSessionId,
    queryFn: () => liveApi.getRecentSessionEvents(effectiveSelectedSessionId, { limit: 12 }),
    refetchInterval: LIVE_POLL_INTERVAL,
    refetchIntervalInBackground: true,
  })

  const recentAlertsQuery = useQuery({
    queryKey: ['live', 'recent-alerts', effectiveSelectedSessionId],
    enabled: !!effectiveSelectedSessionId,
    queryFn: () => liveApi.getRecentSessionAlerts(effectiveSelectedSessionId, { limit: 12 }),
    refetchInterval: LIVE_POLL_INTERVAL,
    refetchIntervalInBackground: true,
  })

  const totalActiveEvents = activeSessions.reduce(
    (sum, session) => sum + session.liveCounters.totalEvents,
    0,
  )
  const totalActiveAlerts = activeSessions.reduce(
    (sum, session) => sum + session.liveCounters.unknownFaceAlerts,
    0,
  )
  const totalActiveRecords = activeSessions.reduce(
    (sum, session) => sum + session.liveCounters.attendanceRecords,
    0,
  )

  const eventFeed = recentEventsQuery.data ?? []
  const alertFeed = recentAlertsQuery.data ?? []
  const sessionOverview = sessionOverviewQuery.data ?? null

  const lastEventAt = sessionOverview?.eventSummary.lastEventAt ?? null
  const lastAlertAt = sessionOverview?.alertSummary.lastAlertAt ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'Live Monitoring' },
        ]}
        eyebrow="Live"
        title="Live Monitoring"
        description="Polling-based classroom monitoring for active sessions, recent attendance events, and unknown-face alerts."
      />

      {activeSessionsQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(
            activeSessionsQuery.error,
            'Unable to load active sessions.',
          )}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Sessions"
          value={String(activeSessions.length)}
          hint="Polled every few seconds"
          icon={MonitorPlay}
        />
        <StatCard
          label="Live Events"
          value={String(totalActiveEvents)}
          hint="Across active sessions"
          icon={Radar}
          accent="emerald"
        />
        <StatCard
          label="Unknown Alerts"
          value={String(totalActiveAlerts)}
          hint="Pending review signals"
          icon={AlertTriangle}
          accent="amber"
        />
        <StatCard
          label="Attendance Records"
          value={String(totalActiveRecords)}
          hint="Current live record count"
          icon={Users}
        />
      </div>

      {!activeSessions.length && !activeSessionsQuery.isLoading ? (
        <EmptyState
          title="No active sessions right now."
          description="Start a classroom session to populate the live monitoring view."
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <section className="app-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink-950">Active sessions</h2>
                <p className="mt-1 text-sm text-ink-500">
                  Select a session to inspect its live feed.
                </p>
              </div>
              {activeSessionsQuery.isLoading ? <Loader label="Refreshing..." /> : null}
            </div>

            <div className="mt-5 space-y-3">
              {activeSessions.map((session) => {
                const isSelected = session.id === selectedSessionId

                return (
                  <button
                    key={session.id}
                    type="button"
                  onClick={() => setSelectedSessionId(session.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                      isSelected
                        ? 'border-brand-200 bg-brand-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-brand-100 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold text-ink-950">
                          {getLiveSessionLabel(session)}
                        </p>
                        <p className="text-xs text-ink-500">
                          {formatDate(session.scheduledDate)} •{' '}
                          {formatTimeRange(
                            session.scheduledStartTime,
                            session.scheduledEndTime,
                          )}
                        </p>
                      </div>
                      <StatusBadge
                        label={session.status}
                        tone="brand"
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-slate-50 px-2 py-2">
                        <p className="text-xs text-ink-500">Events</p>
                        <p className="mt-1 text-sm font-semibold text-ink-950">
                          {session.liveCounters.totalEvents}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-2 py-2">
                        <p className="text-xs text-ink-500">Alerts</p>
                        <p className="mt-1 text-sm font-semibold text-ink-950">
                          {session.liveCounters.unknownFaceAlerts}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-2 py-2">
                        <p className="text-xs text-ink-500">Records</p>
                        <p className="mt-1 text-sm font-semibold text-ink-950">
                          {session.liveCounters.attendanceRecords}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          <div className="space-y-6">
            {!effectiveSelectedSessionId ? (
              <EmptyState
                title="Choose an active session."
                description="Session overview, events, and alerts will appear here."
              />
            ) : sessionOverviewQuery.isLoading && !sessionOverview ? (
              <div className="app-surface p-6">
                <Loader label="Loading live session overview..." />
              </div>
            ) : sessionOverviewQuery.isError ? (
              <ErrorMessage
                message={getErrorMessage(
                  sessionOverviewQuery.error,
                  'Unable to load the selected live session.',
                )}
              />
            ) : sessionOverview ? (
              <>
                <section className="app-surface p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge label={sessionOverview.session.status} tone="brand" />
                        <StatusBadge label="Polling live" tone="success" />
                      </div>
                      <h2 className="text-2xl font-semibold text-ink-950">
                        {sessionOverview.session.title?.trim() ||
                          `Session ${sessionOverview.session.id.slice(0, 8)}`}
                      </h2>
                      <p className="text-sm text-ink-600">
                        {formatDate(sessionOverview.session.scheduledDate)} •{' '}
                        {formatTimeRange(
                          sessionOverview.session.scheduledStartTime,
                          sessionOverview.session.scheduledEndTime,
                        )}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                          Last event
                        </p>
                        <p className="mt-2 text-sm font-medium text-ink-950">
                          {formatDateTime(lastEventAt)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                          Last alert
                        </p>
                        <p className="mt-2 text-sm font-medium text-ink-950">
                          {formatDateTime(lastAlertAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                      label="Total Events"
                      value={String(sessionOverview.eventSummary.totalEvents)}
                      hint={`${sessionOverview.eventSummary.recognizedEvents} recognized`}
                      icon={Activity}
                    />
                    <StatCard
                      label="Unknown Events"
                      value={String(sessionOverview.eventSummary.unknownEvents)}
                      hint="Unrecognized detections"
                      icon={AlertTriangle}
                      accent="amber"
                    />
                    <StatCard
                      label="Unknown Alerts"
                      value={String(sessionOverview.alertSummary.totalAlerts)}
                      hint={`${sessionOverview.alertSummary.pendingAlerts} pending`}
                      icon={Camera}
                    />
                    <StatCard
                      label="Attendance Records"
                      value={String(sessionOverview.attendanceSummary.totalRecords)}
                      hint={`${sessionOverview.attendanceSummary.presentCount} present • ${sessionOverview.attendanceSummary.lateCount} late`}
                      icon={Users}
                      accent="emerald"
                    />
                  </div>
                </section>

                <SystemCameraPanel sessionId={effectiveSelectedSessionId} />

                <div className="grid gap-6 xl:grid-cols-2">
                  <section className="app-surface p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-ink-950">Recent attendance events</h2>
                        <p className="mt-1 text-sm text-ink-500">
                          The latest recognized and unknown observations.
                        </p>
                      </div>
                      {recentEventsQuery.isFetching ? <Loader label="Updating..." /> : null}
                    </div>

                    {recentEventsQuery.isError ? (
                      <div className="mt-5">
                        <ErrorMessage
                          message={getErrorMessage(
                            recentEventsQuery.error,
                            'Unable to load recent events.',
                          )}
                        />
                      </div>
                    ) : eventFeed.length === 0 ? (
                      <div className="mt-5">
                        <EmptyState
                          title="No recent events."
                          description="New recognition events will stream into this panel as the session progresses."
                        />
                      </div>
                    ) : (
                      <div className="mt-5 max-h-[560px] space-y-3 overflow-y-auto pr-1">
                        {eventFeed.map((event) => (
                          <LiveEventCard key={event.eventId} event={event} />
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="app-surface p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-ink-950">Recent unknown alerts</h2>
                        <p className="mt-1 text-sm text-ink-500">
                          The most recent alert feed for the selected session.
                        </p>
                      </div>
                      {recentAlertsQuery.isFetching ? <Loader label="Updating..." /> : null}
                    </div>

                    {recentAlertsQuery.isError ? (
                      <div className="mt-5">
                        <ErrorMessage
                          message={getErrorMessage(
                            recentAlertsQuery.error,
                            'Unable to load recent unknown alerts.',
                          )}
                        />
                      </div>
                    ) : alertFeed.length === 0 ? (
                      <div className="mt-5">
                        <EmptyState
                          title="No recent alerts."
                          description="Unknown-face alerts will appear here if the system detects unrecognized attendees."
                        />
                      </div>
                    ) : (
                      <div className="mt-5 max-h-[560px] space-y-3 overflow-y-auto pr-1">
                        {alertFeed.map((alert) => (
                          <LiveAlertCard key={alert.id} alert={alert} />
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function SystemCameraPanel({ sessionId }: { sessionId: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    if (!cameraEnabled) {
      return
    }

    let mounted = true

    const openCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        setCameraError(null)
      } catch {
        setCameraEnabled(false)
        setCameraError('Camera permission denied or no system camera found.')
      }
    }

    void openCamera()

    return () => {
      mounted = false
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }, [cameraEnabled, sessionId])

  return (
    <section className="app-surface p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink-950">System camera</h2>
          <p className="mt-1 text-sm text-ink-500">
            Local camera preview for the selected live session.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCameraError(null)
            setCameraEnabled((value) => !value)
          }}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-ink-950 px-4 text-sm font-medium text-white transition hover:bg-ink-800"
        >
          <Camera className="h-4 w-4" />
          {cameraEnabled ? 'Stop camera' : 'Start camera'}
        </button>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
        {cameraEnabled ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center px-4 text-center text-sm text-white/70">
            Camera is off.
          </div>
        )}
      </div>

      {cameraError ? (
        <div className="mt-4">
          <ErrorMessage message={cameraError} />
        </div>
      ) : null}
    </section>
  )
}

function LiveEventCard({ event }: { event: RecentSessionEvent }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-semibold text-ink-950">
            {event.isUnknown
              ? 'Unknown attendee'
              : event.fullName || event.rollNumber || 'Recognized attendee'}
          </p>
          <p className="text-xs text-ink-500">
            {event.rollNumber || event.studentId || 'No student identifier'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatusBadge
            label={event.isUnknown ? 'Unknown' : 'Recognized'}
            tone={event.isUnknown ? 'warning' : 'success'}
          />
          <StatusBadge
            label={event.processed ? 'Processed' : 'Pending'}
            tone={event.processed ? 'brand' : 'neutral'}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
            Camera
          </p>
          <p className="mt-1 text-sm text-ink-900">{event.cameraId}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
            Confidence
          </p>
          <p className="mt-1 text-sm text-ink-900">{event.confidence.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
            Timestamp
          </p>
          <p className="mt-1 text-sm text-ink-900">
            {formatDateTime(event.eventTimestamp)}
          </p>
        </div>
      </div>
    </article>
  )
}

function LiveAlertCard({ alert }: { alert: RecentSessionAlert }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-semibold text-ink-950">Unknown face alert</p>
          <p className="text-xs text-ink-500">{formatDateTime(alert.detectedAt)}</p>
        </div>
        <StatusBadge
          label={alert.reviewed ? 'Reviewed' : 'Unreviewed'}
          tone={alert.reviewed ? 'success' : 'warning'}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
            Camera
          </p>
          <p className="mt-1 text-sm text-ink-900">{alert.cameraId}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
            Confidence
          </p>
          <p className="mt-1 text-sm text-ink-900">{alert.confidence.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
            Snapshot
          </p>
          <p className="mt-1 text-sm text-ink-900">
            {alert.snapshotRef ? 'Available' : 'Not captured'}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-ink-600">
        {alert.notes?.trim() || 'No review notes attached yet.'}
      </p>
    </article>
  )
}

export default LiveMonitoringPage
