import client, { getApiData, getPaginatedApiData } from './client'
import type { ApiResponse, PaginationMeta } from '../types/common'
import type {
  CreateUserInput,
  UpdateUserInput,
  UpdateUserStatusInput,
  User,
  UserListQuery,
} from '../types/user'

export const usersApi = {
  listUsers: async (query: UserListQuery = {}) => {
    const response = await client.get<ApiResponse<User[], PaginationMeta>>('/users', {
      params: query,
    })

    return getPaginatedApiData(response)
  },

  getUserById: async (id: string) => {
    const response = await client.get<ApiResponse<User>>(`/users/${id}`)
    return getApiData(response)
  },

  createUser: async (payload: CreateUserInput) => {
    const response = await client.post<ApiResponse<User>>('/users', payload)
    return getApiData(response)
  },

  updateUser: async (id: string, payload: UpdateUserInput) => {
    const response = await client.patch<ApiResponse<User>>(`/users/${id}`, payload)
    return getApiData(response)
  },

  updateUserStatus: async (id: string, payload: UpdateUserStatusInput) => {
    const response = await client.patch<ApiResponse<User>>(
      `/users/${id}/status`,
      payload,
    )

    return getApiData(response)
  },
}
