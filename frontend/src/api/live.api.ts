import client, { getApiData } from './client'
import type { ApiResponse } from '../types/common'
import type {
  ActiveSessionsQuery,
  LiveActiveSession,
  LiveSessionOverview,
  RecentItemsQuery,
  RecentSessionAlert,
  RecentSessionEvent,
} from '../types/live'

export const liveApi = {
  getActiveSessions: async (query: ActiveSessionsQuery = {}) => {
    const response = await client.get<ApiResponse<LiveActiveSession[]>>(
      '/live/active-sessions',
      {
        params: query,
      },
    )

    return getApiData(response)
  },

  getSessionOverview: async (sessionId: string) => {
    const response = await client.get<ApiResponse<LiveSessionOverview>>(
      `/live/sessions/${sessionId}/overview`,
    )

    return getApiData(response)
  },

  getRecentSessionEvents: async (
    sessionId: string,
    query: RecentItemsQuery = {},
  ) => {
    const response = await client.get<ApiResponse<RecentSessionEvent[]>>(
      `/live/sessions/${sessionId}/recent-events`,
      {
        params: query,
      },
    )

    return getApiData(response)
  },

  getRecentSessionAlerts: async (
    sessionId: string,
    query: RecentItemsQuery = {},
  ) => {
    const response = await client.get<ApiResponse<RecentSessionAlert[]>>(
      `/live/sessions/${sessionId}/recent-alerts`,
      {
        params: query,
      },
    )

    return getApiData(response)
  },
}
