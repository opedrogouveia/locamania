'use client';

import {
  AUDIT_ACTION_LABELS,
  CHARGE_KIND_LABELS,
  CHARGE_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  CUSTOMER_STATUS_LABELS,
  MAINTENANCE_STATUS_LABELS,
  MOTORCYCLE_STATUS_LABELS,
  OCCURRENCE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PERIODICITY_LABELS,
  type AuditLogDto,
} from '@locamania/shared';
import { Bot, History, Smartphone, UserRound } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api/client';
import { useTimeline } from '@/lib/queries';
import { cn, formatBRL, formatDateTime, formatYmd } from '@/lib/utils';

const ENUM_LABELS: Record<string, string> = {
  ...MOTORCYCLE_STATUS_LABELS,
  ...CUSTOMER_STATUS_LABELS,
  ...CONTRACT_STATUS_LABELS,
  ...MAINTENANCE_STATUS_LABELS,
  ...OCCURRENCE_STATUS_LABELS,
  ...PERIODICITY_LABELS,
  ...CHARGE_KIND_LABELS,
  ...CHARGE_STATUS_LABELS,
  ...PAYMENT_METHOD_LABELS,
  PENDING: 'Pendente',
};

// Campos de dinheiro pelo nome exato/sufixo ("currentKm" contém "rent" e não é dinheiro).
const MONEY_FIELDS = /(^amount$|Amount$|Price$|^cost$|Cost$|^value$|^previousRent$|^fine$|^interest$|^discount$)/;

/** Valor de auditoria legível: enum → rótulo, data → dd/mm/aaaa, dinheiro → R$. */
export function formatAuditValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'vazio';
  if (typeof value === 'boolean') return value ? 'sim' : 'não';
  if (typeof value === 'number') return MONEY_FIELDS.test(field) ? formatBRL(value) : value.toLocaleString('pt-BR');
  if (typeof value !== 'string') return JSON.stringify(value);
  if (ENUM_LABELS[value]) return ENUM_LABELS[value]!.toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatYmd(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value.endsWith('T00:00:00.000Z') ? formatYmd(value.slice(0, 10)) : formatDateTime(value);
  if (/^-?\d+(\.\d{1,2})?$/.test(value) && MONEY_FIELDS.test(field)) return formatBRL(value);
  return value.length > 80 ? `${value.slice(0, 80)}…` : value;
}

const ACTOR_ICON = { USER: UserRound, CUSTOMER: Smartphone, SYSTEM: Bot } as const;

export function AuditEntry({ item, showEntity }: { item: AuditLogDto; showEntity?: boolean }) {
  const Icon = ACTOR_ICON[item.actorType] ?? UserRound;
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border last:hidden" aria-hidden />
      <span
        className={cn(
          'relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card',
          item.actorType === 'SYSTEM' ? 'text-muted-foreground' : item.actorType === 'CUSTOMER' ? 'text-info' : 'text-primary',
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-sm leading-snug">{item.summary}</p>
        {item.changedFields.length > 0 && item.action === 'UPDATE' && (
          <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
            {item.changedFields.slice(0, 6).map((f) => (
              <li key={f.field} className="break-words">
                <span className="font-medium text-foreground/80">{f.label}</span>
                {'from' in f && f.from !== undefined ? `: ${formatAuditValue(f.field, f.from)} → ${formatAuditValue(f.field, f.to)}` : `: ${formatAuditValue(f.field, f.to)}`}
              </li>
            ))}
            {item.changedFields.length > 6 && <li>e mais {item.changedFields.length - 6} campos</li>}
          </ul>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {formatDateTime(item.occurredAt)} · {AUDIT_ACTION_LABELS[item.action]}
          {showEntity && ` · ${item.entityType}`}
        </p>
      </div>
    </li>
  );
}

/** Linha do tempo da ficha (histórico da entidade, mais recente primeiro). */
export function Timeline({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, isFetching } = useTimeline(entityType, entityId, page);
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (error) return <p className="text-sm text-destructive">{errorMessage(error)}</p>;
  if (!data || data.data.length === 0) return <EmptyState icon={History} title="Sem histórico ainda" className="py-8" />;
  return (
    <div className="space-y-4">
      <ol className={cn(isFetching && 'opacity-60')}>
        {data.data.map((item) => (
          <AuditEntry key={item.id} item={item} />
        ))}
      </ol>
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
          <span>
            Página {data.page} de {data.totalPages}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Mais recentes
            </Button>
            <Button size="sm" variant="outline" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Mais antigos
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
