import client, { getApiData } from './client'
import type {
  CurrentUserResult,
  LoginInput,
  LoginResult,
  RegisterInput,
  RegisterResult,
} from '../types/auth'
import type { ApiResponse } from '../types/common'

export const authApi = {
  register: async (
    payload: RegisterInput,
    options?: { bootstrapSecret?: string },
  ) => {
    const response = await client.post<ApiResponse<RegisterResult>>(
      '/auth/register',
      payload,
      {
        headers: options?.bootstrapSecret
          ? {
              'x-bootstrap-secret': options.bootstrapSecret,
            }
          : undefined,
      },
    )

    return getApiData(response)
  },

  login: async (payload: LoginInput) => {
    const response = await client.post<ApiResponse<LoginResult>>('/auth/login', payload)
    return getApiData(response)
  },

  getCurrentUser: async () => {
    const response = await client.get<ApiResponse<CurrentUserResult>>('/auth/me')
    return getApiData(response)
  },
}
