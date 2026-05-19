import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, CheckCircle2, RefreshCcw, UserCheck } from 'lucide-react'
import { useMemo, useState } from 'react'

import { classGroupsApi } from '../../api/classGroups.api'
import { studentsApi } from '../../api/students.api'
import EmptyState from '../../components/common/EmptyState'
import ErrorMessage from '../../components/common/ErrorMessage'
import Loader from '../../components/common/Loader'
import PageHeader from '../../components/common/PageHeader'
import SearchInput from '../../components/common/SearchInput'
import StatusBadge from '../../components/common/StatusBadge'
import FaceRegistrationModal, {
  type FaceRegistrationImages,
} from '../../components/students/FaceRegistrationModal'
import { routes } from '../../constants/routes'
import useDebounce from '../../hooks/useDebounce'
import type { Student, StudentStatus } from '../../types/student'
import { getErrorMessage } from '../../utils/format'

function StudentFaceRegistrationPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [classGroupFilter, setClassGroupFilter] = useState('')
  const [faceStatusFilter, setFaceStatusFilter] = useState<'all' | 'registered' | 'missing'>(
    'missing',
  )
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search)

  const studentsQuery = useQuery({
    queryKey: ['students', 'face-registration', debouncedSearch, classGroupFilter],
    queryFn: () =>
      studentsApi.listStudents({
        page: 1,
        limit: 100,
        search: debouncedSearch || undefined,
        classGroupId: classGroupFilter || undefined,
        status: 'active' as StudentStatus,
      }),
  })

  const classGroupsQuery = useQuery({
    queryKey: ['class-groups', 'face-registration-options'],
    queryFn: () => classGroupsApi.listClassGroups({ page: 1, limit: 100 }),
  })

  const classGroupMap = useMemo(
    () =>
      new Map(
        (classGroupsQuery.data?.items ?? []).map((group) => [group.id, group] as const),
      ),
    [classGroupsQuery.data?.items],
  )

  const classGroupOptions = useMemo(
    () =>
      (classGroupsQuery.data?.items ?? []).map((group) => ({
        value: group.id,
        label: `${group.code} - ${group.name}`,
      })),
    [classGroupsQuery.data?.items],
  )

  const students = useMemo(() => {
    const items = studentsQuery.data?.items ?? []

    if (faceStatusFilter === 'registered') {
      return items.filter((student) => Boolean(student.faceProfileId))
    }

    if (faceStatusFilter === 'missing') {
      return items.filter((student) => !student.faceProfileId)
    }

    return items
  }, [faceStatusFilter, studentsQuery.data?.items])

  const registeredCount = (studentsQuery.data?.items ?? []).filter((student) =>
    Boolean(student.faceProfileId),
  ).length
  const missingCount = (studentsQuery.data?.items ?? []).length - registeredCount

  const faceRegistrationMutation = useMutation({
    mutationFn: async ({
      studentId,
      images,
    }: {
      studentId: string
      images: FaceRegistrationImages
    }) => studentsApi.uploadFaceImages(studentId, images),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['students'] }),
        queryClient.invalidateQueries({ queryKey: ['face-profiles'] }),
      ])
      setSuccessMessage('Face registration saved. Run AI encoding before monitoring.')
      setSelectedStudent(null)
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: routes.dashboard },
          { label: 'Face Registration' },
        ]}
        eyebrow="Recognition"
        title="Student Face Registration"
        description="Capture center, left, and right face images so the AI camera can identify students during attendance sessions."
      />

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="app-surface p-5">
          <p className="text-sm text-ink-500">Active students</p>
          <p className="mt-2 text-3xl font-semibold text-ink-950">
            {studentsQuery.data?.items.length ?? 0}
          </p>
        </div>
        <div className="app-surface p-5">
          <p className="text-sm text-ink-500">Registered faces</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{registeredCount}</p>
        </div>
        <div className="app-surface p-5">
          <p className="text-sm text-ink-500">Missing faces</p>
          <p className="mt-2 text-3xl font-semibold text-amber-700">{missingCount}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <SearchInput
          wrapperClassName="xl:flex-1"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch('')}
          placeholder="Search by name, roll number, or email"
        />
        <div className="flex flex-col gap-3 sm:flex-row xl:items-center">
          <label className="flex h-12 min-w-[220px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-brand-200 focus-within:ring-4 focus-within:ring-brand-100/70">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
              Group
            </span>
            <select
              value={classGroupFilter}
              onChange={(event) => setClassGroupFilter(event.target.value)}
              className="w-full bg-transparent text-sm text-ink-950 outline-none"
            >
              {[{ value: '', label: 'All class groups' }, ...classGroupOptions].map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-12 min-w-[190px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-brand-200 focus-within:ring-4 focus-within:ring-brand-100/70">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
              Face
            </span>
            <select
              value={faceStatusFilter}
              onChange={(event) =>
                setFaceStatusFilter(event.target.value as typeof faceStatusFilter)
              }
              className="w-full bg-transparent text-sm text-ink-950 outline-none"
            >
              <option value="missing">Missing only</option>
              <option value="registered">Registered only</option>
              <option value="all">All students</option>
            </select>
          </label>
        </div>
      </div>

      {studentsQuery.isError ? (
        <ErrorMessage
          message={getErrorMessage(studentsQuery.error, 'Unable to load students.')}
        />
      ) : studentsQuery.isLoading || classGroupsQuery.isLoading ? (
        <div className="app-surface p-6">
          <Loader label="Loading students..." />
        </div>
      ) : students.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No students match this view."
          description="Adjust the filters or add active students before registering faces."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {students.map((student) => {
            const classGroup = classGroupMap.get(student.classGroupId ?? '')
            const hasFace = Boolean(student.faceProfileId)

            return (
              <article key={student.id} className="app-surface p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-lg font-semibold text-ink-950">
                      {student.firstName} {student.lastName}
                    </p>
                    <p className="text-sm text-ink-500">{student.rollNumber}</p>
                  </div>
                  <StatusBadge
                    label={hasFace ? 'Registered' : 'Missing'}
                    tone={hasFace ? 'success' : 'warning'}
                  />
                </div>

                <div className="mt-4 space-y-2 text-sm text-ink-600">
                  <p>{student.email ?? 'No email'}</p>
                  <p>{classGroup ? `${classGroup.code} - ${classGroup.name}` : 'No class group'}</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSuccessMessage(null)
                    setSelectedStudent(student)
                  }}
                  className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-ink-950 px-4 text-sm font-medium text-white transition hover:bg-ink-800"
                >
                  {hasFace ? <RefreshCcw className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                  {hasFace ? 'Retake face images' : 'Register face'}
                </button>

                {hasFace ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Ready for AI encoding
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}

      <FaceRegistrationModal
        open={Boolean(selectedStudent)}
        student={selectedStudent}
        isSaving={faceRegistrationMutation.isPending}
        onClose={() => setSelectedStudent(null)}
        onSubmit={async (images) => {
          if (!selectedStudent) {
            return
          }

          await faceRegistrationMutation.mutateAsync({
            studentId: selectedStudent.id,
            images,
          })
        }}
      />
    </div>
  )
}

export default StudentFaceRegistrationPage
