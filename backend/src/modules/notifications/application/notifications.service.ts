import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ParameterKey,
  Permission,
  STAFF_ROLES,
  whatsappLink,
  type ListNotificationsQuery,
  type NotificationDto,
  type NotificationRecipientType,
  type PaginatedResponse,
  type UnreadCountDto,
} from '@locamania/shared';

import { PermissionsService } from '../../../shared/auth/permissions.service';
import type { AppConfig } from '../../../shared/config/configuration';
import { iso } from '../../../shared/http/mappers';
import { paginated, pageParams } from '../../../shared/http/pagination';
import { MailService } from '../../../shared/mail/mail.service';
import { ParametersService } from '../../../shared/parameters/parameters.service';
import {
  NOTIFICATIONS_REPOSITORY,
  WHATSAPP_CHANNEL,
  type NotificationContent,
  type NotificationRecord,
  type NotificationsRepository,
  type Recipient,
  type WhatsAppChannel,
} from '../domain/notifications.ports';

export interface CustomerNotifyOptions {
  /** E-mail junto com o aviso no app (se o cliente tiver e-mail e o canal estiver ligado). */
  email?: { subject: string; paragraphs: string[]; button?: { label: string; path: string } };
  /** Texto para o WhatsApp (envio automático quando houver integração; senão, link wa.me na tela). */
  whatsappText?: string;
}

/**
 * Serviço único de notificação (§18). Toda notificação do sistema passa por
 * aqui — nunca criar `Notification` direto:
 *
 * - uma linha por destinatário, com "lido" próprio;
 * - `dedupeKey` impede aviso repetido (o job pode rodar duas vezes);
 * - cada canal (app, e-mail, WhatsApp) registra a entrega, inclusive "pulado"
 *   com o motivo — dá para responder "o cliente foi avisado?".
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY) private readonly repo: NotificationsRepository,
    @Inject(WHATSAPP_CHANNEL) private readonly whatsapp: WhatsAppChannel,
    private readonly mail: MailService,
    private readonly params: ParametersService,
    private readonly permissions: PermissionsService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Avisa um cliente. Devolve se foi criado (false = já tinha sido avisado com essa chave). */
  async notifyCustomer(customerId: string, content: NotificationContent, options: CustomerNotifyOptions = {}): Promise<boolean> {
    const recipient = await this.repo.customerRecipient(customerId);
    if (!recipient) return false;
    const created = await this.repo.createMany([recipient], content);
    if (created.length === 0) return false;
    const { id } = created[0]!;
    await this.repo.addDelivery(id, 'IN_APP', recipient.portalEnabled ? 'SENT' : 'SKIPPED', recipient.portalEnabled ? null : 'Cliente ainda sem acesso ao app');

    if (options.email) {
      const enabled = await this.params.bool(ParameterKey.EMAIL_ENABLED);
      if (!enabled) await this.repo.addDelivery(id, 'EMAIL', 'SKIPPED', 'Envio por e-mail desligado nas configurações');
      else if (!recipient.email) await this.repo.addDelivery(id, 'EMAIL', 'SKIPPED', 'Cliente sem e-mail cadastrado');
      else {
        const base = this.config.get('appPublicUrl', { infer: true });
        const result = await this.mail.send({
          to: recipient.email,
          subject: options.email.subject,
          title: content.title,
          greeting: `Olá, ${recipient.name.split(' ')[0]}!`,
          paragraphs: options.email.paragraphs,
          button: options.email.button ? { label: options.email.button.label, url: `${base}${options.email.button.path}` } : undefined,
        });
        await this.repo.addDelivery(id, 'EMAIL', result.sent ? 'SENT' : 'FAILED', result.detail);
      }
    }

    if (options.whatsappText) {
      const enabled = await this.params.bool(ParameterKey.WHATSAPP_ENABLED);
      if (!enabled || !this.whatsapp.configured) {
        await this.repo.addDelivery(id, 'WHATSAPP', 'SKIPPED', 'Integração oficial do WhatsApp não configurada — use o botão de enviar pelo WhatsApp');
      } else if (!recipient.phone) {
        await this.repo.addDelivery(id, 'WHATSAPP', 'SKIPPED', 'Cliente sem WhatsApp cadastrado');
      } else {
        const r = await this.whatsapp.send(recipient.phone, options.whatsappText);
        await this.repo.addDelivery(id, 'WHATSAPP', r.status, r.detail);
      }
    }
    return true;
  }

  /** Avisa a equipe (quem tem a permissão). Só no app — e-mail para a equipe viraria ruído. */
  async notifyStaff(content: NotificationContent, permission: Permission = Permission.DASHBOARD_VIEW): Promise<number> {
    const matrix = await this.permissions.matrix();
    const roles = STAFF_ROLES.filter((r) => matrix[r].includes(permission));
    const recipients = await this.repo.staffRecipients(roles);
    const created = await this.repo.createMany(recipients, content);
    for (const c of created) await this.repo.addDelivery(c.id, 'IN_APP', 'SENT', null);
    return created.length;
  }

  async list(recipientType: NotificationRecipientType, recipientId: string, query: ListNotificationsQuery): Promise<PaginatedResponse<NotificationDto>> {
    const p = pageParams(query, 30);
    const { items, total } = await this.repo.list(recipientType, recipientId, {
      skip: p.skip,
      take: p.take,
      unreadOnly: query.unreadOnly,
      severity: query.severity,
    });
    const phones = recipientType === 'USER' ? await this.customerPhones(items) : new Map<string, string | null>();
    return paginated(items.map((n) => this.toDto(n, phones)), total, p);
  }

  async unread(recipientType: NotificationRecipientType, recipientId: string): Promise<UnreadCountDto> {
    return { unread: await this.repo.unreadCount(recipientType, recipientId) };
  }

  markRead(recipientType: NotificationRecipientType, recipientId: string, ids: string[] | 'all'): Promise<void> {
    return this.repo.markRead(recipientType, recipientId, ids);
  }

  /** Para a equipe: aviso sobre um cliente ganha o botão "Enviar pelo WhatsApp" com o texto. */
  private async customerPhones(items: NotificationRecord[]): Promise<Map<string, string | null>> {
    const ids = [...new Set(items.filter((n) => n.entityType === 'Customer' && n.entityId).map((n) => n.entityId!))];
    const map = new Map<string, string | null>();
    for (const id of ids) {
      const r = await this.repo.customerRecipient(id);
      map.set(id, r?.phone ?? null);
    }
    return map;
  }

  private toDto(n: NotificationRecord, phones: Map<string, string | null>): NotificationDto {
    const phone = n.entityType === 'Customer' && n.entityId ? phones.get(n.entityId) : null;
    return {
      id: n.id,
      type: n.type as NotificationDto['type'],
      title: n.title,
      body: n.body,
      severity: n.severity,
      link: n.link,
      entityType: n.entityType,
      entityId: n.entityId,
      readAt: iso(n.readAt),
      createdAt: iso(n.createdAt),
      whatsappLink: phone ? whatsappLink(phone, `${n.title}\n${n.body}`) : null,
      deliveries: n.deliveries,
    };
  }

  log(message: string): void {
    this.logger.log(message);
  }
}

export type { Recipient };
