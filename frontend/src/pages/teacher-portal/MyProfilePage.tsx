import { useQuery } from '@tanstack/react-query'
import { BriefcaseBusiness, Mail, Presentation, UserCircle2 } from 'lucide-react'

import { classGroupsApi } from '../../api/classGroups.api'
import { subjectsApi } from '../../api/subjects.api'
import { teachersApi } from '../../api/teachers.api'
import ErrorMessage from '../../components/common/ErrorMessage'
import Loader from '../../components/common/Loader'
import PageHeader from '../../components/common/PageHeader'
import StatusBadge from '../../components/common/StatusBadge'
import { routes } from '../../constants/routes'
import { useAuth } from '../../hooks/useAuth'
import { getErrorMessage, getInitials } from '../../utils/format'

function TeacherMyProfilePage() {
  const { currentUser } = useAuth()

  const teacherProfileQuery = useQuery({
    queryKey: ['teacher-portal', 'me', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) {
        return null
      }

      const result = await teachersApi.listTeachers({
        page: 1,
        limit: 1,
        userId: currentUser.id,
      })

      return result.items[0] ?? null
    },
    enabled: !!currentUser,
  })

  const subjectsQuery = useQuery({
    queryKey: ['teacher-portal', 'subjects'],
    queryFn: () => subjectsApi.listSubjects({ page: 1, limit: 100 }),
  })

  const classGroupsQuery = useQuery({
    queryKey: ['teacher-portal', 'class-groups'],
    queryFn: () => classGroupsApi.listClassGroups({ page: 1, limit: 100 }),
  })

  if (!currentUser || teacherProfileQuery.isLoading || subjectsQuery.isLoading || classGroupsQuery.isLoading) {
    return (
      <div className="app-surface p-6">
        <Loader label="Loading your profile..." />
      </div>
    )
  }

  if (teacherProfileQuery.isError || subjectsQuery.isError || classGroupsQuery.isError) {
    return (
      <ErrorMessage
        message={
          getErrorMessage(teacherProfileQuery.error, '') ||
          getErrorMessage(subjectsQuery.error, '') ||
          getErrorMessage(classGroupsQuery.error, 'Unable to load your teacher profile.')
        }
      />
    )
  }

  const teacherProfile = teacherProfileQuery.data

  if (!teacherProfile) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: 'Dashboard', href: routes.dashboard },
            { label: 'My Profile' },
          ]}
          eyebrow="Teacher Portal"
          title="My Profile"
          description="Your account is active, but no teacher profile is currently linked."
        />
        <ErrorMessage message="No teacher profile is linked to this account yet." />
      </div>
    )
  }

  const subjectMap = new Map(
    (subjectsQuery.data?.items ?? []).map((subject) => [subject.id, subject] as const),
  )
  const classGroupMap = new Map(
    (classGroupsQuery.data?.items ?? []).map((group) => [group.id, group] as const),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'My Profile' },
        ]}
        eyebrow="Teacher Portal"
        title="My Profile"
        description="Your linked account identity and teaching assignments."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="app-surface p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-50 text-2xl font-semibold text-brand-700 ring-1 ring-brand-100">
              {getInitials(currentUser.fullName)}
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-ink-950">{currentUser.fullName}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label="Teacher" tone="brand" />
                <StatusBadge
                  label={currentUser.isActive ? 'Active Account' : 'Inactive Account'}
                  tone={currentUser.isActive ? 'success' : 'warning'}
                />
              </div>
              <p className="text-sm text-ink-500">
                Employee ID: {teacherProfile.employeeId}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-3 text-ink-800">
                <Mail className="h-4 w-4 text-brand-600" />
                <p className="text-sm font-medium">Email</p>
              </div>
              <p className="mt-3 text-sm text-ink-950">{currentUser.email}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-3 text-ink-800">
                <BriefcaseBusiness className="h-4 w-4 text-brand-600" />
                <p className="text-sm font-medium">Department</p>
              </div>
              <p className="mt-3 text-sm text-ink-950">{teacherProfile.department}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-3 text-ink-800">
                <UserCircle2 className="h-4 w-4 text-brand-600" />
                <p className="text-sm font-medium">Designation</p>
              </div>
              <p className="mt-3 text-sm text-ink-950">{teacherProfile.designation}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-3 text-ink-800">
                <Presentation className="h-4 w-4 text-brand-600" />
                <p className="text-sm font-medium">Assignments</p>
              </div>
              <p className="mt-3 text-sm text-ink-950">
                {teacherProfile.subjectsTaught.length} subjects • {teacherProfile.assignedClassGroups.length} class groups
              </p>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <section className="app-surface p-6">
            <h2 className="text-lg font-semibold text-ink-950">Subjects</h2>
            <p className="mt-1 text-sm text-ink-500">
              Subjects currently linked to your teacher profile.
            </p>

            <div className="mt-5 space-y-3">
              {teacherProfile.subjectsTaught.length > 0 ? (
                teacherProfile.subjectsTaught.map((subjectId) => {
                  const subject = subjectMap.get(subjectId)

                  return (
                    <div
                      key={subjectId}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3"
                    >
                      <p className="text-sm font-medium text-ink-950">
                        {subject ? `${subject.code} • ${subject.name}` : subjectId}
                      </p>
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-ink-500">No subjects linked yet.</p>
              )}
            </div>
          </section>

          <section className="app-surface p-6">
            <h2 className="text-lg font-semibold text-ink-950">Assigned class groups</h2>
            <p className="mt-1 text-sm text-ink-500">
              Academic groups currently assigned to your profile.
            </p>

            <div className="mt-5 space-y-3">
              {teacherProfile.assignedClassGroups.length > 0 ? (
                teacherProfile.assignedClassGroups.map((groupId) => {
                  const classGroup = classGroupMap.get(groupId)

                  return (
                    <div
                      key={groupId}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3"
                    >
                      <p className="text-sm font-medium text-ink-950">
                        {classGroup
                          ? `${classGroup.code} • ${classGroup.name}`
                          : groupId}
                      </p>
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-ink-500">No class groups linked yet.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default TeacherMyProfilePage
