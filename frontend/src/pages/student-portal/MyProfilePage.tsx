import { useQuery } from '@tanstack/react-query'
import { Camera, GraduationCap, Mail, Phone, UserCircle2 } from 'lucide-react'

import { studentPortalApi } from '../../api/studentPortal.api'
import AttendanceProgress from '../../components/common/AttendanceProgress'
import ErrorMessage from '../../components/common/ErrorMessage'
import Loader from '../../components/common/Loader'
import PageHeader from '../../components/common/PageHeader'
import StatusBadge from '../../components/common/StatusBadge'
import { routes } from '../../constants/routes'
import { formatDateTime, getErrorMessage, getInitials } from '../../utils/format'

function MyProfilePage() {
  const profileQuery = useQuery({
    queryKey: ['student-portal', 'me', 'profile'],
    queryFn: () => studentPortalApi.getMe(),
  })

  if (profileQuery.isLoading) {
    return (
      <div className="app-surface p-6">
        <Loader label="Loading your profile..." />
      </div>
    )
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <ErrorMessage
        message={getErrorMessage(profileQuery.error, 'Unable to load your profile.')}
      />
    )
  }

  const profile = profileQuery.data
  const overview = profile.attendanceOverview
  const faceRegistrationLabel =
    profile.faceProfile?.registrationStatus ?? 'Not registered'

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'My Profile' },
        ]}
        eyebrow="Student Portal"
        title="My Profile"
        description="Your linked account, student record, and academic context."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="app-surface p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-50 text-2xl font-semibold text-brand-700 ring-1 ring-brand-100">
              {getInitials(profile.user.fullName)}
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-ink-950">
                {profile.user.fullName}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  label={profile.student.status === 'active' ? 'Active Student' : 'Inactive'}
                  tone={profile.student.status === 'active' ? 'success' : 'warning'}
                />
                <StatusBadge label={profile.user.role} tone="brand" />
              </div>
              <p className="text-sm text-ink-500">
                Roll number: {profile.student.rollNumber}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-3 text-ink-800">
                <Mail className="h-4 w-4 text-brand-600" />
                <p className="text-sm font-medium">Email</p>
              </div>
              <p className="mt-3 text-sm text-ink-950">{profile.user.email}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-3 text-ink-800">
                <Phone className="h-4 w-4 text-brand-600" />
                <p className="text-sm font-medium">Phone</p>
              </div>
              <p className="mt-3 text-sm text-ink-950">
                {profile.student.phone || 'No phone on file'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-3 text-ink-800">
                <UserCircle2 className="h-4 w-4 text-brand-600" />
                <p className="text-sm font-medium">Gender</p>
              </div>
              <p className="mt-3 text-sm capitalize text-ink-950">
                {profile.student.gender ?? 'Not specified'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-3 text-ink-800">
                <Camera className="h-4 w-4 text-brand-600" />
                <p className="text-sm font-medium">Face Registration</p>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <StatusBadge
                  label={faceRegistrationLabel}
                  tone={profile.faceProfile ? 'success' : 'warning'}
                />
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <section className="app-surface p-6">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-5 w-5 text-brand-600" />
              <div>
                <h2 className="text-lg font-semibold text-ink-950">Academic information</h2>
                <p className="text-sm text-ink-500">
                  Your linked class group and study context.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                  Class group
                </p>
                <p className="mt-2 text-sm font-medium text-ink-950">
                  {profile.classGroup
                    ? `${profile.classGroup.code} • ${profile.classGroup.name}`
                    : 'Not linked'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                  Department
                </p>
                <p className="mt-2 text-sm font-medium text-ink-950">
                  {profile.classGroup?.department ?? 'Not available'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                  Semester and section
                </p>
                <p className="mt-2 text-sm font-medium text-ink-950">
                  {profile.classGroup
                    ? `Semester ${profile.classGroup.semester} • Section ${profile.classGroup.section}`
                    : 'Not available'}
                </p>
              </div>
            </div>
          </section>

          <section className="app-surface p-6">
            <h2 className="text-lg font-semibold text-ink-950">Attendance snapshot</h2>
            <p className="mt-1 text-sm text-ink-500">
              Your current attendance position at a glance.
            </p>

            <div className="mt-6 space-y-5">
              <AttendanceProgress
                label="Overall attendance"
                percentage={overview.attendancePercentage}
                tone={overview.lowAttendanceStatus.isLowAttendance ? 'warning' : 'success'}
                hint={`${overview.attendedSessions}/${overview.totalSessions} sessions attended`}
              />

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                  Threshold status
                </p>
                <p className="mt-2 text-sm font-medium text-ink-950">
                  {overview.lowAttendanceStatus.isLowAttendance
                    ? `Below ${overview.lowAttendanceStatus.threshold}% threshold`
                    : 'Attendance is above the warning threshold'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                  Face profile updated
                </p>
                <p className="mt-2 text-sm font-medium text-ink-950">
                  {profile.faceProfile?.lastUpdatedAt
                    ? formatDateTime(profile.faceProfile.lastUpdatedAt)
                    : 'No face profile update available'}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default MyProfilePage
