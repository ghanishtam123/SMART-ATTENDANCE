import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Camera, CheckCheck, ShieldAlert } from 'lucide-react'
import { useMemo, useState } from 'react'

import { alertsApi } from '../../api/alerts.api'
import { sessionsApi } from '../../api/sessions.api'
import ErrorMessage from '../../components/common/ErrorMessage'
import Loader from '../../components/common/Loader'
import PageHeader from '../../components/common/PageHeader'
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import SelectField from '../../components/forms/SelectField'
import DataTable, { type DataTableColumn } from '../../components/tables/DataTable'
import { routes } from '../../constants/routes'
import type { UnknownFaceAlert } from '../../types/alert'
import { formatDateTime, formatDate, getErrorMessage } from '../../utils/format'

function AlertsPage() {
  const queryClient = useQueryClient()
  const [sessionFilter, setSessionFilter] = useState('')
  const [reviewedFilter, setReviewedFilter] = useState<'reviewed' | 'unreviewed' | ''>('')

  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'alerts-options'],
    queryFn: () => sessionsApi.listSessions({ page: 1, limit: 100 }),
  })

  const alertsQuery = useQuery({
    queryKey: ['alerts', 'unknown-faces', sessionFilter, reviewedFilter],
    queryFn: () =>
      alertsApi.listUnknownFaceAlerts({
        page: 1,
        limit: 100,
        sessionId: sessionFilter || undefined,
        reviewed:
          reviewedFilter === ''
            ? undefined
            : reviewedFilter === 'reviewed',
      }),
  })

  const markReviewedMutation = useMutation({
    mutationFn: (id: string) => alertsApi.markUnknownFaceAlertReviewed(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['alerts', 'unknown-faces'] })
    },
  })

  const sessionMap = useMemo(
    () =>
      new Map((sessionsQuery.data?.items ?? []).map((session) => [session.id, session])),
    [sessionsQuery.data?.items],
  )

  const sessionOptions = useMemo(
    () =>
      (sessionsQuery.data?.items ?? []).map((session) => ({
        value: session.id,
        label: `${formatDate(session.scheduledDate)} • ${
          session.title?.trim() || session.id.slice(0, 8)
        }`,
      })),
    [sessionsQuery.data?.items],
  )

  const alerts = alertsQuery.data?.items ?? []
  const totalAlerts = alertsQuery.data?.meta.totalItems ?? alerts.length
  const reviewedCount = alerts.filter((alert) => alert.reviewed).length
  const unreviewedCount = totalAlerts - reviewedCount
  const averageConfidence =
    alerts.length > 0
      ? alerts.reduce((sum, alert) => sum + alert.confidence, 0) / alerts.length
      : 0

  const columns = useMemo<DataTableColumn<UnknownFaceAlert>[]>(
    () => [
      {
        key: 'detectedAt',
        header: 'Detected At',
        render: (alert) => (
          <div className="space-y-1">
            <p className="font-semibold text-ink-950">{formatDateTime(alert.detectedAt)}</p>
            <p className="text-xs text-ink-500">{alert.id}</p>
          </div>
        ),
      },
      {
        key: 'session',
        header: 'Session',
        render: (alert) => {
          const session = sessionMap.get(alert.sessionId ?? '')

          return (
            <div className="space-y-1">
              <p className="text-ink-900">
                {session?.title?.trim() || session?.id || alert.sessionId || 'No session'}
              </p>
              <p className="text-xs text-ink-500">
                {session
                  ? `${formatDate(session.scheduledDate)}`
                  : 'Session details unavailable'}
              </p>
            </div>
          )
        },
      },
      {
        key: 'camera',
        header: 'Camera',
        render: (alert) => <span>{alert.cameraId}</span>,
      },
      {
        key: 'confidence',
        header: 'Confidence',
        render: (alert) => <span>{alert.confidence.toFixed(2)}</span>,
      },
      {
        key: 'status',
        header: 'Status',
        render: (alert) => (
          <StatusBadge
            label={alert.reviewed ? 'Reviewed' : 'Unreviewed'}
            tone={alert.reviewed ? 'success' : 'warning'}
          />
        ),
      },
      {
        key: 'notes',
        header: 'Notes',
        render: (alert) => (
          <span className="text-sm text-ink-600">
            {alert.notes?.trim() || 'No notes'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-36',
        headerClassName: 'text-right',
        render: (alert) => (
          <div className="flex justify-end">
            <button
              type="button"
              disabled={alert.reviewed || markReviewedMutation.isPending}
              onClick={() => {
                void markReviewedMutation.mutateAsync(alert.id)
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark reviewed
            </button>
          </div>
        ),
      },
    ],
    [markReviewedMutation, sessionMap],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'Alerts' },
        ]}
        eyebrow="Monitoring"
        title="Unknown Face Alerts"
        description="Track unrecognized face detections, review operational alerts, and clear them from the investigation queue."
      />

      {sessionsQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(sessionsQuery.error, 'Unable to load session options.')}
        />
      ) : null}

      {markReviewedMutation.isError ? (
        <ErrorMessage
          message={getErrorMessage(
            markReviewedMutation.error,
            'Unable to mark the alert as reviewed.',
          )}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Alerts"
          value={String(totalAlerts)}
          hint="Current result set"
          icon={AlertTriangle}
        />
        <StatCard
          label="Unreviewed"
          value={String(unreviewedCount)}
          hint="Needs investigation"
          icon={ShieldAlert}
          accent="amber"
        />
        <StatCard
          label="Reviewed"
          value={String(reviewedCount)}
          hint="Already acknowledged"
          icon={CheckCheck}
          accent="emerald"
        />
        <StatCard
          label="Avg Confidence"
          value={alerts.length ? averageConfidence.toFixed(2) : '0.00'}
          hint="Recognition confidence"
          icon={Camera}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <SelectField
          label="Session"
          value={sessionFilter}
          options={sessionOptions}
          placeholder="All sessions"
          onChange={(event) => setSessionFilter(event.target.value)}
        />
        <SelectField
          label="Review Status"
          value={reviewedFilter}
          options={[
            { value: '', label: 'All alerts' },
            { value: 'unreviewed', label: 'Unreviewed' },
            { value: 'reviewed', label: 'Reviewed' },
          ]}
          onChange={(event) =>
            setReviewedFilter(event.target.value as 'reviewed' | 'unreviewed' | '')
          }
        />
      </div>

      {alertsQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(alertsQuery.error, 'Unable to load alerts.')}
        />
      ) : alertsQuery.isLoading ? (
        <div className="app-surface p-6">
          <Loader label="Loading alerts..." />
        </div>
      ) : (
        <DataTable
          data={alerts}
          columns={columns}
          getRowKey={(alert) => alert.id}
          emptyTitle="No unknown face alerts found."
          emptyDescription="Try another session or review-status filter."
        />
      )}
    </div>
  )
}

export default AlertsPage
