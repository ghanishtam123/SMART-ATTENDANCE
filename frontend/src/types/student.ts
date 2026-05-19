import type { PaginationQuery } from './common'

export const studentStatusValues = ['active', 'inactive'] as const
export type StudentStatus = (typeof studentStatusValues)[number]

export const studentGenderValues = ['male', 'female', 'other'] as const
export type StudentGender = (typeof studentGenderValues)[number]

export interface FaceProfileSummary {
  id: string
  studentId: string | null
  embeddingVersion: string
  embeddingCount: number
  registrationStatus: string
  registeredAt: string | null
  lastUpdatedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface Student {
  id: string
  firstName: string
  lastName: string
  rollNumber: string
  email: string | null
  phone: string | null
  gender: StudentGender | null
  userId: string | null
  classGroupId: string | null
  status: StudentStatus
  faceProfileId: string | null
  createdAt: string
  updatedAt: string
}

export interface StudentListQuery extends PaginationQuery {
  classGroupId?: string
  status?: StudentStatus
  hasEmail?: boolean
}

export interface StudentLoginDetails {
  email: string
  password: string
  isActive: boolean
}

export interface CreateStudentPayload {
  firstName: string
  lastName: string
  rollNumber: string
  email: string
  phone?: string
  gender?: StudentGender
  classGroupId: string
  status?: StudentStatus
  faceProfileId?: string
  createLoginAccount: true
  login: StudentLoginDetails
}

export type CreateStudentInput = CreateStudentPayload

export interface UpdateStudentInput {
  firstName?: string
  lastName?: string
  rollNumber?: string
  email?: string
  phone?: string
  gender?: StudentGender
  userId?: string | null
  classGroupId?: string
  status?: StudentStatus
  faceProfileId?: string | null
}

export interface StudentFaceImagesPayload {
  center: string
  left: string
  right: string
}

export interface StudentFaceImagesResult {
  studentId: string
  storageDir: string
  images: {
    center: string | null
    left: string | null
    right: string | null
  }
  faceProfileUpdated: boolean
  updatedAt: string | null
}
