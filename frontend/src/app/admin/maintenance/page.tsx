'use client';

import { Permission, addDays, todayYmd, type MaintenancePlanDto } from '@locamania/shared';
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Plus,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef } from 'react';

import { DuePlanList } from '@/components/maintenance/due-plan-list';
import { useMaintenanceDialogs } from '@/components/maintenance/maintenance-dialogs';
import { MaintenanceRecordList } from '@/components/maintenance/record-list';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FilterChips, SearchInput } from '@/components/ui/kit';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { useMaintenanceDue, useMaintenanceOverview, useMaintenanceRecords } from '@/lib/queries';
import { pageOf, useUrlState } from '@/lib/use-url-state';
import { cn, formatBRL, plural } from '@/lib/utils';

type Tab = 'overdue' | 'upcoming' | 'scheduled' | 'in_progress' | 'done';
const TABS: Tab[] = ['overdue', 'upcoming', 'scheduled', 'in_progress', 'done'];
const TAB_LABEL: Record<Tab, string> = {
  overdue: 'Vencidas',
  upcoming: 'Próximas',
  scheduled: 'Agendadas',
  in_progress: 'Em andamento',
  done: 'Realizadas',
};

type Period = '30' | '90' | '365' | 'all';
const PERIODS: { value: Period; label: string; phrase: string }[] = [
  { value: '30', label: '30 dias', phrase: ' nos últimos 30 dias' },
  { value: '90', label: '90 dias', phrase: ' nos últimos 90 dias' },
  { value: '365', label: '12 meses', phrase: ' nos últimos 12 meses' },
  { value: 'all', label: 'Tudo', phrase: '' },
];

const TONE = {
  danger: 'bg-destructive/12 text-destructive',
  warning: 'bg-warning/15 text-warning',
  default: 'bg-primary/10 text-primary',
  info: 'bg-info/12 text-info',
  success: 'bg-success/12 text-success',
} as const;

/** Resumo que também troca a aba (um toque no número abre a lista). */
function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number | undefined;
  hint?: string;
  icon: LucideIcon;
  tone: keyof typeof TONE;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'min-w-[9.5rem] shrink-0 snap-start rounded-xl border bg-card p-3.5 text-left shadow-sm transition-colors sm:p-4 lg:min-w-0',
        active
          ? 'border-primary ring-1 ring-primary'
          : 'border-border hover:border-ring/40 hover:bg-accent/30',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xs font-medium text-muted-foreground sm:text-[13px]">
            {label}
          </p>
          {value === undefined ? (
            <Skeleton className="h-7 w-10" />
          ) : (
            <p className="text-xl font-semibold tabular tracking-tight sm:text-2xl">{value}</p>
          )}
          {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span
          className={cn(
            'hidden size-9 shrink-0 items-center justify-center rounded-lg sm:flex',
            TONE[tone],
            value === 0 && 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="size-[18px]" aria-hidden />
        </span>
      </div>
    </button>
  );
}

export default function MaintenancePage() {
  const canManage = useCan(Permission.MAINTENANCE_MANAGE);
  const canFinance = useCan(Permission.FINANCE_VIEW);
  const canCustomers = useCan(Permission.CUSTOMERS_VIEW);
  const [q, setQ, ready] = useUrlState({
    tab: 'overdue',
    search: '',
    page: '1',
    period: '30',
    record: '',
  });
  const tab = (TABS.includes(q.tab as Tab) ? q.tab : 'overdue') as Tab;
  const period = (PERIODS.some((p) => p.value === q.period) ? q.period : '30') as Period;
  const isDue = tab === 'overdue' || tab === 'upcoming';
  const base = { search: q.search || undefined, page: pageOf(q.page), pageSize: 20 };
  const from =
    tab === 'done' && period !== 'all' ? addDays(todayYmd(), -Number(period)) : undefined;

  const overview = useMaintenanceOverview();
  const due = useMaintenanceDue(tab === 'upcoming' ? 'upcoming' : 'overdue', base, ready && isDue);
  const records = useMaintenanceRecords(
    tab === 'done' ? 'done' : tab === 'scheduled' ? 'scheduled' : 'in_progress',
    { ...base, from },
    ready && !isDue,
  );
  const current = isDue ? due : records;

  const { openRecord, openNew, openComplete, start, dialogs } = useMaintenanceDialogs({
    onRecordClosed: () => setQ({ record: '' }),
  });

  // Link com `?record=<id>` (notificação, histórico da moto) abre o registro.
  const opened = useRef(false);
  useEffect(() => {
    if (!ready || opened.current) return;
    opened.current = true;
    if (q.record) openRecord(q.record);
  }, [ready, q.record, openRecord]);

  const o = overview.data;
  const counts: Record<Tab, number | undefined> = {
    overdue: o?.overdue,
    upcoming: o?.upcoming,
    scheduled: o?.scheduled,
    in_progress: o?.inProgress,
    done: o?.doneLast30Days,
  };
  const changeTab = (t: Tab) => setQ({ tab: t, page: '1' });
  const schedule = (p: MaintenancePlanDto) =>
    openNew({
      motorcycle: { id: p.motorcycle.id, plate: p.motorcycle.plate, label: p.motorcycle.label },
      typeIds: [p.type.id],
      status: 'SCHEDULED',
    });

  const empty: Record<Tab, { title: string; description?: string; action?: React.ReactNode }> = {
    overdue: {
      title: 'Nenhuma manutenção vencida',
      description: q.search ? 'Nada encontrado com essa busca.' : 'A frota está em dia.',
      action: !q.search ? (
        <Button variant="outline" onClick={() => changeTab('upcoming')}>
          Ver as próximas
        </Button>
      ) : undefined,
    },
    upcoming: {
      title: 'Nada perto de vencer',
      description: q.search
        ? 'Nada encontrado com essa busca.'
        : 'Aparece aqui quando faltar pouco — em km ou em dias — para um serviço.',
    },
    scheduled: {
      title: 'Nenhuma manutenção agendada',
      description: q.search ? 'Nada encontrado com essa busca.' : undefined,
      action:
        canManage && !q.search ? (
          <Button onClick={() => openNew({ status: 'SCHEDULED' })}>
            <Plus /> Agendar manutenção
          </Button>
        ) : undefined,
    },
    in_progress: {
      title: 'Nenhuma moto na oficina',
      description: q.search
        ? 'Nada encontrado com essa busca.'
        : 'As manutenções iniciadas aparecem aqui até serem concluídas.',
    },
    done: {
      title: 'Nenhuma manutenção realizada',
      description: q.search
        ? 'Nada encontrado com essa busca.'
        : 'Nenhum serviço concluído neste período.',
    },
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Manutenção"
        description="Alertas por km e por data, agendamentos e serviços feitos em toda a frota."
        actions={
          canManage && (
            <Button className="w-full sm:w-auto" onClick={() => openNew()}>
              <Plus /> Nova manutenção
            </Button>
          )
        }
      />

      {overview.error ? (
        <p className="text-sm text-destructive">{errorMessage(overview.error)}</p>
      ) : (
        <div className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-5 lg:gap-3">
          <SummaryCard
            label="Vencidas"
            value={o?.overdue}
            hint="Passaram do limite"
            icon={AlertTriangle}
            tone="danger"
            active={tab === 'overdue'}
            onClick={() => changeTab('overdue')}
          />
          <SummaryCard
            label="Próximas"
            value={o?.upcoming}
            hint="Perto de vencer"
            icon={CalendarClock}
            tone="warning"
            active={tab === 'upcoming'}
            onClick={() => changeTab('upcoming')}
          />
          <SummaryCard
            label="Agendadas"
            value={o?.scheduled}
            hint="Com data marcada"
            icon={CalendarDays}
            tone="default"
            active={tab === 'scheduled'}
            onClick={() => changeTab('scheduled')}
          />
          <SummaryCard
            label="Em andamento"
            value={o?.inProgress}
            hint="Na oficina agora"
            icon={Wrench}
            tone="info"
            active={tab === 'in_progress'}
            onClick={() => changeTab('in_progress')}
          />
          <SummaryCard
            label="Realizadas (30 dias)"
            value={o?.doneLast30Days}
            hint={
              o?.costLast30Days != null
                ? `${formatBRL(o.costLast30Days)} gastos`
                : 'Nos últimos 30 dias'
            }
            icon={CheckCircle2}
            tone="success"
            active={tab === 'done'}
            onClick={() => changeTab('done')}
          />
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:border-b lg:border-border">
          {/* No celular os cartões acima já são as abas. */}
          <Tabs
            defaultValue="overdue"
            value={tab}
            onValueChange={(t) => changeTab(t as Tab)}
            className="hidden min-w-0 sm:block"
          >
            <TabsList className="lg:border-b-0">
              {TABS.map((t) => (
                <TabsTrigger key={t} value={t}>
                  {TAB_LABEL[t]}
                  {t !== 'done' && counts[t] !== undefined && counts[t]! > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-xs tabular',
                        t === 'overdue'
                          ? 'bg-destructive/12 text-destructive'
                          : t === 'upcoming'
                            ? 'bg-warning/15 text-warning'
                            : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {counts[t]}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <SearchInput
            value={q.search ?? ''}
            onChange={(v) => setQ({ search: v, page: '1' })}
            placeholder="Placa, modelo ou serviço"
            className="lg:mb-2 lg:w-72"
          />
        </div>
        {tab === 'done' && (
          <FilterChips
            value={period}
            onChange={(v) => setQ({ period: v, page: '1' })}
            options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
          />
        )}
      </div>

      <Card
        className={
          current.isFetching && !current.isLoading ? 'opacity-70 transition-opacity' : undefined
        }
      >
        {current.error ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(current.error)}</p>
        ) : isDue ? (
          <DuePlanList
            rows={ready ? due.data?.data : undefined}
            loading={due.isLoading || !ready}
            onSchedule={canManage ? schedule : undefined}
            canCustomers={canCustomers}
            empty={empty[tab]}
          />
        ) : (
          <MaintenanceRecordList
            rows={ready ? records.data?.data : undefined}
            loading={records.isLoading || !ready}
            showCost={canFinance && tab === 'done'}
            onOpen={(r) => {
              setQ({ record: r.id });
              openRecord(r.id);
            }}
            onStart={canManage ? start : undefined}
            onComplete={canManage ? openComplete : undefined}
            empty={empty[tab]}
          />
        )}
        {current.data && current.data.totalPages > 1 && (
          <div className="border-t border-border p-3">
            <Pagination
              page={current.data.page}
              totalPages={current.data.totalPages}
              total={current.data.total}
              unit={isDue ? 'serviços' : 'manutenções'}
              onPageChange={(p) => setQ({ page: String(p) })}
            />
          </div>
        )}
      </Card>
      {tab === 'done' && current.data && current.data.total > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {plural(current.data.total, 'manutenção realizada', 'manutenções realizadas')}
          {PERIODS.find((p) => p.value === period)!.phrase}.
        </p>
      )}
      {dialogs}
    </div>
  );
}
