import { Inject, Injectable } from '@nestjs/common';
import {
  Permission,
  type AnnouncementDto,
  type AnswerSupportMessageRequest,
  type CreateAnnouncementRequest,
  type CreateSupportMessageRequest,
  type PaginatedResponse,
  type SupportMessageDto,
  type SupportMessageStatus,
} from '@locamania/shared';

import type { StaffPrincipal } from '../../../shared/auth/principal';
import { NotFoundError, ValidationError } from '../../../shared/errors/domain-errors';
import { iso } from '../../../shared/http/mappers';
import { paginated, pageParams } from '../../../shared/http/pagination';
import { NotificationsService } from '../../notifications/application/notifications.service';

export const COMMUNICATION_REPOSITORY = Symbol('CommunicationRepository');

export interface SupportRow {
  id: string;
  customer: { id: string; name: string };
  subject: string;
  body: string;
  status: SupportMessageStatus;
  answer: string | null;
  answeredByName: string | null;
  answeredAt: Date | null;
  createdAt: Date;
}

export interface CommunicationRepository {
  announcements(skip: number, take: number): Promise<{ items: (Omit<AnnouncementDto, 'createdAt' | 'createdBy'> & { createdAt: Date; createdByName: string | null })[]; total: number }>;
  createAnnouncement(data: { title: string; body: string; audience: 'ALL_ACTIVE' | 'SELECTED'; recipientsCount: number; createdById: string }): Promise<string>;
  activeCustomerIds(): Promise<string[]>;
  support(filter: { status?: SupportMessageStatus; customerId?: string; skip: number; take: number }): Promise<{ items: SupportRow[]; total: number }>;
  findSupport(id: string): Promise<SupportRow | null>;
  createSupport(customerId: string, subject: string, body: string): Promise<string>;
  answerSupport(id: string, answer: string, close: boolean, userId: string): Promise<void>;
  closeSupport(id: string): Promise<void>;
}

@Injectable()
export class CommunicationService {
  constructor(
    @Inject(COMMUNICATION_REPOSITORY) private readonly repo: CommunicationRepository,
    private readonly notifications: NotificationsService,
  ) {}

  async announcements(page = 1, pageSize = 20): Promise<PaginatedResponse<AnnouncementDto>> {
    const p = pageParams({ page, pageSize });
    const { items, total } = await this.repo.announcements(p.skip, p.take);
    return paginated(items.map((a) => ({ ...a, createdBy: a.createdByName, createdAt: iso(a.createdAt) })), total, p);
  }

  /** Aviso da Locamania (§18): vira notificação para cada cliente (e e-mail, se pedido). */
  async announce(input: CreateAnnouncementRequest, actor: StaffPrincipal): Promise<{ recipients: number }> {
    if (!input.title.trim() || !input.body.trim()) throw new ValidationError('Informe o título e a mensagem.');
    const ids = input.audience === 'SELECTED' ? [...new Set(input.customerIds ?? [])] : await this.repo.activeCustomerIds();
    if (!ids.length) throw new ValidationError('Nenhum cliente para receber o aviso.');
    const announcementId = await this.repo.createAnnouncement({
      title: input.title.trim(),
      body: input.body.trim(),
      audience: input.audience,
      recipientsCount: ids.length,
      createdById: actor.id,
    });
    let recipients = 0;
    for (const customerId of ids) {
      const ok = await this.notifications.notifyCustomer(
        customerId,
        {
          type: 'ANNOUNCEMENT',
          title: input.title.trim(),
          body: input.body.trim(),
          severity: 'INFO',
          link: '/app/notifications',
          entityType: 'Announcement',
          entityId: announcementId,
          dedupeKey: `announcement:${announcementId}`,
        },
        input.sendEmail ? { email: { subject: `${input.title.trim()} — Locamania`, paragraphs: input.body.trim().split(/\n+/) } } : {},
      );
      if (ok) recipients += 1;
    }
    return { recipients };
  }

  private toDto(r: SupportRow): SupportMessageDto {
    return {
      id: r.id,
      customer: { id: r.customer.id, label: r.customer.name },
      subject: r.subject,
      body: r.body,
      status: r.status,
      answer: r.answer,
      answeredBy: r.answeredByName,
      answeredAt: iso(r.answeredAt),
      createdAt: iso(r.createdAt),
    };
  }

  async support(filter: { status?: SupportMessageStatus; customerId?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<SupportMessageDto>> {
    const p = pageParams(filter);
    const { items, total } = await this.repo.support({ status: filter.status, customerId: filter.customerId, skip: p.skip, take: p.take });
    return paginated(items.map((r) => this.toDto(r)), total, p);
  }

  async sendSupport(customerId: string, input: CreateSupportMessageRequest): Promise<SupportMessageDto> {
    if (!input.subject.trim() || !input.body.trim()) throw new ValidationError('Escreva o assunto e a mensagem.');
    const id = await this.repo.createSupport(customerId, input.subject.trim(), input.body.trim());
    const row = (await this.repo.findSupport(id))!;
    await this.notifications.notifyStaff(
      {
        type: 'SUPPORT_MESSAGE',
        title: `Mensagem de cliente — ${row.customer.name}`,
        body: `${row.subject}: ${row.body.slice(0, 140)}`,
        severity: 'INFO',
        link: '/admin/support',
        entityType: 'Customer',
        entityId: customerId,
        dedupeKey: `support:${id}`,
      },
      Permission.SUPPORT_MANAGE,
    );
    return this.toDto(row);
  }

  async answer(id: string, input: AnswerSupportMessageRequest, actor: StaffPrincipal): Promise<SupportMessageDto> {
    const row = await this.repo.findSupport(id);
    if (!row) throw new NotFoundError('Mensagem não encontrada.');
    if (!input.answer.trim()) throw new ValidationError('Escreva a resposta.');
    await this.repo.answerSupport(id, input.answer.trim(), input.close ?? false, actor.id);
    await this.notifications.notifyCustomer(
      row.customer.id,
      {
        type: 'SUPPORT_REPLY',
        title: 'A Locamania respondeu sua mensagem',
        body: `${row.subject}: ${input.answer.trim().slice(0, 200)}`,
        severity: 'INFO',
        link: '/app/support',
        entityType: 'SupportMessage',
        entityId: id,
        dedupeKey: `support:${id}:answer:${Date.now()}`,
      },
      { email: { subject: 'Resposta da Locamania', paragraphs: [`Sobre "${row.subject}":`, input.answer.trim()] } },
    );
    return this.toDto((await this.repo.findSupport(id))!);
  }

  async close(id: string): Promise<SupportMessageDto> {
    if (!(await this.repo.findSupport(id))) throw new NotFoundError('Mensagem não encontrada.');
    await this.repo.closeSupport(id);
    return this.toDto((await this.repo.findSupport(id))!);
  }
}
