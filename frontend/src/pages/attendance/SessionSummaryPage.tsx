import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ClipboardList,
  Layers3,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { attendanceApi } from '../../api/attendance.api'
import { classGroupsApi } from '../../api/classGroups.api'
import AttendanceStatusBadge from '../../components/common/AttendanceStatusBadge'
import EmptyState from '../../components/common/EmptyState'
import ErrorMessage from '../../components/common/ErrorMessage'
import Loader from '../../components/common/Loader'
import PageHeader from '../../components/common/PageHeader'
import StatCard from '../../components/common/StatCard'
import InputField from '../../components/forms/InputField'
import SelectField from '../../components/forms/SelectField'
import { routes } from '../../constants/routes'
import { formatDate, getErrorMessage } from '../../utils/format'

function SessionSummaryPage() {
  const [classGroupId, setClassGroupId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const classGroupsQuery = useQuery({
    queryKey: ['class-groups', 'attendance-summary-options'],
    queryFn: () => classGroupsApi.listClassGroups({ page: 1, limit: 100 }),
  })

  const summaryQuery = useQuery({
    queryKey: ['attendance', 'class-group-summary', classGroupId, fromDate, toDate],
    enabled: !!classGroupId,
    queryFn: () =>
      attendanceApi.getClassGroupAttendanceSummary(classGroupId, {
        from: fromDate || undefined,
        to: toDate || undefined,
      }),
  })

  const classGroupOptions = useMemo(
    () =>
      (classGroupsQuery.data?.items ?? []).map((group) => ({
        value: group.id,
        label: `${group.code} • ${group.name}`,
      })),
    [classGroupsQuery.data?.items],
  )
  const classGroupSummary = summaryQuery.data ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'Session Summary' },
        ]}
        eyebrow="Attendance"
        title="Class Group Attendance Summary"
        description="Review aggregate attendance performance across sessions for a selected class group."
      />

      {classGroupsQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(
            classGroupsQuery.error,
            'Unable to load class group options.',
          )}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
        <SelectField
          label="Class group"
          value={classGroupId}
          options={classGroupOptions}
          placeholder="Select class group"
          onChange={(event) => setClassGroupId(event.target.value)}
        />
        <InputField
          label="From"
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
        />
        <InputField
          label="To"
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
        />
      </div>

      {!classGroupId ? (
        <EmptyState
          title="Select a class group to view the summary."
          description="Choose a class group and optional date range to load overall attendance performance, status counts, and alert totals."
        />
      ) : summaryQuery.isLoading ? (
        <div className="app-surface p-6">
          <Loader label="Loading class-group summary..." />
        </div>
      ) : summaryQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(
            summaryQuery.error,
            'Unable to load class-group attendance summary.',
          )}
        />
      ) : !classGroupSummary ? (
        <ErrorMessage message="Summary data is unavailable for the selected class group." />
      ) : (
        <>
          <div className="app-surface p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-ink-500">Summary scope</p>
                <h2 className="text-xl font-semibold text-ink-950">
                  {classGroupSummary.classGroup.code} • {classGroupSummary.classGroup.name}
                </h2>
                <p className="text-sm text-ink-600">
                  {classGroupSummary.classGroup.department} • Semester{' '}
                  {classGroupSummary.classGroup.semester} • Section{' '}
                  {classGroupSummary.classGroup.section}
                </p>
              </div>
              <div className="space-y-1 text-sm text-ink-600">
                <p>
                  From: {classGroupSummary.from ? formatDate(classGroupSummary.from) : 'All time'}
                </p>
                <p>
                  To: {classGroupSummary.to ? formatDate(classGroupSummary.to) : 'Now'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Attendance Rate"
              value={`${classGroupSummary.attendancePercentage.toFixed(1)}%`}
              hint={`${classGroupSummary.recordsGenerated} records across ${classGroupSummary.totalSessions} sessions`}
              icon={ClipboardList}
            />
            <StatCard
              label="Sessions"
              value={String(classGroupSummary.totalSessions)}
              hint={`${classGroupSummary.totalStudents} students in scope`}
              icon={Layers3}
              accent="amber"
            />
            <StatCard
              label="Present / Absent"
              value={`${classGroupSummary.presentCount}/${classGroupSummary.absentCount}`}
              hint={`${classGroupSummary.lateCount} late • ${classGroupSummary.leftEarlyCount} left early`}
              icon={Users}
              accent="emerald"
            />
            <StatCard
              label="Unknown Face Alerts"
              value={String(classGroupSummary.unknownFaceAlertCount)}
              hint="Recognition alerts within the selected summary window"
              icon={AlertTriangle}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <section className="app-surface p-6">
              <h2 className="text-lg font-semibold text-ink-950">Status breakdown</h2>
              <p className="mt-1 text-sm text-ink-500">
                Final attendance outcomes aggregated across the selected sessions.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-3">
                    <AttendanceStatusBadge status="present" />
                    <span className="text-2xl font-semibold text-ink-950">
                      {classGroupSummary.presentCount}
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-3">
                    <AttendanceStatusBadge status="late" />
                    <span className="text-2xl font-semibold text-ink-950">
                      {classGroupSummary.lateCount}
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-3">
                    <AttendanceStatusBadge status="absent" />
                    <span className="text-2xl font-semibold text-ink-950">
                      {classGroupSummary.absentCount}
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-3">
                    <AttendanceStatusBadge status="left_early" />
                    <span className="text-2xl font-semibold text-ink-950">
                      {classGroupSummary.leftEarlyCount}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="app-surface p-6">
              <h2 className="text-lg font-semibold text-ink-950">Summary details</h2>
              <p className="mt-1 text-sm text-ink-500">
                High-level context for the selected attendance window.
              </p>

              <dl className="mt-6 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                    Academic year
                  </dt>
                  <dd className="mt-2 text-sm text-ink-900">
                    {classGroupSummary.classGroup.academicYear}
                  </dd>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                    Total students
                  </dt>
                  <dd className="mt-2 text-sm text-ink-900">
                    {classGroupSummary.totalStudents}
                  </dd>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                    Records generated
                  </dt>
                  <dd className="mt-2 text-sm text-ink-900">
                    {classGroupSummary.recordsGenerated}
                  </dd>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                    Unknown face alerts
                  </dt>
                  <dd className="mt-2 text-sm text-ink-900">
                    {classGroupSummary.unknownFaceAlertCount}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </>
      )}
    </div>
  )
}

export default SessionSummaryPage
