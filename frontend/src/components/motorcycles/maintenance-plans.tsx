'use client';

import {
  nextMaintenanceDue,
  todayYmd,
  type MaintenancePlanDto,
  type MotorcycleDto,
  type UpsertMaintenancePlanRequest,
} from '@locamania/shared';
import { Loader2, Plus, SlidersHorizontal, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  dueText,
  intervalText,
  lastDoneText,
  nextDueText,
} from '@/components/maintenance/due-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Field, FormGrid } from '@/components/ui/kit';
import { NumberInput } from '@/components/ui/masked-input';
import { SelectMenu } from '@/components/ui/select-menu';
import { MaintenanceDueBadge } from '@/components/ui/status-badge';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useMaintenanceTypes, useUpsertPlan } from '@/lib/queries';
import { cn, formatKm, formatYmd } from '@/lib/utils';

const DAY_PRESETS = [
  { days: 90, label: '3 meses' },
  { days: 180, label: '6 meses' },
  { days: 365, label: '1 ano' },
];

/**
 * Criar/ajustar o plano de um serviço para esta moto (§7): por km, por data ou
 * pelos dois — vale o que chegar primeiro. A próxima é calculada a partir da
 * última vez; dá para informar à mão ("revisão prevista para 20/10").
 */
function PlanDialog({
  motorcycle,
  plan,
  plans,
  open,
  onOpenChange,
}: {
  motorcycle: MotorcycleDto;
  plan: MaintenancePlanDto | null;
  plans: MaintenancePlanDto[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const upsert = useUpsertPlan(motorcycle.id);
  const types = useMaintenanceTypes();
  const [typeId, setTypeId] = useState('');
  const [intervalKm, setIntervalKm] = useState<number | null>(null);
  const [intervalDays, setIntervalDays] = useState<number | null>(null);
  const [lastDoneKm, setLastDoneKm] = useState<number | null>(null);
  const [lastDoneAt, setLastDoneAt] = useState('');
  const [manual, setManual] = useState(false);
  const [nextDueKm, setNextDueKm] = useState<number | null>(null);
  const [nextDueDate, setNextDueDate] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const available = useMemo(
    () => (types.data ?? []).filter((t) => t.active && !plans.some((p) => p.type.id === t.id)),
    [types.data, plans],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setManual(false);
    setTypeId(plan?.type.id ?? '');
    setIntervalKm(plan?.intervalKm ?? null);
    setIntervalDays(plan?.intervalDays ?? null);
    setLastDoneKm(plan?.lastDoneKm ?? motorcycle.currentKm);
    setLastDoneAt(plan?.lastDoneAt ?? todayYmd());
    setNextDueKm(plan?.nextDueKm ?? null);
    setNextDueDate(plan?.nextDueDate ?? '');
    setActive(plan?.active ?? true);
  }, [open, plan, motorcycle.currentKm]);

  // Serviço novo: começa com o intervalo padrão do tipo.
  function chooseType(id: string) {
    setTypeId(id);
    const t = types.data?.find((x) => x.id === id);
    if (t) {
      setIntervalKm(t.defaultIntervalKm);
      setIntervalDays(t.defaultIntervalDays);
    }
  }

  const computed = nextMaintenanceDue(
    { intervalKm, intervalDays },
    { km: lastDoneKm, date: lastDoneAt || todayYmd() },
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!typeId) return setError('Escolha o serviço.');
    if (active && !intervalKm && !intervalDays)
      return setError('Informe de quantos em quantos km, de quantos em quantos dias, ou os dois.');
    const body: UpsertMaintenancePlanRequest = {
      typeId,
      intervalKm,
      intervalDays,
      lastDoneKm,
      lastDoneAt: lastDoneAt || null,
      active,
    };
    if (manual) {
      body.nextDueKm = nextDueKm;
      body.nextDueDate = nextDueDate || null;
    }
    try {
      await upsert.mutateAsync(body);
      toast.success(plan ? 'Plano ajustado' : 'Plano criado', {
        description: 'Os alertas já usam os novos valores.',
      });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <DialogHeader>
          <DialogTitle>
            {plan ? `Plano: ${plan.type.name}` : 'Novo plano de manutenção'}
          </DialogTitle>
          <DialogDescription>
            Vale o que chegar primeiro: o km ou a data. O aviso sai antes, conforme as
            configurações.
          </DialogDescription>
        </DialogHeader>
        {!plan && (
          <Field label="Serviço" required>
            {(id) => (
              <SelectMenu
                id={id}
                value={typeId}
                onChange={chooseType}
                placeholder={
                  available.length ? 'Escolha o serviço' : 'Todos os serviços já têm plano'
                }
                options={available.map((t) => ({ value: t.id, label: t.name }))}
              />
            )}
          </Field>
        )}
        <FormGrid cols={2}>
          <Field label="A cada (km)" hint="Deixe vazio se não for por km.">
            {(id) => (
              <NumberInput
                id={id}
                value={intervalKm}
                onValue={setIntervalKm}
                suffix="km"
                placeholder="3.000"
              />
            )}
          </Field>
          <Field label="A cada (dias)" hint="Deixe vazio se não for por data.">
            {(id) => (
              <div className="space-y-2">
                <NumberInput
                  id={id}
                  value={intervalDays}
                  onValue={setIntervalDays}
                  suffix="dias"
                  thousands={false}
                  placeholder="180"
                />
                <div className="flex flex-wrap gap-1.5">
                  {DAY_PRESETS.map((p) => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => setIntervalDays(p.days)}
                      className={cn(
                        'min-h-8 rounded-full border px-2.5 text-xs font-medium transition-colors',
                        intervalDays === p.days
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card hover:bg-accent',
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Field>
          <Field label="Última vez feita (km)">
            {(id) => <NumberInput id={id} value={lastDoneKm} onValue={setLastDoneKm} suffix="km" />}
          </Field>
          <Field label="Última vez feita (data)">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={lastDoneAt}
                max={todayYmd()}
                onChange={(e) => setLastDoneAt(e.target.value)}
              />
            )}
          </Field>
        </FormGrid>

        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 text-sm">
              <p className="font-medium">Próxima</p>
              {!manual && (
                <p className="text-muted-foreground tabular">
                  {computed.nextDueKm === null && !computed.nextDueDate
                    ? 'Informe um intervalo.'
                    : [
                        computed.nextDueKm !== null ? formatKm(computed.nextDueKm) : null,
                        computed.nextDueDate ? formatYmd(computed.nextDueDate) : null,
                      ]
                        .filter(Boolean)
                        .join(' ou ')}
                </p>
              )}
            </div>
            <label
              className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"
              htmlFor="plan-manual"
            >
              Informar à mão
              <Switch id="plan-manual" checked={manual} onCheckedChange={setManual} />
            </label>
          </div>
          {manual && (
            <FormGrid cols={2}>
              <Field label="No km">
                {(id) => (
                  <NumberInput id={id} value={nextDueKm} onValue={setNextDueKm} suffix="km" />
                )}
              </Field>
              <Field label="Na data">
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    value={nextDueDate}
                    onChange={(e) => setNextDueDate(e.target.value)}
                  />
                )}
              </Field>
            </FormGrid>
          )}
        </div>

        {plan && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <label htmlFor="plan-active" className="min-w-0">
              <span className="block text-sm font-medium">Plano ativo</span>
              <span className="block text-xs text-muted-foreground">
                Desligado, este serviço não gera alertas para esta moto.
              </span>
            </label>
            <Switch id="plan-active" checked={active} onCheckedChange={setActive} />
          </div>
        )}
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="animate-spin" />}
            {plan ? 'Salvar plano' : 'Criar plano'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/** Planos da moto com a situação de cada um (ficha, aba Manutenção). */
export function MaintenancePlans({
  motorcycle,
  plans,
  loading,
  canManage,
}: {
  motorcycle: MotorcycleDto;
  plans: MaintenancePlanDto[] | undefined;
  loading?: boolean;
  canManage: boolean;
}) {
  const [dialog, setDialog] = useState<{ open: boolean; plan: MaintenancePlanDto | null }>({
    open: false,
    plan: null,
  });
  const rows = useMemo(() => {
    const rank = { OVERDUE: 0, DUE_SOON: 1, OK: 2 } as const;
    return [...(plans ?? [])].sort(
      (a, b) => Number(!a.active) - Number(!b.active) || rank[a.due.status] - rank[b.due.status],
    );
  }, [plans]);

  const status = (p: MaintenancePlanDto) =>
    p.active ? (
      <div className="space-y-1 whitespace-nowrap">
        <MaintenanceDueBadge status={p.due.status} />
        <p
          className={cn(
            'text-xs',
            p.due.status === 'OVERDUE'
              ? 'font-medium text-destructive'
              : p.due.status === 'DUE_SOON'
                ? 'font-medium text-warning'
                : 'text-muted-foreground',
          )}
        >
          {dueText(p.due)}
        </p>
      </div>
    ) : (
      <Badge variant="muted">Desligado</Badge>
    );

  const columns: Column<MaintenancePlanDto>[] = [
    {
      key: 'type',
      header: 'Serviço',
      cell: (p) => (
        <div className="min-w-36">
          <p className="font-medium">{p.type.name}</p>
          <p className="whitespace-nowrap text-xs text-muted-foreground">{intervalText(p)}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Situação', cell: status },
    {
      key: 'next',
      header: 'Próxima',
      cell: (p) => <span className="whitespace-nowrap text-sm tabular">{nextDueText(p)}</span>,
    },
    {
      key: 'last',
      header: 'Última vez',
      hideBelow: 'lg',
      cell: (p) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground tabular">
          {lastDoneText(p)}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            cell: (p: MaintenancePlanDto) => (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setDialog({ open: true, plan: p });
                }}
              >
                <SlidersHorizontal /> Ajustar
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Planos de manutenção</h3>
          <p className="text-sm text-muted-foreground">
            Quando fazer cada serviço desta moto. O sistema avisa antes de vencer.
          </p>
        </div>
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, plan: null })}>
            <Plus /> Novo plano
          </Button>
        )}
      </div>
      <div className="-mx-4 border-y border-border sm:mx-0 sm:rounded-lg sm:border">
        <DataTable
          rows={loading ? undefined : rows}
          loading={loading}
          columns={columns}
          rowKey={(p) => p.id}
          onRowClick={canManage ? (p) => setDialog({ open: true, plan: p }) : undefined}
          rowClassName={(p) =>
            !p.active
              ? 'opacity-60'
              : p.due.status === 'OVERDUE'
                ? 'bg-destructive/[0.03]'
                : undefined
          }
          empty={{
            icon: Wrench,
            title: 'Nenhum plano',
            description: 'Crie planos para o sistema avisar da troca de óleo, revisão, pneus...',
          }}
          mobileCard={(p) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-medium">{p.type.name}</p>
                <p className="text-xs text-muted-foreground">{intervalText(p)}</p>
                <p className="mt-1 text-xs text-muted-foreground tabular">
                  Próxima: {nextDueText(p)}
                </p>
              </div>
              <div className="shrink-0 text-right">{status(p)}</div>
            </div>
          )}
        />
      </div>
      <PlanDialog
        motorcycle={motorcycle}
        plan={dialog.plan}
        plans={plans ?? []}
        open={dialog.open}
        onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}
      />
    </div>
  );
}
