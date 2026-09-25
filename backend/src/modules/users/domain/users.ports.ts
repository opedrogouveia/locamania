import type { StaffRole } from '@locamania/shared';

export const USERS_REPOSITORY = Symbol('UsersRepository');

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface CreateUserData {
  name: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  passwordHash: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  phone?: string | null;
  role?: StaffRole;
  active?: boolean;
}

export interface UsersRepository {
  list(): Promise<UserRecord[]>;
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  create(data: CreateUserData): Promise<UserRecord>;
  update(id: string, data: UpdateUserData): Promise<UserRecord>;
  setPassword(id: string, passwordHash: string): Promise<void>;
  /** Incrementa a versão da sessão: todos os aparelhos saem. */
  endSessions(id: string): Promise<void>;
  archive(id: string): Promise<void>;
  countActiveOwners(exceptId?: string): Promise<number>;
  getRolePermissions(): Promise<{ role: StaffRole; permissions: string[] }[]>;
  setRolePermissions(role: StaffRole, permissions: string[]): Promise<void>;
}
