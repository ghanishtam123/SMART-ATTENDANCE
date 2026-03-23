import axios from 'axios'

import type { ApiErrorPayload } from '../types/common'
import { roleLabels } from '../constants/roles'
import type { UserRole } from '../types/user'

export const getErrorMessage = (
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
) => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorPayload | undefined

    if (typeof data?.message === 'string' && data.message.trim()) {
      return data.message
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

export const getInitials = (fullName: string) =>
  fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

export const formatRole = (role: UserRole) => roleLabels[role]

const parseDateValue = (value: string) =>
  new Date(value.includes('T') ? value : `${value}T00:00:00`)

export const formatDate = (value?: string | null) => {
  if (!value) {
    return 'Not set'
  }

  const parsed = parseDateValue(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(parsed)
}

export const formatDateTime = (value?: string | null) => {
  if (!value) {
    return 'Not set'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

export const formatTime = (value?: string | null) => {
  if (!value) {
    return 'Not set'
  }

  const parsed = new Date(`1970-01-01T${value}`)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed)
}

export const formatTimeRange = (
  start?: string | null,
  end?: string | null,
) => `${formatTime(start)} - ${formatTime(end)}`
