'use client';

import {
  MOTORCYCLE_STATUS_LABELS,
  Permission,
  normalizeText,
  type MotorcycleStatus,
  type TrackerCommandType,
  type TrackerStatusDto,
} from '@locamania/shared';
import {
  ChevronRight,
  ExternalLink,
  FlaskConical,
  Lock,
  LockOpen,
  MapPin,
  Satellite,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Plate } from '@/components/motorcycles/plate';
import { TrackerCommandDialog } from '@/components/tracking/command-dialog';
import { CommandStatusBadge, CommandTypeLabel } from '@/components/tracking/tracker-panel';
import { agoText, communication, isBlocked } from '@/components/tracking/tracking-meta';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { FilterChips, SearchInput, SectionCard, Toolbar } from '@/components/ui/kit';
import { PageHeader } from '@/components/ui/page-header';
import { MotorcycleStatusBadge } from '@/components/ui/status-badge';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { useTrackingList } from '@/lib/queries';
import { useUrlState } from '@/lib/use-url-state';
import { cn, formatDateTime, plural } from '@/lib/utils';

type Filter = 'all' | 'online' | 'offline' | 'blocked';

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

function Communication({ t }: { t: TrackerStatusDto }) {
  const c = communication(t);
  return (
    <div className="min-w-0">
      <p className={cn('flex items-center gap-1.5 text-sm font-medium', TONE_TEXT[c.tone])}>
        <span className={cn('size-2 shrink-0 rounded-full', TONE_DOT[c.tone])} aria-hidden />
        {c.label}
      </p>
      <p
        className="truncate text-xs text-muted-foreground"
        title={t.lastCommunicationAt ? formatDateTime(t.lastCommunicationAt) : undefined}
      >
        {t.lastCommunicationAt ? `Última ${agoText(t.lastCommunicationAt)}` : c.detail}
      </p>
    </div>
  );
}

function MapLink({ t, className }: { t: TrackerStatusDto; className?: string }) {
  if (!t.mapUrl || !t.position)
    return (
      <span className="text-sm text-muted-foreground">
        {t.capabilities.location ? 'Sem posição' : 'Não informa'}
      </span>
    );
  const speed = t.position.speedKmh;
  return (
    <div className={cn('min-w-0', className)}>
      <a
        href={t.mapUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap text-sm font-medium text-primary hover:underline"
      >
        <MapPin className="size-4" aria-hidden /> Ver no mapa
        <ExternalLink className="size-3.5 opacity-60" aria-hidden />
      </a>
      {speed !== null && (
        <p className="whitespace-nowrap text-xs text-muted-foreground">
          {speed > 3 ? `Em movimento · ${speed} km/h` : 'Parada'}
        </p>
      )}
    </div>
  );
}

export default function TrackingPage() {
  const canCommand = useCan(Permission.TRACKING_COMMAND);
  const { data, isLoading, error, dataUpdatedAt } = useTrackingList();
  const [q, setQ, ready] = useUrlState({ filter: 'all', search: '' });
  const [cmd, setCmd] = useState<{ tracker: TrackerStatusDto; type: TrackerCommandType } | null>(
    null,
  );
  const filter = (
    ['all', 'online', 'offline', 'blocked'].includes(q.filter ?? '') ? q.filter : 'all'
  ) as Filter;

  const all = useMemo(() => data ?? [], [data]);
  const counts = useMemo(
    () => ({
      all: all.length,
      online: all.filter((t) => t.online).length,
      offline: all.filter((t) => !t.online).length,
      blocked: all.filter((t) => isBlocked(t.lastCommand)).length,
    }),
    [all],
  );
  const rows = useMemo(() => {
    const term = normalizeText(q.search).replace(/[^a-z0-9 ]/g, '');
    return all
      .filter((t) =>
        filter === 'online'
          ? t.online
          : filter === 'offline'
            ? !t.online
            : filter === 'blocked'
              ? isBlocked(t.lastCommand)
              : true,
      )
      .filter(
        (t) =>
          !term ||
          normalizeText(t.motorcycle.plate).includes(term.replace(/ /g, '')) ||
          normalizeText(t.motorcycle.label).includes(term) ||
          normalizeText(t.deviceId).includes(term),
      )
      .sort(
        (a, b) =>
          Number(a.online) - Number(b.online) ||
          a.motorcycle.plate.localeCompare(b.motorcycle.plate),
      );
  }, [all, filter, q.search]);
  const recent = useMemo(
    () =>
      all
        .filter((t) => t.lastCommand)
        .sort((a, b) => b.lastCommand!.requestedAt.localeCompare(a.lastCommand!.requestedAt))
        .slice(0, 8),
    [all],
  );
  const sandbox = all.some((t) => t.sandbox);
  const canBlock = (t: TrackerStatusDto) => canCommand && t.capabilities.block && !!t.deviceId;

  const commandButton = (t: TrackerStatusDto, full?: boolean) => {
    if (!canBlock(t)) return null;
    const blocked = isBlocked(t.lastCommand);
    return (
      <Button
        size="sm"
        variant={blocked ? 'default' : 'outline'}
        className={cn('h-10 sm:h-9', full && 'flex-1')}
        onClick={() => setCmd({ tracker: t, type: blocked ? 'UNBLOCK' : 'BLOCK' })}
      >
        {blocked ? <LockOpen /> : <Lock />} {blocked ? 'Desbloquear' : 'Bloquear'}
      </Button>
    );
  };

  const columns: Column<TrackerStatusDto>[] = [
    {
      key: 'moto',
      header: 'Moto',
      cell: (t) => (
        <Link
          href={`/admin/motorcycles/${t.motorcycle.id}?tab=tracking`}
          className="group flex items-center gap-2.5"
        >
          <Plate plate={t.motorcycle.plate} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium group-hover:underline">
              {t.motorcycle.label}
            </span>
            <span className="block truncate font-mono text-xs text-muted-foreground">
              {t.deviceId ?? 'sem identificação'}
            </span>
          </span>
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Situação',
      hideBelow: 'lg',
      cell: (t) => <MotorcycleStatusBadge status={t.motorcycle.status as MotorcycleStatus} />,
    },
    { key: 'com', header: 'Comunicação', cell: (t) => <Communication t={t} /> },
    { key: 'pos', header: 'Posição', cell: (t) => <MapLink t={t} /> },
    {
      key: 'last',
      header: 'Último comando',
      hideBelow: 'xl',
      cell: (t) =>
        t.lastCommand ? (
          <div className="space-y-0.5">
            <CommandTypeLabel type={t.lastCommand.type} />
            <p className="text-xs text-muted-foreground">
              {formatDateTime(t.lastCommand.requestedAt)}
            </p>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (t) => (
        <div className="flex items-center justify-end gap-1">
          {commandButton(t)}
          <Button asChild size="icon" variant="ghost" aria-label={`Abrir ${t.motorcycle.plate}`}>
            <Link href={`/admin/motorcycles/${t.motorcycle.id}?tab=tracking`}>
              <ChevronRight />
            </Link>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rastreamento"
        description={
          data
            ? `${plural(data.length, 'moto com rastreador', 'motos com rastreador')} · atualiza sozinho a cada minuto`
            : 'Última comunicação, posição e bloqueio seguro das motos.'
        }
      />

      {sandbox && (
        <p className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/8 p-3 text-sm">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          <span>
            <strong className="font-medium">Ambiente de teste.</strong> As posições são simuladas e
            os bloqueios ficam só registrados — nenhuma moto é bloqueada de verdade. Quando o
            fornecedor do rastreador for contratado, esta tela passa a mostrar os dados reais.
          </span>
        </p>
      )}

      <Toolbar>
        <FilterChips
          value={filter}
          onChange={(v) => setQ({ filter: v })}
          options={[
            { value: 'all', label: 'Todas', count: data ? counts.all : undefined },
            {
              value: 'online',
              label: 'Comunicando',
              count: data ? counts.online : undefined,
              tone: 'success',
            },
            {
              value: 'offline',
              label: 'Sem comunicação',
              count: data ? counts.offline : undefined,
              tone: 'danger',
            },
            {
              value: 'blocked',
              label: 'Com bloqueio',
              count: data ? counts.blocked : undefined,
              tone: 'warning',
            },
          ]}
        />
        <SearchInput
          value={q.search ?? ''}
          onChange={(v) => setQ({ search: v })}
          placeholder="Placa, modelo ou equipamento"
          className="lg:w-80"
        />
      </Toolbar>

      <Card>
        {error ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : (
          <DataTable
            rows={ready && data ? rows : undefined}
            loading={isLoading || !ready}
            columns={columns}
            rowKey={(t) => t.motorcycle.id}
            rowClassName={(t) => (!t.online ? 'bg-destructive/[0.03]' : undefined)}
            empty={{
              icon: Satellite,
              title: all.length === 0 ? 'Nenhuma moto com rastreador' : 'Nenhuma moto neste filtro',
              description:
                all.length === 0
                  ? 'Marque "Tem rastreador instalado" no cadastro da moto e informe a identificação do equipamento.'
                  : undefined,
            }}
            mobileCard={(t) => (
              <div className="space-y-2">
                <Link
                  href={`/admin/motorcycles/${t.motorcycle.id}?tab=tracking`}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Plate plate={t.motorcycle.plate} />
                    <span className="truncate text-[15px] font-medium">{t.motorcycle.label}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    {MOTORCYCLE_STATUS_LABELS[t.motorcycle.status as MotorcycleStatus]}
                    <ChevronRight className="size-4" aria-hidden />
                  </span>
                </Link>
                <Communication t={t} />
                <div className="flex items-center gap-2">
                  <MapLink t={t} className="flex-1" />
                  {commandButton(t)}
                </div>
                {t.lastCommand && (
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    Último comando: <CommandTypeLabel type={t.lastCommand.type} />{' '}
                    {formatDateTime(t.lastCommand.requestedAt)}
                  </p>
                )}
              </div>
            )}
          />
        )}
      </Card>

      {recent.length > 0 && (
        <SectionCard
          title="Últimos comandos"
          description="O comando mais recente de cada moto. O histórico completo fica na ficha da moto, aba Rastreamento."
        >
          <ul className="-mx-4 divide-y divide-border border-y border-border sm:mx-0 sm:rounded-lg sm:border">
            {recent.map((t) => (
              <li key={t.lastCommand!.id}>
                <Link
                  href={`/admin/motorcycles/${t.motorcycle.id}?tab=tracking`}
                  className="flex min-h-14 items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/50 sm:items-center"
                >
                  <Plate plate={t.motorcycle.plate} className="mt-0.5 sm:mt-0" />
                  <span className="min-w-0 flex-1 space-y-0.5 sm:flex sm:items-center sm:gap-4 sm:space-y-0">
                    <span className="flex items-center gap-2 sm:w-44 sm:shrink-0">
                      <CommandTypeLabel type={t.lastCommand!.type} />
                    </span>
                    <span className="block min-w-0 truncate text-sm sm:flex-1">
                      {t.lastCommand!.reason}
                    </span>
                    <span className="block text-xs text-muted-foreground sm:w-56 sm:shrink-0 sm:text-right">
                      {formatDateTime(t.lastCommand!.requestedAt)}
                      {t.lastCommand!.requestedBy ? ` · ${t.lastCommand!.requestedBy}` : ''}
                    </span>
                  </span>
                  <span className="hidden shrink-0 md:block">
                    <CommandStatusBadge status={t.lastCommand!.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {dataUpdatedAt > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Atualizado às{' '}
          {new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
          })}
        </p>
      )}

      {cmd && (
        <TrackerCommandDialog
          tracker={cmd.tracker}
          type={cmd.type}
          open={!!cmd}
          onOpenChange={(v) => !v && setCmd(null)}
        />
      )}
    </div>
  );
}
