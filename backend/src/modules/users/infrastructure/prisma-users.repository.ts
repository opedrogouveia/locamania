import { Injectable } from '@nestjs/common';
import type { StaffRole } from '@locamania/shared';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { CreateUserData, UpdateUserData, UserRecord, UsersRepository } from '../domain/users.ports';

const SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  active: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<UserRecord[]> {
    return this.prisma.client.user.findMany({
      where: { deletedAt: null },
      select: SELECT,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  findById(id: string): Promise<UserRecord | null> {
    return this.prisma.client.user.findFirst({ where: { id, deletedAt: null }, select: SELECT });
  }

  findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.client.user.findFirst({ where: { email }, select: SELECT });
  }

  create(data: CreateUserData): Promise<UserRecord> {
    return this.prisma.client.user.create({ data, select: SELECT });
  }

  update(id: string, data: UpdateUserData): Promise<UserRecord> {
    return this.prisma.client.user.update({ where: { id }, data, select: SELECT });
  }

  async setPassword(id: string, passwordHash: string): Promise<void> {
    await this.prisma.client.user.update({ where: { id }, data: { passwordHash, sessionVersion: { increment: 1 } } });
  }

  async endSessions(id: string): Promise<void> {
    await this.prisma.client.user.update({ where: { id }, data: { sessionVersion: { increment: 1 } } });
  }

  async archive(id: string): Promise<void> {
    await this.prisma.client.user.update({
      where: { id },
      data: { deletedAt: new Date(), active: false, sessionVersion: { increment: 1 } },
    });
  }

  countActiveOwners(exceptId?: string): Promise<number> {
    return this.prisma.client.user.count({
      where: { role: 'OWNER', active: true, deletedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    });
  }

  getRolePermissions(): Promise<{ role: StaffRole; permissions: string[] }[]> {
    return this.prisma.client.rolePermission.findMany();
  }

  async setRolePermissions(role: StaffRole, permissions: string[]): Promise<void> {
    await this.prisma.client.rolePermission.upsert({
      where: { role },
      create: { role, permissions },
      update: { permissions },
    });
  }
}
