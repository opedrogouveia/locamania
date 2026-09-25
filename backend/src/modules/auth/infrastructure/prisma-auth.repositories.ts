import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  AuthAccounts,
  AuthTokens,
  CustomerAccount,
  StaffAccount,
  StoredToken,
  TokenPurpose,
} from '../domain/auth.ports';

@Injectable()
export class PrismaAuthAccounts implements AuthAccounts {
  constructor(private readonly prisma: PrismaService) {}

  private staff(u: {
    id: string; name: string; email: string; role: StaffAccount['role']; passwordHash: string;
    active: boolean; deletedAt: Date | null; sessionVersion: number;
  } | null): StaffAccount | null {
    return u
      ? { id: u.id, name: u.name, email: u.email, role: u.role, passwordHash: u.passwordHash, active: u.active, deleted: !!u.deletedAt, sessionVersion: u.sessionVersion }
      : null;
  }

  private customer(c: {
    id: string; name: string; email: string | null; cpf: string; passwordHash: string | null; portalEnabled: boolean;
    deletedAt: Date | null; sessionVersion: number; privacyAcceptedAt: Date | null;
  } | null): CustomerAccount | null {
    return c
      ? { id: c.id, name: c.name, email: c.email, cpf: c.cpf, passwordHash: c.passwordHash, portalEnabled: c.portalEnabled, deleted: !!c.deletedAt, sessionVersion: c.sessionVersion, privacyAcceptedAt: c.privacyAcceptedAt }
      : null;
  }

  async staffByEmail(email: string): Promise<StaffAccount | null> {
    return this.staff(await this.prisma.raw.user.findUnique({ where: { email } }));
  }

  async staffById(id: string): Promise<StaffAccount | null> {
    return this.staff(await this.prisma.raw.user.findUnique({ where: { id } }));
  }

  async customerByCpf(cpf: string): Promise<CustomerAccount | null> {
    return this.customer(await this.prisma.raw.customer.findUnique({ where: { cpf } }));
  }

  async customerById(id: string): Promise<CustomerAccount | null> {
    return this.customer(await this.prisma.raw.customer.findUnique({ where: { id } }));
  }

  async setStaffPassword(id: string, passwordHash: string): Promise<number> {
    const u = await this.prisma.client.user.update({
      where: { id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    return u.sessionVersion;
  }

  async setCustomerPassword(id: string, passwordHash: string, enablePortal: boolean): Promise<number> {
    const c = await this.prisma.client.customer.update({
      where: { id },
      data: { passwordHash, sessionVersion: { increment: 1 }, ...(enablePortal ? { portalEnabled: true } : {}) },
    });
    return c.sessionVersion;
  }

  // Último acesso não é alteração de negócio: grava sem auditoria (o LOGIN já é auditado).
  async touchStaffLogin(id: string): Promise<void> {
    await this.prisma.raw.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }

  async touchCustomerLogin(id: string): Promise<void> {
    await this.prisma.raw.customer.update({ where: { id }, data: { portalLastLoginAt: new Date() } });
  }

  async acceptPrivacy(customerId: string): Promise<void> {
    await this.prisma.client.customer.update({ where: { id: customerId }, data: { privacyAcceptedAt: new Date() } });
  }
}

@Injectable()
export class PrismaAuthTokens implements AuthTokens {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: { tokenHash: string; purpose: TokenPurpose; userId?: string; customerId?: string; expiresAt: Date }): Promise<void> {
    await this.prisma.raw.authToken.create({ data: input });
  }

  async findByHash(tokenHash: string): Promise<StoredToken | null> {
    return this.prisma.raw.authToken.findUnique({ where: { tokenHash } });
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.raw.authToken.update({ where: { id }, data: { usedAt: new Date() } });
  }

  async revokeFor(purpose: TokenPurpose, subject: { userId?: string; customerId?: string }): Promise<void> {
    await this.prisma.raw.authToken.updateMany({
      where: { purpose, usedAt: null, ...(subject.userId ? { userId: subject.userId } : { customerId: subject.customerId }) },
      data: { usedAt: new Date() },
    });
  }
}
