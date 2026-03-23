import client, { getApiData, getPaginatedApiData } from './client'
import type { ApiResponse, PaginationMeta } from '../types/common'
import type {
  Classroom,
  ClassroomListQuery,
  CreateClassroomInput,
  UpdateClassroomInput,
} from '../types/classroom'

export const classroomsApi = {
  listClassrooms: async (query: ClassroomListQuery = {}) => {
    const response = await client.get<ApiResponse<Classroom[], PaginationMeta>>('/classrooms', {
      params: query,
    })

    return getPaginatedApiData(response)
  },

  getClassroomById: async (id: string) => {
    const response = await client.get<ApiResponse<Classroom>>(`/classrooms/${id}`)
    return getApiData(response)
  },

  createClassroom: async (payload: CreateClassroomInput) => {
    const response = await client.post<ApiResponse<Classroom>>('/classrooms', payload)
    return getApiData(response)
  },

  updateClassroom: async (id: string, payload: UpdateClassroomInput) => {
    const response = await client.patch<ApiResponse<Classroom>>(
      `/classrooms/${id}`,
      payload,
    )

    return getApiData(response)
  },

  deleteClassroom: async (id: string) => {
    const response = await client.delete<ApiResponse<Classroom>>(`/classrooms/${id}`)
    return getApiData(response)
  },
}
