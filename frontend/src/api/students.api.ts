import client, { getApiData, getPaginatedApiData } from './client'
import type { ApiResponse, PaginationMeta } from '../types/common'
import type {
  CreateStudentPayload,
  Student,
  StudentFaceImagesPayload,
  StudentFaceImagesResult,
  StudentListQuery,
  UpdateStudentInput,
} from '../types/student'

export const studentsApi = {
  listStudents: async (query: StudentListQuery = {}) => {
    const response = await client.get<ApiResponse<Student[], PaginationMeta>>('/students', {
      params: query,
    })

    return getPaginatedApiData(response)
  },

  getStudentById: async (id: string) => {
    const response = await client.get<ApiResponse<Student>>(`/students/${id}`)
    return getApiData(response)
  },

  createStudent: async (payload: CreateStudentPayload) => {
    const response = await client.post<ApiResponse<Student>>('/students', payload)
    return getApiData(response)
  },

  updateStudent: async (id: string, payload: UpdateStudentInput) => {
    const response = await client.patch<ApiResponse<Student>>(
      `/students/${id}`,
      payload,
    )

    return getApiData(response)
  },

  deleteStudent: async (id: string) => {
    const response = await client.delete<ApiResponse<Student>>(`/students/${id}`)
    return getApiData(response)
  },

  uploadFaceImages: async (id: string, payload: StudentFaceImagesPayload) => {
    const response = await client.post<ApiResponse<StudentFaceImagesResult>>(
      `/students/${id}/face-images`,
      payload,
    )
    return getApiData(response)
  },

  getFaceImages: async (id: string) => {
    const response = await client.get<ApiResponse<StudentFaceImagesResult>>(
      `/students/${id}/face-images`,
    )
    return getApiData(response)
  },
}
