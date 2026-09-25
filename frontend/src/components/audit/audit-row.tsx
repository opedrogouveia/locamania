'use client';

import { ACTOR_TYPE_LABELS, AUDIT_ACTION_LABELS, ENTITY_LABELS, type AuditLogDto } from '@locamania/shared';
import { Bot, ChevronRight, Smartphone, UserRound } from 'lucide-react';
import Link from 'next/link';

import { formatAuditValue } from '@/components/shared/timeline';
import { auditEntityHref } from '@/lib/audit/links';
import { cn, formatKm } from '@/lib/utils';

const ACTOR_ICON = { USER: UserRound, CUSTOMER: Smartphone, SYSTEM: Bot } as const;

/** Quilometragem sai em km (o formatador genérico confunde "currentKm" com dinheiro). */
function fieldValue(field: string, value: unknown): string {
  if (/km$/i.test(field) && typeof value === 'number') return formatKm(value);
  return formatAuditValue(field, value);
}

const TIME = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

/** "cliente" → "Cliente". */
export function entityLabel(entityType: string): string {
  const l = ENTITY_LABELS[entityType] ?? entityType;
  return l.charAt(0).toUpperCase() + l.slice(1);
}

/**
 * Uma linha do histórico geral (§30): a frase pronta da API, o que mudou (de →
 * para) e o atalho para a ficha. Mesmo formato de valores da linha do tempo.
 */
export function AuditRow({ item }: { item: AuditLogDto }) {
  const Icon = ACTOR_ICON[item.actorType] ?? UserRound;
  const href = auditEntityHref(item.entityType, item.entityId);
  const showFields = item.changedFields.length > 0 && (item.action === 'UPDATE' || item.action === 'STATUS_CHANGE');
  return (
    <li className="flex gap-3 px-4 py-3.5 sm:px-5">
      <span
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card',
          item.actorType === 'SYSTEM' ? 'text-muted-foreground' : item.actorType === 'CUSTOMER' ? 'text-info' : 'text-primary',
        )}
        title={ACTOR_TYPE_LABELS[item.actorType]}
      >
        <Icon className="size-4" aria-hidden />
        <span className="sr-only">{ACTOR_TYPE_LABELS[item.actorType]}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">{item.summary}</p>
        {showFields && (
          <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
            {item.changedFields.slice(0, 6).map((f) => (
              <li key={f.field} className="break-words">
                <span className="font-medium text-foreground/80">{f.label.charAt(0).toUpperCase() + f.label.slice(1)}</span>
                {'from' in f && f.from !== undefined ? `: ${fieldValue(f.field, f.from)} → ${fieldValue(f.field, f.to)}` : `: ${fieldValue(f.field, f.to)}`}
              </li>
            ))}
            {item.changedFields.length > 6 && <li>e mais {item.changedFields.length - 6 === 1 ? '1 campo' : `${item.changedFields.length - 6} campos`}</li>}
          </ul>
        )}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="tabular">{TIME.format(new Date(item.occurredAt))}</span>
          <span aria-hidden>·</span>
          <span>{AUDIT_ACTION_LABELS[item.action]}</span>
          <span aria-hidden>·</span>
          <span>{entityLabel(item.entityType)}</span>
        </p>
      </div>
      {href && (
        <Link href={href} className="-mr-2 flex h-10 shrink-0 items-center gap-0.5 self-center rounded-md px-2 text-xs font-medium text-primary hover:bg-accent" aria-label={`Abrir ficha: ${item.summary}`}>
          <span className="hidden sm:inline">Abrir</span>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
    </li>
  );
}
