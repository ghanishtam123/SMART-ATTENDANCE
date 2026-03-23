import client, {
  getApiData,
  getPaginatedApiData,
  requestExport,
} from './client'
import type {
  ApiResponse,
  ExportPayload,
  PaginationMeta,
} from '../types/common'
import type {
  StudentAttendanceHistoryItem,
  StudentAttendanceOverview,
  StudentPortalAttendanceExportQuery,
  StudentPortalAttendanceHistoryQuery,
  StudentPortalOverviewQuery,
  StudentPortalProfile,
  StudentPortalSessionHistoryQuery,
  StudentPortalSubjectsQuery,
  StudentSessionHistoryItem,
  StudentSubjectAttendanceItem,
} from '../types/studentPortal'

export const studentPortalApi = {
  getMe: async () => {
    const response = await client.get<ApiResponse<StudentPortalProfile>>(
      '/student-portal/me',
    )

    return getApiData(response)
  },

  getAttendanceOverview: async (query: StudentPortalOverviewQuery = {}) => {
    const response = await client.get<ApiResponse<StudentAttendanceOverview>>(
      '/student-portal/attendance-overview',
      {
        params: query,
      },
    )

    return getApiData(response)
  },

  getAttendanceHistory: async (
    query: StudentPortalAttendanceHistoryQuery = {},
  ) => {
    const response = await client.get<ApiResponse<StudentAttendanceHistoryItem[], PaginationMeta>>(
      '/student-portal/attendance-history',
      {
        params: query,
      },
    )

    return getPaginatedApiData(response)
  },

  exportAttendanceHistory: async (
    query: StudentPortalAttendanceExportQuery = {},
  ) => requestExport<ExportPayload>('/student-portal/attendance-history/export', query),

  getSubjects: async (query: StudentPortalSubjectsQuery = {}) => {
    const response = await client.get<ApiResponse<StudentSubjectAttendanceItem[], PaginationMeta>>(
      '/student-portal/subjects',
      {
        params: query,
      },
    )

    return getPaginatedApiData(response)
  },

  getSessionHistory: async (query: StudentPortalSessionHistoryQuery = {}) => {
    const response = await client.get<ApiResponse<StudentSessionHistoryItem[], PaginationMeta>>(
      '/student-portal/session-history',
      {
        params: query,
      },
    )

    return getPaginatedApiData(response)
  },
}
