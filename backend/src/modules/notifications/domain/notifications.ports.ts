import type {
  DeliveryStatus,
  NotificationChannel,
  NotificationRecipientType,
  NotificationSeverity,
  NotificationType,
  Permission,
} from '@locamania/shared';

export const NOTIFICATIONS_REPOSITORY = Symbol('NotificationsRepository');
export const WHATSAPP_CHANNEL = Symbol('WhatsAppChannel');

export interface NotificationContent {
  type: NotificationType;
  title: string;
  body: string;
  severity: NotificationSeverity;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  /** Chave do evento. Mesmo destinatário + mesma chave = não repete. */
  dedupeKey?: string | null;
}

export interface NotificationRecord {
  id: string;
  recipientType: NotificationRecipientType;
  recipientId: string;
  type: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  link: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: Date | null;
  createdAt: Date;
  deliveries: { channel: NotificationChannel; status: DeliveryStatus; detail: string | null }[];
}

export interface Recipient {
  type: NotificationRecipientType;
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface NotificationsRepository {
  /** Cria para cada destinatário, pulando quem já recebeu a mesma chave. Devolve só os criados. */
  createMany(recipients: Recipient[], content: NotificationContent): Promise<{ id: string; recipient: Recipient }[]>;
  addDelivery(notificationId: string, channel: NotificationChannel, status: DeliveryStatus, detail: string | null): Promise<void>;
  list(recipientType: NotificationRecipientType, recipientId: string, params: { skip: number; take: number; unreadOnly?: boolean; severity?: NotificationSeverity }): Promise<{ items: NotificationRecord[]; total: number }>;
  unreadCount(recipientType: NotificationRecipientType, recipientId: string): Promise<number>;
  markRead(recipientType: NotificationRecipientType, recipientId: string, ids: string[] | 'all'): Promise<void>;

  customerRecipient(customerId: string): Promise<(Recipient & { portalEnabled: boolean }) | null>;
  /** Usuários ativos que têm a permissão (pela matriz atual). */
  staffRecipients(roles: string[]): Promise<Recipient[]>;
}

/** Porta do WhatsApp: hoje "desligado"; a integração oficial entra aqui. */
export interface WhatsAppChannel {
  readonly configured: boolean;
  send(to: string, text: string): Promise<{ status: DeliveryStatus; detail: string }>;
}

export interface StaffAudience {
  /** Quem tem esta permissão recebe (padrão: dashboard.view = toda a equipe). */
  permission?: Permission;
}
