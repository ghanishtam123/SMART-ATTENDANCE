import { LockKeyhole } from 'lucide-react'
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'

import Loader from '../components/common/Loader'
import { adminRoles, staffRoles, studentRoles } from '../constants/roles'
import { routes } from '../constants/routes'
import { useAuth } from '../hooks/useAuth'
import AuthLayout from '../layouts/AuthLayout'
import DashboardLayout from '../layouts/DashboardLayout'
import LoginPage from '../pages/auth/LoginPage'
import AlertsPage from '../pages/alerts/AlertsPage'
import AnalyticsPage from '../pages/analytics/AnalyticsPage'
import AttendanceRecordsPage from '../pages/attendance/AttendanceRecordsPage'
import SessionSummaryPage from '../pages/attendance/SessionSummaryPage'
import StudentAttendanceHistoryPage from '../pages/attendance/StudentAttendanceHistoryPage'
import ClassGroupsPage from '../pages/class-groups/ClassGroupsPage'
import ClassroomsPage from '../pages/classrooms/ClassroomsPage'
import AdminDashboardPage from '../pages/dashboard/AdminDashboardPage'
import StudentDashboardPage from '../pages/dashboard/StudentDashboardPage'
import TeacherDashboardPage from '../pages/dashboard/TeacherDashboardPage'
import LiveMonitoringPage from '../pages/live/LiveMonitoringPage'
import NotFoundPage from '../pages/misc/NotFoundPage'
import UnauthorizedPage from '../pages/misc/UnauthorizedPage'
import MyAttendanceHistoryPage from '../pages/student-portal/MyAttendanceHistoryPage'
import MyAttendanceOverviewPage from '../pages/student-portal/MyAttendanceOverviewPage'
import MyProfilePage from '../pages/student-portal/MyProfilePage'
import MySessionHistoryPage from '../pages/student-portal/MySessionHistoryPage'
import MySubjectsPage from '../pages/student-portal/MySubjectsPage'
import StudentsPage from '../pages/students/StudentsPage'
import SubjectsPage from '../pages/subjects/SubjectsPage'
import TeachersPage from '../pages/teachers/TeachersPage'
import SessionDetailsPage from '../pages/sessions/SessionDetailsPage'
import SessionsPage from '../pages/sessions/SessionsPage'
import TimetablePage from '../pages/timetable/TimetablePage'
import UsersPage from '../pages/users/UsersPage'
import type { UserRole } from '../types/user'
import { getDashboardRouteForRole, hasAnyRole } from '../utils/role'

interface RequireRoleProps {
  allowedRoles: UserRole[]
}

function AppBootstrapLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="app-surface w-full max-w-md p-8 text-center">
        <div className="mx-auto flex max-w-xs flex-col items-center gap-4">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <LockKeyhole className="h-6 w-6" />
          </span>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink-950">
              Restoring your session
            </h1>
            <p className="text-sm leading-6 text-ink-600">
              Verifying your access token and loading the correct workspace.
            </p>
          </div>
          <Loader label="Checking authentication..." />
        </div>
      </div>
    </div>
  )
}

function DashboardRedirect() {
  const { role } = useAuth()

  if (!role) {
    return <Navigate to={routes.login} replace />
  }

  return <Navigate to={getDashboardRouteForRole(role)} replace />
}

function PublicOnlyRoute() {
  const { isAuthenticated, loading, role } = useAuth()

  if (loading) {
    return <AppBootstrapLoader />
  }

  if (isAuthenticated && role) {
    return <Navigate to={getDashboardRouteForRole(role)} replace />
  }

  return <Outlet />
}

function RequireAuth() {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <AppBootstrapLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to={routes.login} replace state={{ from: location }} />
  }

  return <Outlet />
}

function RequireRole({ allowedRoles }: RequireRoleProps) {
  const { role } = useAuth()

  if (!hasAnyRole(role, allowedRoles)) {
    return <Navigate to={routes.unauthorized} replace />
  }

  return <Outlet />
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={routes.root} element={<Navigate to={routes.dashboard} replace />} />

        <Route element={<PublicOnlyRoute />}>
          <Route element={<AuthLayout />}>
            <Route path={routes.login} element={<LoginPage />} />
          </Route>
        </Route>

        <Route path={routes.unauthorized} element={<UnauthorizedPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<DashboardLayout />}>
            <Route path={routes.dashboard} element={<DashboardRedirect />} />

            <Route element={<RequireRole allowedRoles={adminRoles} />}>
              <Route path={routes.adminDashboard} element={<AdminDashboardPage />} />
              <Route path={routes.users} element={<UsersPage />} />
              <Route path={routes.students} element={<StudentsPage />} />
              <Route path={routes.teachers} element={<TeachersPage />} />
              <Route path={routes.classGroups} element={<ClassGroupsPage />} />
              <Route path={routes.classrooms} element={<ClassroomsPage />} />
              <Route path={routes.subjects} element={<SubjectsPage />} />
              <Route path={routes.timetable} element={<TimetablePage />} />
            </Route>

            <Route element={<RequireRole allowedRoles={staffRoles} />}>
              <Route path={routes.sessions} element={<SessionsPage />} />
              <Route path={routes.sessionDetails} element={<SessionDetailsPage />} />
              <Route path={routes.attendanceRecords} element={<AttendanceRecordsPage />} />
              <Route path={routes.sessionSummary} element={<SessionSummaryPage />} />
              <Route
                path={routes.studentAttendanceHistory}
                element={<StudentAttendanceHistoryPage />}
              />
              <Route path={routes.alerts} element={<AlertsPage />} />
              <Route path={routes.analytics} element={<AnalyticsPage />} />
              <Route path={routes.liveMonitoring} element={<LiveMonitoringPage />} />
            </Route>

            <Route element={<RequireRole allowedRoles={['teacher']} />}>
              <Route path={routes.teacherDashboard} element={<TeacherDashboardPage />} />
            </Route>

            <Route element={<RequireRole allowedRoles={studentRoles} />}>
              <Route path={routes.studentDashboard} element={<StudentDashboardPage />} />
              <Route path={routes.myProfile} element={<MyProfilePage />} />
              <Route
                path={routes.myAttendanceOverview}
                element={<MyAttendanceOverviewPage />}
              />
              <Route
                path={routes.myAttendanceHistory}
                element={<MyAttendanceHistoryPage />}
              />
              <Route path={routes.mySubjects} element={<MySubjectsPage />} />
              <Route path={routes.mySessionHistory} element={<MySessionHistoryPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter
