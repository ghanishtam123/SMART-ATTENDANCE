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
  AnalyticsOverviewExportQuery,
  AttendanceOverview,
  AttendanceOverviewQuery,
  LateEntriesQuery,
  LateEntry,
  LowAttendanceQuery,
  LowAttendanceStudent,
  SessionAbsentee,
  SessionAbsenteesMeta,
  SessionAbsenteesQuery,
} from '../types/analytics'

export const analyticsApi = {
  getAttendanceOverview: async (query: AttendanceOverviewQuery = {}) => {
    const response = await client.get<ApiResponse<AttendanceOverview>>(
      '/analytics/attendance-overview',
      {
        params: query,
      },
    )

    return getApiData(response)
  },

  exportAttendanceOverview: async (query: AnalyticsOverviewExportQuery = {}) =>
    requestExport<ExportPayload>('/analytics/attendance-overview/export', query),

  getLowAttendanceStudents: async (query: LowAttendanceQuery = {}) => {
    const response = await client.get<ApiResponse<LowAttendanceStudent[], PaginationMeta>>(
      '/analytics/low-attendance',
      {
        params: query,
      },
    )

    return getPaginatedApiData(response)
  },

  getLateEntries: async (query: LateEntriesQuery = {}) => {
    const response = await client.get<ApiResponse<LateEntry[], PaginationMeta>>(
      '/analytics/late-entries',
      {
        params: query,
      },
    )

    return getPaginatedApiData(response)
  },

  getSessionAbsentees: async (
    sessionId: string,
    query: SessionAbsenteesQuery = {},
  ) => {
    const response = await client.get<ApiResponse<SessionAbsentee[], SessionAbsenteesMeta>>(
      `/analytics/session-absentees/${sessionId}`,
      {
        params: query,
      },
    )

    return getPaginatedApiData<SessionAbsentee, SessionAbsenteesMeta>(response)
  },
}
