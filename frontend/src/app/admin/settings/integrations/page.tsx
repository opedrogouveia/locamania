'use client';

import type { IntegrationStatusDto } from '@locamania/shared';
import { CheckCircle2, CircleDashed, FlaskConical, Plug, TriangleAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api/client';
import { useIntegrations } from '@/lib/queries';
import { INTEGRATION_META, INTEGRATION_STATE_META, integrationState } from '@/lib/settings/meta';
import { cn } from '@/lib/utils';

const STATE_ICON = { ready: CheckCircle2, sandbox: FlaskConical, off: CircleDashed } as const;

function IntegrationCard({ i }: { i: IntegrationStatusDto }) {
  const state = integrationState(i);
  const meta = INTEGRATION_META[i.key];
  const s = INTEGRATION_STATE_META[state];
  const StateIcon = STATE_ICON[state];
  const Icon = meta?.icon ?? Plug;
  return (
    <li className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg',
            state === 'ready' ? 'bg-success/12 text-success' : state === 'sandbox' ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-tight">{i.label}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{i.provider}</p>
        </div>
        <Badge variant={s.variant} className="shrink-0">
          <StateIcon className="size-3" aria-hidden />
          {s.label}
        </Badge>
      </div>
      <p className="mt-3 text-sm">{i.description}</p>
      {state !== 'ready' && meta && (
        <p className="mt-3 rounded-lg bg-muted/60 p-3 text-[13px] text-muted-foreground">
          <strong className="font-medium text-foreground">O que falta: </strong>
          {meta.missing}
        </p>
      )}
    </li>
  );
}

export default function IntegrationsPage() {
  const { data, isLoading, error } = useIntegrations();
  const ready = data?.filter((i) => integrationState(i) === 'ready').length ?? 0;
  const sandbox = data?.filter((i) => integrationState(i) === 'sandbox').length ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Integrações"
        description="Serviços de fora que o sistema usa. As chaves de acesso são cadastradas na publicação do sistema — nada aqui precisa ser digitado."
      />
      {data && (
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="success">{ready} funcionando</Badge>
          {sandbox > 0 && <Badge variant="warning">{sandbox} em modo de teste</Badge>}
          {data.length - ready - sandbox > 0 && <Badge variant="muted">{data.length - ready - sandbox} não configuradas</Badge>}
        </div>
      )}
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : error || !data ? (
        <EmptyState icon={TriangleAlert} title="Não foi possível carregar as integrações" description={errorMessage(error)} />
      ) : data.length === 0 ? (
        <EmptyState icon={Plug} title="Nenhuma integração" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((i) => (
            <IntegrationCard key={i.key} i={i} />
          ))}
        </ul>
      )}
      <p className="text-sm text-muted-foreground">
        <strong className="font-medium text-foreground">Modo de teste</strong> quer dizer que a integração funciona em simulação: dá para testar o fluxo inteiro (PIX, avisos,
        rastreador) sem cobrar ninguém de verdade.
      </p>
    </div>
  );
}
