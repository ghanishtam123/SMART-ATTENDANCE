import client, { getApiData, getPaginatedApiData } from './client'
import type { ApiResponse, PaginationMeta } from '../types/common'
import type {
  ClassGroup,
  ClassGroupListQuery,
  CreateClassGroupInput,
  UpdateClassGroupInput,
} from '../types/classGroup'

export const classGroupsApi = {
  listClassGroups: async (query: ClassGroupListQuery = {}) => {
    const response = await client.get<ApiResponse<ClassGroup[], PaginationMeta>>('/class-groups', {
      params: query,
    })

    return getPaginatedApiData(response)
  },

  getClassGroupById: async (id: string) => {
    const response = await client.get<ApiResponse<ClassGroup>>(`/class-groups/${id}`)
    return getApiData(response)
  },

  createClassGroup: async (payload: CreateClassGroupInput) => {
    const response = await client.post<ApiResponse<ClassGroup>>(
      '/class-groups',
      payload,
    )

    return getApiData(response)
  },

  updateClassGroup: async (id: string, payload: UpdateClassGroupInput) => {
    const response = await client.patch<ApiResponse<ClassGroup>>(
      `/class-groups/${id}`,
      payload,
    )

    return getApiData(response)
  },

  deleteClassGroup: async (id: string) => {
    const response = await client.delete<ApiResponse<ClassGroup>>(
      `/class-groups/${id}`,
    )

    return getApiData(response)
  },
}
