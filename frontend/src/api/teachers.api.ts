import client, { getApiData, getPaginatedApiData } from './client'
import type { ApiResponse, PaginationMeta } from '../types/common'
import type {
  CreateTeacherPayload,
  TeacherListQuery,
  TeacherProfile,
  UpdateTeacherInput,
} from '../types/teacher'

export const teachersApi = {
  listTeachers: async (query: TeacherListQuery = {}) => {
    const response = await client.get<ApiResponse<TeacherProfile[], PaginationMeta>>('/teachers', {
      params: query,
    })

    return getPaginatedApiData(response)
  },

  getTeacherById: async (id: string) => {
    const response = await client.get<ApiResponse<TeacherProfile>>(`/teachers/${id}`)
    return getApiData(response)
  },

  createTeacher: async (payload: CreateTeacherPayload) => {
    const response = await client.post<ApiResponse<TeacherProfile>>(
      '/teachers',
      payload,
    )

    return getApiData(response)
  },

  updateTeacher: async (id: string, payload: UpdateTeacherInput) => {
    const response = await client.patch<ApiResponse<TeacherProfile>>(
      `/teachers/${id}`,
      payload,
    )

    return getApiData(response)
  },

  deleteTeacher: async (id: string) => {
    const response = await client.delete<ApiResponse<TeacherProfile>>(
      `/teachers/${id}`,
    )

    return getApiData(response)
  },
}
