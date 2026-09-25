'use client';

import { formatYmd, type PortalMaintenanceDto } from '@locamania/shared';
import { CalendarClock, Gauge, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';

import { MaintenanceDueBadge } from '@/components/ui/status-badge';
import { cn, formatKm } from '@/lib/utils';
import { Panel, PanelHeader, type Tone } from './kit';

export function maintenanceTone(m: Pick<PortalMaintenanceDto, 'status'> | null | undefined): Tone {
  if (!m) return 'muted';
  return m.status === 'OVERDUE' ? 'danger' : m.status === 'DUE_SOON' ? 'warning' : 'success';
}

/**
 * Próxima manutenção do jeito que o cliente precisa ver (§9): a frase pronta da
 * API ("Faltam aproximadamente 300 km…"), a data e o que falta — sem custo,
 * oficina ou dado interno.
 */
export function MaintenanceCard({
  maintenance,
  action,
  headerAction,
  className,
  title = 'Próxima manutenção',
}: {
  maintenance: PortalMaintenanceDto | null;
  action?: ReactNode;
  headerAction?: ReactNode;
  className?: string;
  title?: string;
}) {
  const tone = maintenanceTone(maintenance);
  return (
    <Panel className={cn(maintenance?.status === 'OVERDUE' && 'border-destructive/40', maintenance?.status === 'DUE_SOON' && 'border-warning/50', className)}>
      <PanelHeader icon={Wrench} tone={tone} title={title} action={headerAction} />
      {!maintenance ? (
        <p className="text-[15px] text-muted-foreground">Nenhuma manutenção prevista no momento.</p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <MaintenanceDueBadge status={maintenance.status} />
            <p className={cn('text-lg font-semibold leading-snug', maintenance.status === 'OVERDUE' && 'text-destructive')}>{maintenance.message}</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
            {maintenance.typeName && (
              <span className="inline-flex items-center gap-1.5">
                <Wrench className="size-4" aria-hidden /> {maintenance.typeName}
              </span>
            )}
            {maintenance.nextDate && !maintenance.message.includes(formatYmd(maintenance.nextDate)) && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-4" aria-hidden /> Até {formatYmd(maintenance.nextDate)}
              </span>
            )}
            {maintenance.kmRemaining !== null && maintenance.kmRemaining > 0 && !/\bkm\b/.test(maintenance.message) && (
              <span className="inline-flex items-center gap-1.5">
                <Gauge className="size-4" aria-hidden /> Faltam {formatKm(maintenance.kmRemaining)}
              </span>
            )}
          </div>
          {action && <div className="pt-1">{action}</div>}
        </div>
      )}
    </Panel>
  );
}
