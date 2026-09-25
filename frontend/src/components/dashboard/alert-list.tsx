'use client';

import type { DashboardAlertDto } from '@locamania/shared';
import { AlertOctagon, AlertTriangle, CheckCircle2, ChevronRight, Info, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { cn, formatYmdShort } from '@/lib/utils';

const ICON: Record<DashboardAlertDto['severity'], { icon: LucideIcon; cls: string; label: string }> = {
  DANGER: { icon: AlertOctagon, cls: 'bg-destructive/12 text-destructive', label: 'Urgente' },
  WARNING: { icon: AlertTriangle, cls: 'bg-warning/15 text-warning', label: 'Atenção' },
  SUCCESS: { icon: CheckCircle2, cls: 'bg-success/12 text-success', label: 'Confirmado' },
  INFO: { icon: Info, cls: 'bg-info/12 text-info', label: 'Informação' },
};

/** Linha de alerta: ícone + rótulo (nunca só cor), título, detalhe e atalho. */
export function AlertRow({ alert }: { alert: DashboardAlertDto }) {
  const meta = ICON[alert.severity];
  return (
    <Link href={alert.link} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/50 active:bg-muted/70 sm:px-5">
      <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg', meta.cls)}>
        <meta.icon className="size-4" aria-hidden />
        <span className="sr-only">{meta.label}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{alert.title}</p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{alert.description}</p>
      </div>
      {alert.date && <span className="mt-0.5 hidden shrink-0 text-xs text-muted-foreground tabular sm:block">{formatYmdShort(alert.date)}</span>}
      <ChevronRight className="mt-1.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

export const ALERT_GROUPS = {
  all: { label: 'Todos', kinds: null },
  payments: { label: 'Pagamentos', kinds: ['PAYMENT_OVERDUE', 'PAYMENT_DUE_SOON', 'PAYMENT_CONFIRMED'] },
  maintenance: { label: 'Manutenção', kinds: ['MAINTENANCE_OVERDUE', 'MAINTENANCE_DUE_SOON'] },
  documents: { label: 'Documentos', kinds: ['DOCUMENT_EXPIRED', 'DOCUMENT_EXPIRING'] },
  fleet: { label: 'Frota e contratos', kinds: ['CONTRACT_ENDING', 'OCCURRENCE_CREATED', 'MOTORCYCLE_IDLE'] },
} as const;
export type AlertGroup = keyof typeof ALERT_GROUPS;

export function alertsOf(alerts: DashboardAlertDto[], group: AlertGroup): DashboardAlertDto[] {
  const kinds = ALERT_GROUPS[group].kinds as readonly string[] | null;
  return kinds ? alerts.filter((a) => kinds.includes(a.kind)) : alerts;
}
