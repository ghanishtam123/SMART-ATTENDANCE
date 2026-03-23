import type { User, UserRole } from './user'

export interface RegisterInput {
  fullName: string
  email: string
  password: string
  role: UserRole
}

export interface RegisterResult {
  user: User
}

export interface LoginInput {
  email: string
  password: string
}

export interface LoginResult {
  user: User
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: string
}

export interface CurrentUserResult {
  user: User
}

export interface AuthContextValue {
  currentUser: User | null
  role: UserRole | null
  accessToken: string | null
  isAuthenticated: boolean
  loading: boolean
  login: (input: LoginInput) => Promise<User>
  logout: () => void
  refreshCurrentUser: () => Promise<User | null>
}
