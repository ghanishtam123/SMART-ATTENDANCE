import { useQuery } from '@tanstack/react-query'
import { BookOpen, ClipboardList, ShieldAlert, Users } from 'lucide-react'
import { useMemo, useState } from 'react'

import { studentPortalApi } from '../../api/studentPortal.api'
import AttendanceProgress from '../../components/common/AttendanceProgress'
import EmptyState from '../../components/common/EmptyState'
import ErrorMessage from '../../components/common/ErrorMessage'
import Loader from '../../components/common/Loader'
import PageHeader from '../../components/common/PageHeader'
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import InputField from '../../components/forms/InputField'
import DataTable, { type DataTableColumn } from '../../components/tables/DataTable'
import { routes } from '../../constants/routes'
import type { StudentSubjectAttendanceItem } from '../../types/studentPortal'
import { getErrorMessage } from '../../utils/format'

function MySubjectsPage() {
  const [threshold, setThreshold] = useState('75')

  const subjectsQuery = useQuery({
    queryKey: ['student-portal', 'subjects', threshold],
    queryFn: () =>
      studentPortalApi.getSubjects({
        page: 1,
        limit: 100,
        threshold: threshold ? Number(threshold) : undefined,
      }),
  })

  const subjects = useMemo(
    () => subjectsQuery.data?.items ?? [],
    [subjectsQuery.data?.items],
  )
  const subjectCount = subjectsQuery.data?.meta.totalItems ?? subjects.length

  const summary = useMemo(() => {
    if (!subjects.length) {
      return {
        averageAttendance: 0,
        lowAttendanceCount: 0,
        totalSessions: 0,
      }
    }

    const totalAttendance = subjects.reduce(
      (sum, item) => sum + item.attendancePercentage,
      0,
    )
    const totalSessions = subjects.reduce((sum, item) => sum + item.totalSessions, 0)

    return {
      averageAttendance: totalAttendance / subjects.length,
      lowAttendanceCount: subjects.filter((item) => item.lowAttendanceStatus.isLowAttendance)
        .length,
      totalSessions,
    }
  }, [subjects])

  const columns = useMemo<DataTableColumn<StudentSubjectAttendanceItem>[]>(
    () => [
      {
        key: 'subject',
        header: 'Subject',
        render: (item) => (
          <div className="space-y-1">
            <p className="font-semibold text-ink-950">
              {item.subject.code ?? 'SUB'} • {item.subject.name ?? 'Untitled subject'}
            </p>
            <p className="text-xs text-ink-500">
              {item.subject.creditHours ? `${item.subject.creditHours} credit hours` : 'Credit hours not set'}
            </p>
          </div>
        ),
      },
      {
        key: 'attendance',
        header: 'Attendance',
        render: (item) => (
          <div className="space-y-1">
            <p>{item.attendancePercentage.toFixed(1)}%</p>
            <p className="text-xs text-ink-500">
              {item.attendedSessions}/{item.totalSessions} attended
            </p>
          </div>
        ),
      },
      {
        key: 'breakdown',
        header: 'Breakdown',
        render: (item) => (
          <div className="space-y-1 text-sm text-ink-600">
            <p>{item.presentCount} present</p>
            <p>{item.absentCount} absent</p>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (item) => (
          <StatusBadge
            label={
              item.lowAttendanceStatus.isLowAttendance ? 'Needs attention' : 'On track'
            }
            tone={item.lowAttendanceStatus.isLowAttendance ? 'warning' : 'success'}
          />
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'My Subjects' },
        ]}
        eyebrow="Student Portal"
        title="My Subjects"
        description="See your attendance percentage across subjects and identify areas that need improvement."
      />

      <div className="max-w-xs">
        <InputField
          label="Warning threshold"
          type="number"
          min={1}
          max={100}
          value={threshold}
          onChange={(event) => setThreshold(event.target.value)}
        />
      </div>

      {subjectsQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(subjectsQuery.error, 'Unable to load your subjects.')}
        />
      ) : subjectsQuery.isLoading ? (
        <div className="app-surface p-6">
          <Loader label="Loading your subject attendance..." />
        </div>
      ) : subjects.length === 0 ? (
        <EmptyState
          title="No subject attendance data found."
          description="Subject-level attendance will appear here after session attendance is processed."
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Subjects"
              value={String(subjectCount)}
              hint="Tracked in your portal"
              icon={BookOpen}
            />
            <StatCard
              label="Average Attendance"
              value={`${summary.averageAttendance.toFixed(1)}%`}
              hint="Across all subjects"
              icon={ClipboardList}
              accent="emerald"
            />
            <StatCard
              label="Low Attendance Subjects"
              value={String(summary.lowAttendanceCount)}
              hint={`Using ${threshold}% threshold`}
              icon={ShieldAlert}
              accent="amber"
            />
            <StatCard
              label="Total Sessions"
              value={String(summary.totalSessions)}
              hint="Across all subject summaries"
              icon={Users}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {subjects.map((item) => (
              <article key={item.subjectId} className="app-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-ink-950">
                      {item.subject.code ?? 'SUB'} • {item.subject.name ?? 'Untitled subject'}
                    </h2>
                    <p className="text-sm text-ink-500">
                      {item.attendedSessions}/{item.totalSessions} sessions attended
                    </p>
                  </div>
                  <StatusBadge
                    label={
                      item.lowAttendanceStatus.isLowAttendance ? 'Attention' : 'Good'
                    }
                    tone={item.lowAttendanceStatus.isLowAttendance ? 'warning' : 'success'}
                  />
                </div>

                <div className="mt-5">
                  <AttendanceProgress
                    label="Attendance"
                    percentage={item.attendancePercentage}
                    tone={item.lowAttendanceStatus.isLowAttendance ? 'warning' : 'brand'}
                    hint={`${item.presentCount} present • ${item.lateCount} late • ${item.absentCount} absent`}
                  />
                </div>

                <p className="mt-4 text-sm leading-6 text-ink-500">
                  {item.subject.description ?? 'No subject description available.'}
                </p>
              </article>
            ))}
          </div>

          <DataTable
            data={subjects}
            columns={columns}
            getRowKey={(item) => item.subjectId}
            emptyTitle="No subject summaries found."
            emptyDescription="Try another threshold value."
          />
        </>
      )}
    </div>
  )
}

export default MySubjectsPage
