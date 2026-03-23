import client, { getApiData, getPaginatedApiData } from './client'
import type { ApiResponse, PaginationMeta } from '../types/common'
import type {
  CreateSubjectInput,
  Subject,
  SubjectListQuery,
  UpdateSubjectInput,
} from '../types/subject'

export const subjectsApi = {
  listSubjects: async (query: SubjectListQuery = {}) => {
    const response = await client.get<ApiResponse<Subject[], PaginationMeta>>('/subjects', {
      params: query,
    })

    return getPaginatedApiData(response)
  },

  getSubjectById: async (id: string) => {
    const response = await client.get<ApiResponse<Subject>>(`/subjects/${id}`)
    return getApiData(response)
  },

  createSubject: async (payload: CreateSubjectInput) => {
    const response = await client.post<ApiResponse<Subject>>('/subjects', payload)
    return getApiData(response)
  },

  updateSubject: async (id: string, payload: UpdateSubjectInput) => {
    const response = await client.patch<ApiResponse<Subject>>(
      `/subjects/${id}`,
      payload,
    )

    return getApiData(response)
  },

  deleteSubject: async (id: string) => {
    const response = await client.delete<ApiResponse<Subject>>(`/subjects/${id}`)
    return getApiData(response)
  },
}
