import axios, {
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios'

import { clearAccessToken, getAccessToken } from '../utils/storage'
import type {
  ApiResponse,
  ExportFormat,
  ExportPayload,
  PaginatedResult,
  PaginationMeta,
} from '../types/common'

export const AUTH_UNAUTHORIZED_EVENT = 'smart-attendance:unauthorized'

const baseURL =
  import.meta.env.VITE_API_BASE_URL

const client = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

client.interceptors.request.use((config) => {
  const token = getAccessToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearAccessToken()

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT))
      }
    }

    return Promise.reject(error)
  },
)

export const getApiData = <T, M = Record<string, unknown> | undefined>(
  response: AxiosResponse<ApiResponse<T, M>>,
) => response.data.data

export const getPaginatedApiData = <T, M = PaginationMeta>(
  response: AxiosResponse<ApiResponse<T[], M>>,
): PaginatedResult<T, M> => ({
  items: response.data.data,
  meta: response.data.meta as M,
})

export const requestExport = async <T extends ExportPayload>(
  path: string,
  params?: ({ format?: ExportFormat } & object) | undefined,
  config?: Omit<AxiosRequestConfig, 'params' | 'responseType'>,
): Promise<T | Blob> => {
  const format = params?.format ?? 'json'

  if (format === 'csv') {
    const response = await client.get<Blob>(path, {
      ...config,
      params: {
        ...params,
        format,
      },
      responseType: 'blob',
    })

    return response.data
  }

  const response = await client.get<ApiResponse<T>>(path, {
    ...config,
    params: {
      ...params,
      format,
    },
  })

  return response.data.data
}

export default client
