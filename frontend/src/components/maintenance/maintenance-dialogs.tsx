'use client';

import { Permission, type MaintenanceRecordDto } from '@locamania/shared';
import { Ban, CheckCircle2, ExternalLink, Pencil, Play } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import { Plate } from '@/components/motorcycles/plate';
import { DocumentsPanel } from '@/components/shared/documents-panel';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DetailList } from '@/components/ui/kit';
import { Skeleton } from '@/components/ui/skeleton';
import { MaintenanceStatusBadge } from '@/components/ui/status-badge';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { useMaintenanceRecord } from '@/lib/motorcycles/queries';
import { useUpdateMaintenance } from '@/lib/queries';
import { cn, formatBRL, formatDateTime, formatKm, formatYmd } from '@/lib/utils';
import { CompleteMaintenanceDialog } from './complete-dialog';
import { MaintenanceFormDialog, type MaintenancePreset } from './maintenance-form-dialog';

/** Ficha de um registro de manutenção (abre pelo link `?record=`), com fotos e ações. */
function RecordSheet({
  id,
  open,
  onOpenChange,
  onStart,
  onComplete,
  onEdit,
  onCancel,
}: {
  id: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStart: (r: MaintenanceRecordDto) => void;
  onComplete: (r: MaintenanceRecordDto) => void;
  onEdit: (r: MaintenanceRecordDto) => void;
  onCancel: (r: MaintenanceRecordDto) => void;
}) {
  const { data: r, isLoading, error } = useMaintenanceRecord(open ? id : null);
  const canManage = useCan(Permission.MAINTENANCE_MANAGE);
  const canFinance = useCan(Permission.FINANCE_VIEW);
  const canDocs = useCan(Permission.DOCUMENTS_VIEW);
  const open_ = r && (r.status === 'SCHEDULED' || r.status === 'IN_PROGRESS');

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-2xl">
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : error || !r ? (
        <div className="space-y-2 py-4">
          <p className="font-medium">Manutenção não encontrada</p>
          <p className="text-sm text-destructive">{errorMessage(error)}</p>
        </div>
      ) : (
        <div className="space-y-5">
          <DialogHeader>
            <DialogTitle>{r.types.map((t) => t.name).join(', ') || 'Manutenção'}</DialogTitle>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
              <MaintenanceStatusBadge status={r.status} />
              <Link
                href={`/admin/motorcycles/${r.motorcycle.id}?tab=maintenance`}
                className="inline-flex min-h-8 items-center gap-2 font-medium text-primary hover:underline"
              >
                <Plate plate={r.motorcycle.plate} /> {r.motorcycle.label}
                <ExternalLink className="size-3.5 opacity-70" aria-hidden />
              </Link>
            </div>
          </DialogHeader>
          <DetailList
            className="grid-cols-2"
            items={[
              ...(r.scheduledFor
                ? [{ label: 'Agendada para', value: formatYmd(r.scheduledFor) }]
                : []),
              ...(r.startedAt ? [{ label: 'Início', value: formatYmd(r.startedAt) }] : []),
              ...(r.completedAt
                ? [{ label: 'Concluída em', value: formatYmd(r.completedAt) }]
                : []),
              { label: 'Quilometragem', value: r.km !== null ? formatKm(r.km) : null },
              { label: 'Oficina', value: r.workshop },
              ...(canFinance
                ? [{ label: 'Valor', value: r.cost !== null ? formatBRL(r.cost) : null }]
                : []),
              ...(r.parts
                ? [
                    {
                      label: 'Peças trocadas',
                      value: <span className="whitespace-pre-line">{r.parts}</span>,
                      wide: true,
                    },
                  ]
                : []),
              ...(r.notes
                ? [
                    {
                      label: 'Observações',
                      value: <span className="whitespace-pre-line">{r.notes}</span>,
                      wide: true,
                    },
                  ]
                : []),
              {
                label: 'Registrada por',
                value: `${r.createdBy ?? 'Sistema'} · ${formatDateTime(r.createdAt)}`,
                wide: true,
              },
            ]}
          />
          {canDocs && (
            <DocumentsPanel
              ownerType="MAINTENANCE"
              ownerId={r.id}
              title="Fotos e comprovantes"
              defaultType="MAINTENANCE_RECEIPT"
            />
          )}
          {canManage && open_ && (
            <>
              <button
                type="button"
                onClick={() => onCancel(r)}
                className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-destructive hover:underline"
              >
                <Ban className="size-4" />{' '}
                {r.status === 'SCHEDULED' ? 'Cancelar agendamento' : 'Cancelar manutenção'}
              </button>
              <DialogFooter>
                <div
                  className={cn(
                    'grid gap-2 sm:flex',
                    r.status === 'SCHEDULED' ? 'grid-cols-2' : 'grid-cols-1',
                  )}
                >
                  <Button type="button" variant="outline" onClick={() => onEdit(r)}>
                    <Pencil /> Editar
                  </Button>
                  {r.status === 'SCHEDULED' && (
                    <Button type="button" variant="outline" onClick={() => onStart(r)}>
                      <Play /> Iniciar agora
                    </Button>
                  )}
                </div>
                <Button type="button" onClick={() => onComplete(r)}>
                  <CheckCircle2 /> Concluir
                </Button>
              </DialogFooter>
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}

type State =
  | { kind: 'none' }
  | { kind: 'record'; id: string }
  | { kind: 'complete'; record: MaintenanceRecordDto }
  | { kind: 'edit'; record: MaintenanceRecordDto }
  | { kind: 'new'; preset: MaintenancePreset | null };

/**
 * Todos os diálogos de manutenção num lugar só (um aberto por vez — nada de
 * diálogo em cima de diálogo no celular). A tela chama `openRecord`, `openNew`,
 * `openComplete` e coloca `dialogs` no JSX.
 */
export function useMaintenanceDialogs({ onRecordClosed }: { onRecordClosed?: () => void } = {}) {
  const [state, setState] = useState<State>({ kind: 'none' });
  const update = useUpdateMaintenance();
  const confirm = useConfirm();

  // Saiu da ficha do registro (para outro diálogo ou fechando): limpa o `?record=` da URL.
  const go = useCallback(
    (next: State) => {
      if (state.kind === 'record' && next.kind !== 'record') onRecordClosed?.();
      setState(next);
    },
    [state.kind, onRecordClosed],
  );
  const close = useCallback(() => go({ kind: 'none' }), [go]);

  const openRecord = useCallback((id: string) => setState({ kind: 'record', id }), []);
  const openNew = useCallback(
    (preset: MaintenancePreset | null = null) => setState({ kind: 'new', preset }),
    [],
  );
  const openComplete = useCallback(
    (record: MaintenanceRecordDto) => setState({ kind: 'complete', record }),
    [],
  );

  const start = useCallback(
    async (r: MaintenanceRecordDto) => {
      try {
        await update.mutateAsync({ id: r.id, status: 'IN_PROGRESS' });
        toast.success('Manutenção iniciada', {
          description: 'A moto fica "Em manutenção" até concluir.',
        });
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [update],
  );

  const cancel = useCallback(
    async (r: MaintenanceRecordDto) => {
      go({ kind: 'none' });
      const ok = await confirm({
        title: r.status === 'SCHEDULED' ? 'Cancelar o agendamento?' : 'Cancelar a manutenção?',
        description:
          r.status === 'IN_PROGRESS'
            ? 'O registro fica no histórico como cancelado e a moto volta para a situação de antes (disponível ou alugada).'
            : 'O registro fica no histórico como cancelado. Os planos não mudam.',
        confirmText: 'Cancelar manutenção',
        cancelText: 'Voltar',
        variant: 'destructive',
      });
      if (!ok) return;
      try {
        await update.mutateAsync({ id: r.id, status: 'CANCELLED' });
        toast.success('Manutenção cancelada');
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [confirm, update, go],
  );

  const dialogs = useMemo(
    () => (
      <>
        <RecordSheet
          id={state.kind === 'record' ? state.id : null}
          open={state.kind === 'record'}
          onOpenChange={(v) => !v && close()}
          onStart={start}
          onComplete={(record) => go({ kind: 'complete', record })}
          onEdit={(record) => go({ kind: 'edit', record })}
          onCancel={cancel}
        />
        <CompleteMaintenanceDialog
          record={state.kind === 'complete' ? state.record : null}
          open={state.kind === 'complete'}
          onOpenChange={(v) => !v && close()}
        />
        <MaintenanceFormDialog
          open={state.kind === 'new' || state.kind === 'edit'}
          onOpenChange={(v) => !v && close()}
          preset={state.kind === 'new' ? state.preset : null}
          record={state.kind === 'edit' ? state.record : null}
        />
      </>
    ),
    [state, close, start, cancel, go],
  );

  return { openRecord, openNew, openComplete, start, dialogs };
}
