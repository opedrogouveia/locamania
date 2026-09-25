import type {
  AnnouncementAudience,
  DeliveryStatus,
  NotificationChannel,
  NotificationSeverity,
  NotificationType,
  SupportMessageStatus,
} from '../enums';
import type { EntityRef, PaginationQuery } from './common';

// ───────────────────────────── Notificações (§18) ─────────────────────────────

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  severity: NotificationSeverity;
  link: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
  /** Link wa.me com a mensagem pronta para o cliente, quando fizer sentido. */
  whatsappLink: string | null;
  deliveries: { channel: NotificationChannel; status: DeliveryStatus; detail: string | null }[];
}

export interface ListNotificationsQuery extends PaginationQuery {
  unreadOnly?: boolean;
  severity?: NotificationSeverity;
}

export interface UnreadCountDto {
  unread: number;
}

// ───────────────────────────── Avisos da Locamania ─────────────────────────────

export interface AnnouncementDto {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  recipientsCount: number;
  createdBy: string | null;
  createdAt: string;
}

export interface CreateAnnouncementRequest {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  customerIds?: string[];
  sendEmail?: boolean;
}

// ───────────────────────────── Suporte (§17) ─────────────────────────────

export interface SupportMessageDto {
  id: string;
  customer: EntityRef;
  subject: string;
  body: string;
  status: SupportMessageStatus;
  answer: string | null;
  answeredBy: string | null;
  answeredAt: string | null;
  createdAt: string;
}

export interface CreateSupportMessageRequest {
  subject: string;
  body: string;
}

export interface AnswerSupportMessageRequest {
  answer: string;
  close?: boolean;
}

export interface ListSupportMessagesQuery extends PaginationQuery {
  status?: SupportMessageStatus;
}
