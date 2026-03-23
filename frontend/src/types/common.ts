export interface ApiResponse<T, M = Record<string, unknown> | undefined> {
  success: boolean
  message: string
  data: T
  error?: unknown
  meta?: M
}

export interface ApiErrorPayload {
  success?: boolean
  message?: string
  error?: unknown
  meta?: Record<string, unknown>
}

export interface PaginationQuery {
  page?: number
  limit?: number
  search?: string
}

export interface PaginationMeta {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface PaginatedResult<T, M = PaginationMeta> {
  items: T[]
  meta: M
}

export interface DateRangeQuery {
  from?: string
  to?: string
}

export type ExportFormat = 'json' | 'csv'

export interface ExportColumn {
  key: string
  label: string
}

export interface ExportPayload {
  fileName: string
  columns: ExportColumn[]
  rows: Record<string, unknown>[]
  summary?: Record<string, unknown>
}

export type ExportResult<T extends ExportPayload = ExportPayload> = T | Blob

export interface EntityReference {
  id: string | null
  name: string | null
}

export interface EntityCodeReference extends EntityReference {
  code?: string | null
}

export interface BreadcrumbItem {
  label: string
  href?: string
}
