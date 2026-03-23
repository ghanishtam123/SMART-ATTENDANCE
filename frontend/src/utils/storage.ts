const ACCESS_TOKEN_STORAGE_KEY = 'smart-attendance.access-token'

const isBrowser = () => typeof window !== 'undefined'

export const getAccessToken = () => {
  if (!isBrowser()) {
    return null
  }

  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
}

export const setAccessToken = (token: string) => {
  if (!isBrowser()) {
    return
  }

  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token)
}

export const clearAccessToken = () => {
  if (!isBrowser()) {
    return
  }

  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
}
