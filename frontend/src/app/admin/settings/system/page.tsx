'use client';

import type { JobRunDto } from '@locamania/shared';
import {
  BellRing,
  CalendarClock,
  Clock,
  DatabaseBackup,
  FileWarning,
  Gavel,
  History,
  Loader2,
  Play,
  Receipt,
  ServerCog,
  ShieldCheck,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionCard } from '@/components/ui/kit';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useJobRuns, useRunJobs } from '@/lib/queries';
import { shortWhen } from '@/lib/settings/format';
import { JOB_NAME_LABELS, JOB_STATUS_META, JOB_TRIGGER_LABELS, jobSummaryLines } from '@/lib/settings/meta';

const STEPS: { icon: LucideIcon; text: string }[] = [
  { icon: Receipt, text: 'Marca como atrasadas as cobranças que passaram da tolerância e avisa a equipe.' },
  { icon: BellRing, text: 'Manda os lembretes de pagamento nos dias escolhidos em Regras e avisos.' },
  { icon: Gavel, text: 'Sugere (ou aplica) o bloqueio e encaminha para cobrança quem atrasou demais.' },
  { icon: Wrench, text: 'Avisa das manutenções próximas e vencidas.' },
  { icon: FileWarning, text: 'Avisa dos documentos e CNHs perto de vencer.' },
  { icon: CalendarClock, text: 'Avisa dos contratos terminando e das motos paradas.' },
];

function duration(r: JobRunDto): string | null {
  if (!r.finishedAt) return null;
  const s = Math.max(0, Math.round((new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

/** Próximas 08:00 em São Paulo (a rotina automática). */
function nextRun(): string {
  const hour = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }).format(new Date()));
  return hour < 8 ? 'hoje às 08:00' : 'amanhã às 08:00';
}

function RunStatus({ r }: { r: JobRunDto }) {
  const s = JOB_STATUS_META[r.status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function RunSummary({ r, max }: { r: JobRunDto; max?: number }) {
  const { lines, error } = jobSummaryLines(r.summary);
  if (error) return <p className="text-sm text-destructive">Erro: {error}</p>;
  if (r.status === 'RUNNING') return <p className="text-sm text-muted-foreground">Em andamento…</p>;
  if (!lines.length) return <p className="text-sm text-muted-foreground">Nada novo para avisar.</p>;
  const shown = max ? lines.slice(0, max) : lines;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {shown.map((l) => (
        <li key={l.key} className="rounded-full bg-muted px-2.5 py-1 text-xs">
          {l.text}
        </li>
      ))}
      {max && lines.length > max && <li className="px-1 py-1 text-xs text-muted-foreground">+{lines.length - max}</li>}
    </ul>
  );
}

export default function SystemPage() {
  const { data, isLoading, error } = useJobRuns();
  const run = useRunJobs();
  const confirm = useConfirm();
  const last = data?.[0];

  async function runNow() {
    const ok = await confirm({
      title: 'Executar a rotina agora?',
      description: 'Faz agora o que a rotina automática faz às 8h: atrasos, lembretes e avisos. O que já foi avisado hoje não é repetido.',
      confirmText: 'Executar agora',
    });
    if (!ok) return;
    try {
      const out = (await run.mutateAsync()) as JobRunDto | { skipped: true; reason: string };
      if ('skipped' in out) return toast.info('A rotina já está rodando', { description: out.reason });
      const { lines, error: err } = jobSummaryLines(out.summary);
      if (out.status === 'FAILED') toast.error('A rotina falhou', { description: err ?? 'Veja o histórico abaixo.' });
      else toast.success('Rotina executada', { description: lines.length ? lines.slice(0, 3).map((l) => l.text).join(' · ') : 'Nada novo para avisar agora.' });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rotinas e backup"
        description="O sistema confere tudo sozinho uma vez por dia e manda os avisos. Aqui você acompanha e, se precisar, roda na hora."
        actions={
          <Button className="w-full sm:w-auto" onClick={runNow} disabled={run.isPending}>
            {run.isPending ? <Loader2 className="animate-spin" /> : <Play />}
            {run.isPending ? 'Executando…' : 'Executar agora'}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <SectionCard title="Última execução" className="lg:col-span-3">
          {isLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : error ? (
            <p className="text-sm text-destructive">{errorMessage(error)}</p>
          ) : !last ? (
            <EmptyState icon={ServerCog} title="A rotina ainda não rodou" description="Ela roda sozinha todo dia às 8h, ou agora pelo botão acima." className="py-8" />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <RunStatus r={last} />
                <span className="text-sm font-medium first-letter:uppercase">{shortWhen(last.startedAt)}</span>
                <span className="text-sm text-muted-foreground">
                  {JOB_TRIGGER_LABELS[last.trigger] ?? last.trigger}
                  {duration(last) && ` · levou ${duration(last)}`}
                </span>
              </div>
              <RunSummary r={last} />
              <p className="flex items-center gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
                <Clock className="size-4 shrink-0" aria-hidden /> Próxima automática: {nextRun()}.
              </p>
            </div>
          )}
        </SectionCard>

        <SectionCard title="O que a rotina faz" className="lg:col-span-2">
          <ul className="space-y-2.5">
            {STEPS.map((s) => (
              <li key={s.text} className="flex items-start gap-2.5 text-sm">
                <s.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>{s.text}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Histórico de execuções" description="As últimas vezes que a rotina rodou." contentClassName="p-0 sm:p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <EmptyState icon={TriangleAlert} title="Não foi possível carregar o histórico" description={errorMessage(error)} />
        ) : !data?.length ? (
          <EmptyState icon={History} title="Nenhuma execução ainda" />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {data.map((r) => (
              <li key={r.id} className="grid gap-2.5 px-4 py-3.5 sm:px-5 md:grid-cols-[200px_minmax(0,1fr)] md:gap-5">
                <div className="flex items-start justify-between gap-2 md:flex-col md:justify-start md:gap-1.5">
                  <div>
                    <p className="text-sm font-medium first-letter:uppercase tabular">{shortWhen(r.startedAt)}</p>
                    <p className="text-xs text-muted-foreground">
                      {JOB_NAME_LABELS[r.name] ?? r.name} · {JOB_TRIGGER_LABELS[r.trigger] ?? r.trigger}
                      {duration(r) && ` · ${duration(r)}`}
                    </p>
                  </div>
                  <RunStatus r={r} />
                </div>
                <RunSummary r={r} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Cópia de segurança (backup)">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: DatabaseBackup, title: 'Todo dia, automática', text: 'O banco de dados é copiado para fora do servidor todos os dias e cada cópia fica guardada por 30 dias.' },
            { icon: ShieldCheck, title: 'Não depende do seu computador', text: 'Os dados ficam na nuvem, com cópias próprias do provedor do banco. Trocar ou perder um computador não perde nada.' },
            { icon: History, title: 'Recuperação', text: 'Se algo der errado, a equipe técnica restaura a cópia mais recente. Nada é apagado de verdade: o que se arquiva continua guardado.' },
          ].map((b) => (
            <div key={b.title} className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/12 text-success">
                <b.icon className="size-[18px]" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium">{b.title}</p>
                <p className="text-sm text-muted-foreground">{b.text}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-lg bg-muted/60 p-3 text-[13px] text-muted-foreground">
          A cópia diária e o agendador da rotina são configurados pela equipe técnica na publicação do sistema — não há nada para ajustar aqui.
        </p>
      </SectionCard>
    </div>
  );
}
