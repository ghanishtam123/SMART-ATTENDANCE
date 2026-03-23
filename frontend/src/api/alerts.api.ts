import client, { getApiData, getPaginatedApiData } from './client'
import type { ApiResponse, PaginationMeta } from '../types/common'
import type {
  MarkUnknownFaceAlertReviewedInput,
  UnknownFaceAlert,
  UnknownFaceAlertListQuery,
} from '../types/alert'

export const alertsApi = {
  listUnknownFaceAlerts: async (query: UnknownFaceAlertListQuery = {}) => {
    const response = await client.get<ApiResponse<UnknownFaceAlert[], PaginationMeta>>(
      '/alerts/unknown-faces',
      {
        params: query,
      },
    )

    return getPaginatedApiData(response)
  },

  markUnknownFaceAlertReviewed: async (
    id: string,
    payload: MarkUnknownFaceAlertReviewedInput = {},
  ) => {
    const response = await client.patch<ApiResponse<UnknownFaceAlert>>(
      `/alerts/unknown-faces/${id}/reviewed`,
      payload,
    )

    return getApiData(response)
  },
}
