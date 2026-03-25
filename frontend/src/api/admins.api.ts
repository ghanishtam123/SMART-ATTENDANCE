import { usersApi } from './users.api'
import type {
  AdminListQuery,
  CreateAdminPayload,
  UpdateAdminPayload,
  UpdateAdminStatusPayload,
} from '../types/admin'

export const adminsApi = {
  listAdmins: async (query: AdminListQuery = {}) =>
    usersApi.listUsers({
      ...query,
      role: 'admin',
    }),

  getAdminById: async (id: string) => usersApi.getUserById(id),

  createAdmin: async (payload: CreateAdminPayload) =>
    usersApi.createUser({
      ...payload,
      role: 'admin',
    }),

  updateAdmin: async (id: string, payload: UpdateAdminPayload) =>
    usersApi.updateUser(id, payload),

  updateAdminStatus: async (id: string, payload: UpdateAdminStatusPayload) =>
    usersApi.updateUserStatus(id, payload),
}
