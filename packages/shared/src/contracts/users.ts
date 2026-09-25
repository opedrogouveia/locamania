import type { StaffRole } from '../enums';
import type { Permission } from '../permissions';

export interface UserDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  phone?: string | null;
  role: StaffRole;
  password: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  phone?: string | null;
  role?: StaffRole;
  active?: boolean;
}

export interface SetUserPasswordRequest {
  password: string;
}

export interface RolePermissionsDto {
  role: StaffRole;
  permissions: Permission[];
  /** OWNER é travado com todas as permissões. */
  locked: boolean;
}

export interface UpdateRolePermissionsRequest {
  permissions: Permission[];
}

/** PATCH /me — o próprio usuário. */
export interface UpdateProfileRequest {
  name?: string;
  phone?: string | null;
}
