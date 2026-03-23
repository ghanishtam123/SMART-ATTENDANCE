import type { PaginationQuery } from './common'

export interface UnknownFaceAlert {
  id: string
  sessionId: string | null
  cameraId: string
  detectedAt: string
  confidence: number
  snapshotRef: string | null
  reviewed: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface UnknownFaceAlertListQuery extends PaginationQuery {
  sessionId?: string
  cameraId?: string
  reviewed?: boolean
}

export interface MarkUnknownFaceAlertReviewedInput {
  notes?: string
}
