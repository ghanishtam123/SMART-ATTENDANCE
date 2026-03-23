import {
  useCallback,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react'

import { AUTH_UNAUTHORIZED_EVENT } from '../api/client'
import { authApi } from '../api/auth.api'
import { AuthContext } from './auth-context'
import type { LoginInput } from '../types/auth'
import type { User } from '../types/user'
import { clearAccessToken, getAccessToken, setAccessToken } from '../utils/storage'

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [accessToken, setStoredAccessToken] = useState<string | null>(
    () => getAccessToken(),
  )
  const [loading, setLoading] = useState(true)

  const clearSession = useCallback(() => {
    clearAccessToken()
    setStoredAccessToken(null)
    setCurrentUser(null)
  }, [])

  const refreshCurrentUser = useCallback(async () => {
    const token = getAccessToken()

    if (!token) {
      clearSession()
      setLoading(false)
      return null
    }

    setLoading(true)

    try {
      const result = await authApi.getCurrentUser()
      setStoredAccessToken(token)
      setCurrentUser(result.user)
      return result.user
    } catch {
      clearSession()
      return null
    } finally {
      setLoading(false)
    }
  }, [clearSession])

  const login = useCallback(async (input: LoginInput) => {
    setLoading(true)

    try {
      const result = await authApi.login(input)
      setAccessToken(result.accessToken)
      setStoredAccessToken(result.accessToken)
      setCurrentUser(result.user)
      return result.user
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    clearSession()
  }, [clearSession])

  useEffect(() => {
    const handleUnauthorized = () => {
      clearSession()
      setLoading(false)
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)

    void refreshCurrentUser()

    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)
    }
  }, [clearSession, refreshCurrentUser])

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role: currentUser?.role ?? null,
        accessToken,
        isAuthenticated: !!currentUser,
        loading,
        login,
        logout,
        refreshCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
