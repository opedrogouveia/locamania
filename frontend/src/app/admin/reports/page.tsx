'use client';

import { Permission, type ReportKey } from '@locamania/shared';
import { AlertTriangle, Bike, FileDown, FileSpreadsheet, FileText, Loader2, Lock, Users, Wallet, Wrench, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { PeriodPicker } from '@/components/finance/period-picker';
import { ReportTable } from '@/components/reports/report-table';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionCard } from '@/components/ui/kit';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import { downloadFile, errorMessage } from '@/lib/api/client';
import { reportsApi } from '@/lib/api/resources';
import { useCan } from '@/lib/auth/use-auth';
import { isPreset, periodRange, type PeriodPreset } from '@/lib/finance/period';
import { useReport } from '@/lib/queries';
import { useUrlState } from '@/lib/use-url-state';
import { cn, formatDateTime, formatYmd, todayYmd } from '@/lib/utils';

interface ReportMeta {
  key: ReportKey;
  /** Nome do arquivo baixado (o navegador não lê o nome que a API sugere). */
  file: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Relatório de um período (os outros são a situação de hoje). */
  period: boolean;
}

const REPORTS: ReportMeta[] = [
  { key: 'fleet', file: 'frota', label: 'Frota', icon: Bike, description: 'Quantas motos, a situação de cada uma e quem está com ela.', period: false },
  { key: 'customers', file: 'clientes', label: 'Clientes', icon: Users, description: 'Ativos, inativos e inadimplentes.', period: false },
  { key: 'finance', file: 'financeiro', label: 'Financeiro', icon: Wallet, description: 'Receitas, despesas e pagamentos atrasados.', period: true },
  { key: 'maintenance', file: 'manutencao', label: 'Manutenção', icon: Wrench, description: 'Realizadas, futuras e gastos.', period: true },
  { key: 'rentals', file: 'alugueis', label: 'Aluguéis', icon: FileText, description: 'Contratos ativos, encerrados e motos mais usadas.', period: true },
];

function ExportButtons({ report, from, to }: { report: ReportMeta; from?: string; to?: string }) {
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);
  async function run(kind: 'pdf' | 'xlsx') {
    setBusy(kind);
    try {
      const path = kind === 'pdf' ? reportsApi.pdfPath(report.key, from, to) : reportsApi.xlsxPath(report.key, from, to);
      await downloadFile(path, `relatorio-${report.file}-${from && to ? `${from}_a_${to}` : todayYmd()}.${kind}`);
      toast.success(kind === 'pdf' ? 'PDF baixado' : 'Planilha baixada', { description: `Relatório de ${report.label.toLowerCase()}` });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex">
      <Button variant="outline" onClick={() => void run('pdf')} disabled={!!busy}>
        {busy === 'pdf' ? <Loader2 className="animate-spin" /> : <FileDown />} Baixar PDF
      </Button>
      <Button variant="outline" onClick={() => void run('xlsx')} disabled={!!busy}>
        {busy === 'xlsx' ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Baixar Excel
      </Button>
    </div>
  );
}

export default function ReportsPage() {
  const canView = useCan(Permission.REPORTS_VIEW);
  const canExport = useCan(Permission.REPORTS_EXPORT);
  const canFinance = useCan(Permission.FINANCE_VIEW);
  const [q, setQ, ready] = useUrlState({ r: 'fleet', p: 'month', from: '', to: '' });
  const available = REPORTS.filter((r) => r.key !== 'finance' || canFinance);
  const report = available.find((r) => r.key === q.r) ?? available[0]!;
  const preset: PeriodPreset = isPreset(q.p) ? q.p : 'month';
  const range = periodRange(preset, todayYmd(), q.from, q.to);
  const from = report.period ? range.from : undefined;
  const to = report.period ? range.to : undefined;
  const { data, isLoading, error, isFetching } = useReport(report.key, from, to, ready && canView);
  const activeRef = useRef<HTMLButtonElement>(null);
  // No celular a fila rola de lado: o relatório escolhido (vindo por link) fica à vista.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [report.key, ready]);

  if (!canView) {
    return <EmptyState icon={Lock} title="Sem acesso aos relatórios" description="Seu perfil não vê relatórios. Fale com a proprietária se precisar." />;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title="Relatórios" description="Escolha o relatório, confira a prévia e baixe em PDF ou Excel." />

      {/* Escolha do relatório: rola de lado no celular, cinco cartões no computador. */}
      <div role="tablist" aria-label="Relatório" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-5 lg:gap-3">
        {available.map((r) => {
          const active = r.key === report.key;
          const Icon = r.icon;
          return (
            <button
              key={r.key}
              ref={active ? activeRef : undefined}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setQ({ r: r.key })}
              className={cn(
                'flex w-40 shrink-0 flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors lg:w-auto lg:p-4',
                active ? 'border-primary bg-primary/[0.06] ring-1 ring-primary' : 'border-border bg-card hover:bg-accent/50',
              )}
            >
              <span className={cn('flex size-8 items-center justify-center rounded-lg', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="text-sm font-semibold">{r.label}</span>
              <span className="line-clamp-2 text-xs text-muted-foreground">{r.description}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {report.period ? (
          <PeriodPicker preset={preset} from={range.from} to={range.to} onChange={(n) => setQ({ p: n.p, from: n.from ?? '', to: n.to ?? '' })} />
        ) : (
          <p className="text-sm text-muted-foreground">Situação de hoje, {formatYmd(todayYmd())}.</p>
        )}
        {canExport && <ExportButtons report={report} from={from} to={to} />}
      </div>

      {error ? (
        <EmptyState icon={AlertTriangle} title="Não foi possível gerar o relatório" description={errorMessage(error)} />
      ) : isLoading || !data || !ready || data.key !== report.key ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      ) : (
        <div className={cn('space-y-5', isFetching && 'opacity-70 transition-opacity')}>
          <SectionCard title={data.title} description={`${data.subtitle} · gerado em ${formatDateTime(data.generatedAt)}`}>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]">
              {data.summary.map((s) => (
                <div key={s.label} className="min-w-0 rounded-lg bg-muted/60 px-3 py-2.5">
                  <dt className="truncate text-xs text-muted-foreground">{s.label}</dt>
                  <dd className="mt-0.5 truncate text-lg font-semibold tracking-tight">{s.value}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>
          {data.sections.map((sec) => (
            <SectionCard
              key={sec.title}
              title={sec.title}
              description={`${sec.rows.length.toLocaleString('pt-BR')} ${sec.rows.length === 1 ? 'linha' : 'linhas'}`}
              contentClassName="p-0 sm:p-0"
            >
              <div className="border-t border-border">
                <ReportTable key={`${report.key}-${sec.title}-${from}-${to}`} section={sec} />
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
