'use client';

import type { NotificationDto, NotificationSeverity, NotificationType } from '@locamania/shared';
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  FileText,
  Megaphone,
  MessageCircle,
  Receipt,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import { timeAgo } from '@/lib/portal/format';
import { cn } from '@/lib/utils';
import { ToneIcon, type Tone } from './kit';

const ICON: Partial<Record<NotificationType, LucideIcon>> = {
  PAYMENT_REMINDER: CalendarClock,
  PAYMENT_DUE_TODAY: Receipt,
  PAYMENT_OVERDUE: CircleAlert,
  PAYMENT_CONFIRMED: CheckCircle2,
  MAINTENANCE_DUE_SOON: Wrench,
  MAINTENANCE_OVERDUE: Wrench,
  CONTRACT_ENDING: FileText,
  CONTRACT_UPDATED: FileText,
  ANNOUNCEMENT: Megaphone,
  SUPPORT_REPLY: MessageCircle,
};

const TONE: Record<NotificationSeverity, Tone> = {
  DANGER: 'danger',
  WARNING: 'warning',
  SUCCESS: 'success',
  INFO: 'info',
};

/**
 * Um aviso: ícone na cor da gravidade, título, texto e "há 2 h". Não lido fica
 * em negrito com a bolinha azul. Tocar marca como lido e abre o link.
 */
export function NotificationRow({ n, onOpen, compact }: { n: NotificationDto; onOpen: (n: NotificationDto) => void; compact?: boolean }) {
  const unread = !n.readAt;
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={cn('flex w-full items-start gap-3 py-3.5 text-left transition-colors hover:bg-accent/40', unread && 'bg-primary/[0.04]')}
    >
      <ToneIcon icon={ICON[n.type] ?? Bell} tone={TONE[n.severity]} />
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span className={cn('min-w-0 flex-1 text-[15px] leading-snug', unread ? 'font-semibold' : 'font-medium')}>{n.title}</span>
          <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
        </span>
        <span className={cn('mt-0.5 block text-sm text-muted-foreground', compact ? 'line-clamp-1' : 'line-clamp-3')}>{n.body}</span>
      </span>
      {unread && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" aria-label="Não lido" />}
    </button>
  );
}
