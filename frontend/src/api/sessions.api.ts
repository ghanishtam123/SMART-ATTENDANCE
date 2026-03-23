import client, { getApiData, getPaginatedApiData } from './client'
import type { ApiResponse, PaginationMeta } from '../types/common'
import type {
  CreateSessionInput,
  Session,
  SessionListQuery,
  UpdateSessionInput,
} from '../types/session'

export const sessionsApi = {
  listSessions: async (query: SessionListQuery = {}) => {
    const response = await client.get<ApiResponse<Session[], PaginationMeta>>('/sessions', {
      params: query,
    })

    return getPaginatedApiData(response)
  },

  getSessionById: async (id: string) => {
    const response = await client.get<ApiResponse<Session>>(`/sessions/${id}`)
    return getApiData(response)
  },

  createSession: async (payload: CreateSessionInput) => {
    const response = await client.post<ApiResponse<Session>>('/sessions', payload)
    return getApiData(response)
  },

  updateSession: async (id: string, payload: UpdateSessionInput) => {
    const response = await client.patch<ApiResponse<Session>>(
      `/sessions/${id}`,
      payload,
    )

    return getApiData(response)
  },

  deleteSession: async (id: string) => {
    const response = await client.delete<ApiResponse<Session>>(`/sessions/${id}`)
    return getApiData(response)
  },

  startSession: async (id: string) => {
    const response = await client.post<ApiResponse<Session>>(`/sessions/${id}/start`)
    return getApiData(response)
  },

  completeSession: async (id: string) => {
    const response = await client.post<ApiResponse<Session>>(`/sessions/${id}/complete`)
    return getApiData(response)
  },

  archiveSession: async (id: string) => {
    const response = await client.post<ApiResponse<Session>>(`/sessions/${id}/archive`)
    return getApiData(response)
  },
}
