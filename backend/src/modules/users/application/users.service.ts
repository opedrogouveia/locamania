import { Inject, Injectable } from '@nestjs/common';
import {
  ALL_PERMISSIONS,
  isPermission,
  PERMISSION_CATALOG,
  STAFF_ROLES,
  type CreateUserRequest,
  type PermissionMeta,
  type RolePermissionsDto,
  type StaffRole,
  type UpdateProfileRequest,
  type UpdateUserRequest,
  type UserDto,
} from '@locamania/shared';

import { PermissionsService } from '../../../shared/auth/permissions.service';
import type { StaffPrincipal } from '../../../shared/auth/principal';
import { SessionResolverService } from '../../../shared/auth/session-resolver.service';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/domain-errors';
import { iso } from '../../../shared/http/mappers';
import { PASSWORD_HASHER, type PasswordHasher } from '../../../shared/security/password-hasher.port';
import { assertPasswordStrong } from '../../auth/domain/password-rules';
import { assertKeepsAnOwner, assertNotLockingSelfOut, normalizeEmail } from '../domain/user-rules';
import { USERS_REPOSITORY, type UserRecord, type UsersRepository } from '../domain/users.ports';

function toDto(u: UserRecord): UserDto {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    active: u.active,
    lastLoginAt: iso(u.lastLoginAt),
    createdAt: iso(u.createdAt),
  };
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly repo: UsersRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly permissions: PermissionsService,
    private readonly sessions: SessionResolverService,
  ) {}

  async list(): Promise<UserDto[]> {
    return (await this.repo.list()).map(toDto);
  }

  async create(input: CreateUserRequest): Promise<UserDto> {
    const email = normalizeEmail(input.email);
    if (await this.repo.findByEmail(email)) throw new ConflictError('Já existe um usuário com este e-mail.');
    assertPasswordStrong(input.password);
    const user = await this.repo.create({
      name: input.name.trim(),
      email,
      phone: input.phone ?? null,
      role: input.role,
      passwordHash: await this.hasher.hash(input.password),
    });
    return toDto(user);
  }

  async update(id: string, input: UpdateUserRequest, actor: StaffPrincipal): Promise<UserDto> {
    const target = await this.repo.findById(id);
    if (!target) throw new NotFoundError('Usuário não encontrado.');
    assertNotLockingSelfOut(id, actor.id, target, input);
    assertKeepsAnOwner(target, input, await this.repo.countActiveOwners(id));
    // Só o Proprietário cria outro Proprietário.
    if (input.role === 'OWNER' && actor.role !== 'OWNER') {
      throw new ValidationError('Só um Proprietário pode dar o perfil de Proprietário.');
    }
    if (input.email) {
      const email = normalizeEmail(input.email);
      const other = await this.repo.findByEmail(email);
      if (other && other.id !== id) throw new ConflictError('Já existe um usuário com este e-mail.');
      input = { ...input, email };
    }
    const updated = await this.repo.update(id, input);
    // Mudou papel ou foi desativado: vale na próxima requisição, não em 15 s.
    if (input.role !== undefined || input.active !== undefined) {
      if (input.active === false) await this.repo.endSessions(id);
      this.sessions.forget('staff', id);
    }
    return toDto(updated);
  }

  async setPassword(id: string, password: string): Promise<void> {
    if (!(await this.repo.findById(id))) throw new NotFoundError('Usuário não encontrado.');
    assertPasswordStrong(password);
    await this.repo.setPassword(id, await this.hasher.hash(password));
    this.sessions.forget('staff', id);
  }

  async endSessions(id: string): Promise<void> {
    if (!(await this.repo.findById(id))) throw new NotFoundError('Usuário não encontrado.');
    await this.repo.endSessions(id);
    this.sessions.forget('staff', id);
  }

  async archive(id: string, actor: StaffPrincipal): Promise<void> {
    const target = await this.repo.findById(id);
    if (!target) throw new NotFoundError('Usuário não encontrado.');
    if (id === actor.id) throw new ValidationError('Você não pode arquivar a sua própria conta.');
    assertKeepsAnOwner(target, { archived: true }, await this.repo.countActiveOwners(id));
    await this.repo.archive(id);
    this.sessions.forget('staff', id);
  }

  async updateProfile(actor: StaffPrincipal, input: UpdateProfileRequest): Promise<UserDto> {
    const updated = await this.repo.update(actor.id, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
    });
    this.sessions.forget('staff', actor.id);
    return toDto(updated);
  }

  catalog(): PermissionMeta[] {
    return PERMISSION_CATALOG;
  }

  async matrix(): Promise<RolePermissionsDto[]> {
    const m = await this.permissions.matrix();
    return STAFF_ROLES.map((role) => ({ role, permissions: m[role], locked: role === 'OWNER' }));
  }

  async setRolePermissions(role: StaffRole, permissions: string[]): Promise<RolePermissionsDto> {
    if (role === 'OWNER') throw new ValidationError('O Proprietário sempre tem todas as permissões.');
    const valid = [...new Set(permissions.filter(isPermission))];
    await this.repo.setRolePermissions(role, valid);
    this.permissions.invalidate();
    // Quem já está logado passa a valer a matriz nova na próxima requisição.
    this.sessions.forgetAllStaff();
    return { role, permissions: valid.length ? valid : [], locked: false };
  }

  allPermissions() {
    return ALL_PERMISSIONS;
  }
}
