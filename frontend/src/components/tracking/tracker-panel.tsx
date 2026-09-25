'use client';

import {
  Permission,
  TRACKER_COMMAND_LABELS,
  TRACKER_COMMAND_STATUS_LABELS,
  type TrackerCommandDto,
  type TrackerCommandStatus,
  type TrackerCommandType,
} from '@locamania/shared';
import { ExternalLink, FlaskConical, History, Lock, LockOpen, MapPin, Radio } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { DetailList, SectionCard } from '@/components/ui/kit';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { useTracking } from '@/lib/queries';
import { cn, formatDateTime } from '@/lib/utils';
import { TrackerCommandDialog } from './command-dialog';
import { agoText, communication, isBlocked, providerLabel } from './tracking-meta';

const STATUS_VARIANT: Record<
  TrackerCommandStatus,
  'success' | 'destructive' | 'info' | 'muted' | 'warning'
> = {
  REQUESTED: 'warning',
  SENT: 'info',
  CONFIRMED: 'success',
  FAILED: 'destructive',
  SIMULATED: 'muted',
};

export function CommandStatusBadge({ status }: { status: TrackerCommandStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{TRACKER_COMMAND_STATUS_LABELS[status]}</Badge>;
}

export function CommandTypeLabel({ type }: { type: TrackerCommandType }) {
  const Icon = type === 'BLOCK' ? Lock : LockOpen;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium',
        type === 'BLOCK' ? 'text-destructive' : 'text-success',
      )}
    >
      <Icon className="size-3.5" aria-hidden /> {TRACKER_COMMAND_LABELS[type]}
    </span>
  );
}

const TONE_DOT = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
} as const;
const TONE_TEXT = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
} as const;

/** Histórico de comandos (quem, quando, por quê e o que o equipamento respondeu). */
export function CommandHistory({
  commands,
  loading,
}: {
  commands: TrackerCommandDto[] | undefined;
  loading?: boolean;
}) {
  const columns: Column<TrackerCommandDto>[] = [
    {
      key: 'date',
      header: 'Quando',
      cell: (c) => (
        <span className="whitespace-nowrap tabular">{formatDateTime(c.requestedAt)}</span>
      ),
    },
    { key: 'type', header: 'Comando', cell: (c) => <CommandTypeLabel type={c.type} /> },
    { key: 'status', header: 'Resultado', cell: (c) => <CommandStatusBadge status={c.status} /> },
    {
      key: 'reason',
      header: 'Motivo',
      cell: (c) => <span className="line-clamp-2 max-w-xs text-sm">{c.reason}</span>,
    },
    {
      key: 'by',
      header: 'Por',
      hideBelow: 'lg',
      cell: (c) => <span className="whitespace-nowrap text-sm">{c.requestedBy ?? '—'}</span>,
    },
    {
      key: 'resp',
      header: 'Resposta do equipamento',
      hideBelow: 'xl',
      cell: (c) => (
        <span className="line-clamp-2 max-w-sm text-xs text-muted-foreground">
          {c.providerResponse ?? '—'}
        </span>
      ),
    },
  ];
  return (
    <DataTable
      rows={commands}
      loading={loading}
      columns={columns}
      rowKey={(c) => c.id}
      empty={{
        icon: History,
        title: 'Nenhum comando enviado',
        description: 'Bloqueios e desbloqueios ficam registrados aqui.',
      }}
      mobileCard={(c) => (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <CommandTypeLabel type={c.type} />
            <CommandStatusBadge status={c.status} />
          </div>
          <p className="text-sm">{c.reason}</p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(c.requestedAt)}
            {c.requestedBy ? ` · ${c.requestedBy}` : ''}
          </p>
        </div>
      )}
    />
  );
}

/**
 * Rastreamento de uma moto (§31, §32): comunicação, última posição (link do
 * Google Maps), equipamento, bloqueio/desbloqueio seguro e o histórico.
 */
export function TrackerPanel({ motorcycleId }: { motorcycleId: string }) {
  const canCommand = useCan(Permission.TRACKING_COMMAND);
  const { data: t, isLoading, error } = useTracking(motorcycleId);
  const [cmd, setCmd] = useState<TrackerCommandType | null>(null);

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (error || !t) return <p className="text-sm text-destructive">{errorMessage(error)}</p>;

  const com = communication(t);
  const blocked = isBlocked(t.lastCommand);
  const canBlock = canCommand && t.capabilities.block && !!t.deviceId;

  return (
    <div className="space-y-5">
      {t.sandbox && (
        <p className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/8 p-3 text-sm">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          <span>
            <strong className="font-medium">Ambiente de teste.</strong> Posição simulada; comandos
            ficam registrados, mas não chegam a nenhuma moto.
          </span>
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Comunicação">
          <div className="space-y-3">
            <p className={cn('flex items-center gap-2 text-lg font-semibold', TONE_TEXT[com.tone])}>
              <span
                className={cn(
                  'size-2.5 rounded-full',
                  TONE_DOT[com.tone],
                  com.tone === 'success' && 'animate-pulse',
                )}
                aria-hidden
              />
              {com.label}
            </p>
            <DetailList
              cols={1}
              items={[
                {
                  label: 'Última comunicação',
                  value: t.lastCommunicationAt
                    ? `${formatDateTime(t.lastCommunicationAt)} (${agoText(t.lastCommunicationAt)})`
                    : 'Nunca',
                },
                {
                  label: 'Situação do bloqueio',
                  value: blocked ? (
                    <span className="font-medium text-destructive">Bloqueio enviado</span>
                  ) : (
                    'Liberada'
                  ),
                },
              ]}
            />
          </div>
        </SectionCard>
        <SectionCard title="Última posição">
          {t.position ? (
            <div className="space-y-3">
              <DetailList
                cols={1}
                items={[
                  {
                    label: 'Coordenadas',
                    value: (
                      <span className="font-mono text-xs">{`${t.position.lat.toFixed(5)}, ${t.position.lng.toFixed(5)}`}</span>
                    ),
                  },
                  {
                    label: 'Velocidade',
                    value:
                      t.position.speedKmh !== null
                        ? t.position.speedKmh > 3
                          ? `${t.position.speedKmh} km/h (em movimento)`
                          : 'Parada'
                        : '—',
                  },
                  { label: 'Registrada em', value: formatDateTime(t.position.recordedAt) },
                ]}
              />
              {t.mapUrl && (
                <Button asChild variant="outline" className="w-full">
                  <a href={t.mapUrl} target="_blank" rel="noreferrer">
                    <MapPin /> Ver no Google Maps <ExternalLink className="opacity-60" />
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t.capabilities.location
                ? 'Nenhuma posição recebida ainda.'
                : 'Este rastreador não informa a localização.'}
            </p>
          )}
        </SectionCard>
        <SectionCard title="Equipamento">
          <div className="space-y-3">
            <DetailList
              cols={1}
              items={[
                { label: 'Fornecedor', value: providerLabel(t.provider) },
                {
                  label: 'Identificação',
                  value: t.deviceId ? (
                    <span className="font-mono">{t.deviceId}</span>
                  ) : (
                    <span className="text-warning">Não cadastrada</span>
                  ),
                },
                {
                  label: 'O que ele faz',
                  value: (
                    <span className="flex flex-wrap gap-1.5">
                      {t.capabilities.location && (
                        <Badge variant="outline">
                          <MapPin className="size-3" /> Localização
                        </Badge>
                      )}
                      {t.capabilities.odometer && (
                        <Badge variant="outline">
                          <Radio className="size-3" /> Quilometragem
                        </Badge>
                      )}
                      {t.capabilities.block && (
                        <Badge variant="outline">
                          <Lock className="size-3" /> Bloqueio
                        </Badge>
                      )}
                      {!t.capabilities.location &&
                        !t.capabilities.odometer &&
                        !t.capabilities.block && (
                          <span className="text-muted-foreground">Só identificação</span>
                        )}
                    </span>
                  ),
                },
              ]}
            />
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Bloqueio remoto"
        description={
          !t.capabilities.block
            ? 'Este rastreador não oferece bloqueio remoto.'
            : !t.deviceId
              ? 'Cadastre a identificação do equipamento na moto para poder bloquear.'
              : canCommand
                ? 'Pede motivo e confirmação com a placa. Fica registrado quem fez, quando e por quê.'
                : 'Seu perfil pode ver, mas não pode bloquear ou desbloquear.'
        }
        actions={
          canBlock && (
            <div className="hidden gap-2 sm:flex">
              <Button variant={blocked ? 'outline' : 'destructive'} onClick={() => setCmd('BLOCK')}>
                <Lock /> Bloquear
              </Button>
              <Button variant={blocked ? 'default' : 'outline'} onClick={() => setCmd('UNBLOCK')}>
                <LockOpen /> Desbloquear
              </Button>
            </div>
          )
        }
      >
        {canBlock && (
          <div className="mb-4 grid grid-cols-2 gap-2 sm:hidden">
            <Button variant={blocked ? 'outline' : 'destructive'} onClick={() => setCmd('BLOCK')}>
              <Lock /> Bloquear
            </Button>
            <Button variant={blocked ? 'default' : 'outline'} onClick={() => setCmd('UNBLOCK')}>
              <LockOpen /> Desbloquear
            </Button>
          </div>
        )}
        <div className="-mx-4 border-y border-border sm:mx-0 sm:rounded-lg sm:border">
          <CommandHistory commands={t.commands} />
        </div>
      </SectionCard>

      {cmd && (
        <TrackerCommandDialog
          tracker={t}
          type={cmd}
          open={!!cmd}
          onOpenChange={(v) => !v && setCmd(null)}
        />
      )}
    </div>
  );
}
