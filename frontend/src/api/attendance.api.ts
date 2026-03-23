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
  AttendanceLifecycleSummary,
  AttendanceRecord,
  ClassGroupAttendanceExportQuery,
  ClassGroupAttendanceSummary,
  ClassGroupAttendanceSummaryQuery,
  SessionAttendanceExportQuery,
  SessionAttendanceRecordsQuery,
  SessionAttendanceSummary,
  StudentAttendanceExportQuery,
  StudentAttendanceHistoryQuery,
} from '../types/attendance'

export const attendanceApi = {
  recalculateSessionAttendance: async (sessionId: string) => {
    const response = await client.post<ApiResponse<AttendanceLifecycleSummary>>(
      `/attendance/sessions/${sessionId}/recalculate`,
    )

    return getApiData(response)
  },

  finalizeSessionAttendance: async (sessionId: string) => {
    const response = await client.post<ApiResponse<AttendanceLifecycleSummary>>(
      `/attendance/sessions/${sessionId}/finalize`,
    )

    return getApiData(response)
  },

  getSessionAttendanceRecords: async (
    sessionId: string,
    query: SessionAttendanceRecordsQuery = {},
  ) => {
    const response = await client.get<ApiResponse<AttendanceRecord[], PaginationMeta>>(
      `/attendance/sessions/${sessionId}/records`,
      {
        params: query,
      },
    )

    return getPaginatedApiData(response)
  },

  getSessionAttendanceSummary: async (sessionId: string) => {
    const response = await client.get<ApiResponse<SessionAttendanceSummary>>(
      `/attendance/sessions/${sessionId}/summary`,
    )

    return getApiData(response)
  },

  getClassGroupAttendanceSummary: async (
    classGroupId: string,
    query: ClassGroupAttendanceSummaryQuery = {},
  ) => {
    const response = await client.get<ApiResponse<ClassGroupAttendanceSummary>>(
      `/attendance/class-groups/${classGroupId}/summary`,
      {
        params: query,
      },
    )

    return getApiData(response)
  },

  getStudentAttendanceHistory: async (
    studentId: string,
    query: StudentAttendanceHistoryQuery = {},
  ) => {
    const response = await client.get<ApiResponse<AttendanceRecord[], PaginationMeta>>(
      `/attendance/students/${studentId}/history`,
      {
        params: query,
      },
    )

    return getPaginatedApiData(response)
  },

  exportSessionAttendanceRecords: async (
    sessionId: string,
    query: SessionAttendanceExportQuery = {},
  ) =>
    requestExport<ExportPayload>(
      `/attendance/sessions/${sessionId}/export`,
      query,
    ),

  exportStudentAttendanceHistory: async (
    studentId: string,
    query: StudentAttendanceExportQuery = {},
  ) =>
    requestExport<ExportPayload>(
      `/attendance/students/${studentId}/export`,
      query,
    ),

  exportClassGroupAttendanceSummary: async (
    classGroupId: string,
    query: ClassGroupAttendanceExportQuery = {},
  ) =>
    requestExport<ExportPayload>(
      `/attendance/class-groups/${classGroupId}/export`,
      query,
    ),
}
