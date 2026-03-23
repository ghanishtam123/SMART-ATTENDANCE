import client, { getApiData, getPaginatedApiData } from './client'
import type { ApiResponse, PaginationMeta } from '../types/common'
import type {
  CreateTimetableEntryInput,
  TimetableEntry,
  TimetableListQuery,
  UpdateTimetableEntryInput,
} from '../types/timetable'

export const timetableApi = {
  listTimetableEntries: async (query: TimetableListQuery = {}) => {
    const response = await client.get<ApiResponse<TimetableEntry[], PaginationMeta>>('/timetable', {
      params: query,
    })

    return getPaginatedApiData(response)
  },

  getTimetableEntryById: async (id: string) => {
    const response = await client.get<ApiResponse<TimetableEntry>>(`/timetable/${id}`)
    return getApiData(response)
  },

  createTimetableEntry: async (payload: CreateTimetableEntryInput) => {
    const response = await client.post<ApiResponse<TimetableEntry>>(
      '/timetable',
      payload,
    )

    return getApiData(response)
  },

  updateTimetableEntry: async (id: string, payload: UpdateTimetableEntryInput) => {
    const response = await client.patch<ApiResponse<TimetableEntry>>(
      `/timetable/${id}`,
      payload,
    )

    return getApiData(response)
  },

  deleteTimetableEntry: async (id: string) => {
    const response = await client.delete<ApiResponse<TimetableEntry>>(`/timetable/${id}`)
    return getApiData(response)
  },
}
