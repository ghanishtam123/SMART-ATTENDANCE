import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarClock,
  Camera,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  MonitorPlay,
  School,
  ShieldCheck,
  UserSquare2,
} from 'lucide-react'

import { routes } from './routes'
import type { UserRole } from '../types/user'

export interface NavItem {
  label: string
  to: string
  icon: typeof LayoutDashboard
  matchPaths?: string[]
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export interface RouteMeta {
  title: string
  sectionLabel?: string
  breadcrumbs: Array<{ label: string; href?: string }>
}

const dashboardItem: NavItem = {
  label: 'Dashboard',
  to: routes.dashboard,
  icon: LayoutDashboard,
  matchPaths: [
    routes.dashboard,
    routes.adminDashboard,
    routes.teacherDashboard,
    routes.studentDashboard,
  ],
}

const adminsItem: NavItem = {
  label: 'Admins',
  to: routes.admins,
  icon: ShieldCheck,
}

const studentsItem: NavItem = {
  label: 'Students',
  to: routes.students,
  icon: GraduationCap,
}

const studentFaceRegistrationItem: NavItem = {
  label: 'Face Registration',
  to: routes.studentFaceRegistration,
  icon: Camera,
}

const teachersItem: NavItem = {
  label: 'Teachers',
  to: routes.teachers,
  icon: UserSquare2,
}

const classGroupsItem: NavItem = {
  label: 'Class Groups',
  to: routes.classGroups,
  icon: School,
}

const classroomsItem: NavItem = {
  label: 'Classrooms',
  to: routes.classrooms,
  icon: School,
}

const subjectsItem: NavItem = {
  label: 'Subjects',
  to: routes.subjects,
  icon: BookOpen,
}

const timetableItem: NavItem = {
  label: 'Timetable',
  to: routes.timetable,
  icon: CalendarClock,
}

const sessionsItem: NavItem = {
  label: 'Sessions',
  to: routes.sessions,
  icon: ClipboardList,
}

const attendanceItem: NavItem = {
  label: 'Attendance',
  to: routes.attendanceRecords,
  icon: ClipboardList,
  matchPaths: [
    routes.attendanceRecords,
    routes.sessionSummary,
    routes.studentAttendanceHistory,
  ],
}

const alertsItem: NavItem = {
  label: 'Alerts',
  to: routes.alerts,
  icon: Bell,
}

const analyticsItem: NavItem = {
  label: 'Analytics',
  to: routes.analytics,
  icon: BarChart3,
}

const liveMonitoringItem: NavItem = {
  label: 'Live Monitoring',
  to: routes.liveMonitoring,
  icon: MonitorPlay,
}

const teacherProfileItem: NavItem = {
  label: 'My Profile',
  to: routes.teacherMyProfile,
  icon: UserSquare2,
}

const studentProfileItem: NavItem = {
  label: 'My Profile',
  to: routes.myProfile,
  icon: UserSquare2,
}

const attendanceOverviewItem: NavItem = {
  label: 'My Attendance Overview',
  to: routes.myAttendanceOverview,
  icon: ClipboardList,
}

const attendanceHistoryItem: NavItem = {
  label: 'My Attendance History',
  to: routes.myAttendanceHistory,
  icon: ClipboardList,
}

const mySubjectsItem: NavItem = {
  label: 'My Subjects',
  to: routes.mySubjects,
  icon: BookOpen,
}

const mySessionHistoryItem: NavItem = {
  label: 'My Session History',
  to: routes.mySessionHistory,
  icon: CalendarClock,
}

const superAdminNavigation: NavSection[] = [
  {
    label: 'Overview',
    items: [dashboardItem],
  },
  {
    label: 'Management',
    items: [adminsItem, teachersItem, studentsItem, studentFaceRegistrationItem],
  },
  {
    label: 'Academics',
    items: [classGroupsItem, classroomsItem, subjectsItem, timetableItem],
  },
  {
    label: 'Operations',
    items: [sessionsItem, attendanceItem, alertsItem, analyticsItem, liveMonitoringItem],
  },
]

const adminNavigation: NavSection[] = [
  {
    label: 'Overview',
    items: [dashboardItem],
  },
  {
    label: 'Management',
    items: [teachersItem, studentsItem, studentFaceRegistrationItem],
  },
  {
    label: 'Academics',
    items: [classGroupsItem, classroomsItem, subjectsItem, timetableItem],
  },
  {
    label: 'Operations',
    items: [sessionsItem, attendanceItem, alertsItem, analyticsItem, liveMonitoringItem],
  },
]

const teacherNavigation: NavSection[] = [
  {
    label: 'Overview',
    items: [dashboardItem, teacherProfileItem],
  },
  {
    label: 'Teaching',
    items: [sessionsItem, attendanceItem],
  },
  {
    label: 'Monitoring',
    items: [alertsItem, analyticsItem, liveMonitoringItem],
  },
]

const studentNavigation: NavSection[] = [
  {
    label: 'Overview',
    items: [dashboardItem],
  },
  {
    label: 'Student Portal',
    items: [
      studentProfileItem,
      attendanceOverviewItem,
      attendanceHistoryItem,
      mySubjectsItem,
      mySessionHistoryItem,
    ],
  },
]

export const navSectionsByRole: Record<UserRole, NavSection[]> = {
  super_admin: superAdminNavigation,
  admin: adminNavigation,
  teacher: teacherNavigation,
  student: studentNavigation,
}

export const getNavSectionsForRole = (role: UserRole) => navSectionsByRole[role]

export const matchNavItem = (item: NavItem, pathname: string) => {
  const paths = item.matchPaths ?? [item.to]

  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

export const findActiveNavItem = (role: UserRole, pathname: string) => {
  const sections = getNavSectionsForRole(role)

  for (const section of sections) {
    const matchedItem = section.items.find((item) => matchNavItem(item, pathname))

    if (matchedItem) {
      return {
        item: matchedItem,
        section,
      }
    }
  }

  return null
}

export const getRouteMetaForRole = (
  role: UserRole,
  pathname: string,
): RouteMeta | null => {
  const active = findActiveNavItem(role, pathname)

  if (active) {
    if (active.item.to === routes.dashboard) {
      return {
        title: active.item.label,
        sectionLabel: active.section.label,
        breadcrumbs: [{ label: active.item.label }],
      }
    }

    return {
      title: active.item.label,
      sectionLabel: active.section.label,
      breadcrumbs: [
        { label: 'Dashboard', href: routes.dashboard },
        { label: active.item.label },
      ],
    }
  }

  return null
}
