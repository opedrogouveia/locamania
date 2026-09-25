import { Injectable } from '@nestjs/common';
import type { StaffRole } from '@prisma/client';
import type { DeliveryStatus, NotificationChannel, NotificationRecipientType, NotificationSeverity } from '@locamania/shared';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  NotificationContent,
  NotificationRecord,
  NotificationsRepository,
  Recipient,
  WhatsAppChannel,
} from '../domain/notifications.ports';

@Injectable()
export class PrismaNotificationsRepository implements NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createMany(recipients: Recipient[], content: NotificationContent): Promise<{ id: string; recipient: Recipient }[]> {
    const out: { id: string; recipient: Recipient }[] = [];
    for (const recipient of recipients) {
      if (content.dedupeKey) {
        const exists = await this.prisma.raw.notification.findFirst({
          where: { recipientType: recipient.type, recipientId: recipient.id, dedupeKey: content.dedupeKey },
          select: { id: true },
        });
        if (exists) continue;
      }
      try {
        const n = await this.prisma.raw.notification.create({
          data: {
            recipientType: recipient.type,
            recipientId: recipient.id,
            type: content.type,
            title: content.title,
            body: content.body,
            severity: content.severity,
            link: content.link ?? null,
            entityType: content.entityType ?? null,
            entityId: content.entityId ?? null,
            dedupeKey: content.dedupeKey ?? null,
          },
          select: { id: true },
        });
        out.push({ id: n.id, recipient });
      } catch {
        // Corrida entre dois jobs: a unicidade do banco segura a duplicata.
      }
    }
    return out;
  }

  async addDelivery(notificationId: string, channel: NotificationChannel, status: DeliveryStatus, detail: string | null): Promise<void> {
    await this.prisma.raw.notificationDelivery.create({ data: { notificationId, channel, status, detail } });
  }

  async list(
    recipientType: NotificationRecipientType,
    recipientId: string,
    params: { skip: number; take: number; unreadOnly?: boolean; severity?: NotificationSeverity },
  ): Promise<{ items: NotificationRecord[]; total: number }> {
    const where = {
      recipientType,
      recipientId,
      ...(params.unreadOnly ? { readAt: null } : {}),
      ...(params.severity ? { severity: params.severity } : {}),
    };
    const [items, total] = await this.prisma.raw.$transaction([
      this.prisma.raw.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: { deliveries: { select: { channel: true, status: true, detail: true } } },
      }),
      this.prisma.raw.notification.count({ where }),
    ]);
    return { items, total };
  }

  unreadCount(recipientType: NotificationRecipientType, recipientId: string): Promise<number> {
    return this.prisma.raw.notification.count({ where: { recipientType, recipientId, readAt: null } });
  }

  async markRead(recipientType: NotificationRecipientType, recipientId: string, ids: string[] | 'all'): Promise<void> {
    await this.prisma.raw.notification.updateMany({
      where: { recipientType, recipientId, readAt: null, ...(ids === 'all' ? {} : { id: { in: ids } }) },
      data: { readAt: new Date() },
    });
  }

  async customerRecipient(customerId: string) {
    const c = await this.prisma.raw.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true, name: true, email: true, whatsapp: true, phone: true, portalEnabled: true },
    });
    return c
      ? { type: 'CUSTOMER' as const, id: c.id, name: c.name, email: c.email, phone: c.whatsapp ?? c.phone, portalEnabled: c.portalEnabled }
      : null;
  }

  async staffRecipients(roles: string[]): Promise<Recipient[]> {
    const users = await this.prisma.raw.user.findMany({
      where: { active: true, deletedAt: null, role: { in: roles as StaffRole[] } },
      select: { id: true, name: true, email: true, phone: true },
    });
    return users.map((u) => ({ type: 'USER' as const, id: u.id, name: u.name, email: u.email, phone: u.phone }));
  }
}

/**
 * WhatsApp "desligado": registra que não enviou e por quê. A integração oficial
 * (WhatsApp Business Platform, templates aprovados pela Meta) entra num novo
 * adaptador desta porta, sem mexer em quem notifica.
 */
@Injectable()
export class DisabledWhatsAppChannel implements WhatsAppChannel {
  readonly configured = false;

  async send(): Promise<{ status: DeliveryStatus; detail: string }> {
    return { status: 'SKIPPED', detail: 'Integração oficial do WhatsApp não configurada' };
  }
}
