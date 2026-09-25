'use client';

import { todayYmd, type PortalHomeDto } from '@locamania/shared';
import { Bell, Bike, CircleAlert, FilePen, FileText, Gauge, LifeBuoy, PartyPopper, Receipt, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { NextPaymentHero } from '@/components/portal/charges';
import { Metric, Notice, Panel, PanelHeader, PanelLink, Plate, PortalError, PortalTitle, RowList, StatusPill, SupportButton, ToneIcon, type Tone } from '@/components/portal/kit';
import { MaintenanceCard } from '@/components/portal/maintenance-card';
import { NotificationRow } from '@/components/portal/notification-row';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpenNotification } from '@/lib/portal/queries';
import { usePortalHome, usePortalNotifications } from '@/lib/queries/portal';
import { formatBRL, formatKm, formatYmd, plural } from '@/lib/utils';

const SITUATION_TONE: Record<PortalHomeDto['situationTone'], Tone> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  muted: 'muted',
};

function HomeSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Carregando">
      <div className="space-y-2">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-8 w-36 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
        <div className="space-y-4 lg:col-span-3">
          <Skeleton className="h-64 w-full rounded-3xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

/** Sem cobrança em aberto: parabéns em vez de um cartão vazio. */
function AllPaid() {
  return (
    <Panel className="flex items-center gap-4">
      <ToneIcon icon={PartyPopper} tone="success" size="lg" />
      <div className="min-w-0">
        <p className="text-lg font-semibold">Tudo pago por aqui</p>
        <p className="text-sm text-muted-foreground">Você não tem nenhum pagamento em aberto.</p>
      </div>
    </Panel>
  );
}

const SHORTCUTS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/app/payments?view=paid', label: 'Recibos', icon: Receipt },
  { href: '/app/motorcycle?km=1', label: 'Enviar km', icon: Gauge },
  { href: '/app/contract', label: 'Contrato', icon: FileText },
  { href: '/app/support', label: 'Suporte', icon: LifeBuoy },
];

/** Atalhos de um toque, como nos apps de banco. */
function Shortcuts() {
  return (
    <nav aria-label="Atalhos" className="grid grid-cols-4 gap-2 sm:gap-3">
      {SHORTCUTS.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card px-1 py-3 text-center text-[13px] font-medium leading-tight shadow-sm transition-colors hover:bg-accent/40 sm:text-sm"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <s.icon className="size-5" aria-hidden />
          </span>
          {s.label}
        </Link>
      ))}
    </nav>
  );
}

function RecentNotices() {
  const { data, isLoading } = usePortalNotifications(1);
  const open = useOpenNotification();
  const items = data?.data.slice(0, 3) ?? [];
  return (
    <Panel>
      <PanelHeader icon={Bell} tone="info" title="Avisos recentes" action={<PanelLink href="/app/notifications">Ver todos</PanelLink>} />
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-2 text-[15px] text-muted-foreground">Nenhum aviso por enquanto.</p>
      ) : (
        <RowList className="-mb-4 sm:-mb-5">
          {items.map((n) => (
            <NotificationRow key={n.id} n={n} onOpen={open} compact />
          ))}
        </RowList>
      )}
    </Panel>
  );
}

/**
 * Tela inicial do cliente (§16): saudação, situação, o próximo pagamento com o
 * botão PAGAR, a moto, o aluguel, a próxima manutenção e os avisos. No
 * computador, duas colunas: o dinheiro e a moto à esquerda; o resto à direita.
 */
export default function CustomerHomePage() {
  const { data, isLoading, error, refetch } = usePortalHome();
  const today = todayYmd();

  if (isLoading) return <HomeSkeleton />;
  if (error || !data) return <PortalError error={error} onRetry={() => void refetch()} />;

  const tone = SITUATION_TONE[data.situationTone];
  const moreThanOneLate = data.overdue && data.overdue.count > 1;

  return (
    <div className="space-y-5 lg:space-y-6">
      <PortalTitle
        title={<>Olá, {data.firstName} 👋</>}
        subtitle={<StatusPill tone={tone} className="mt-1">{data.situationLabel}</StatusPill>}
      />

      {data.pendingSignature && (
        <Notice
          tone="warning"
          icon={FilePen}
          title="Falta assinar o seu contrato"
          action={
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/app/contract">Ler e assinar</Link>
            </Button>
          }
        >
          Leia o contrato e confirme com a sua senha. Leva um minuto.
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
        <div className="space-y-4 lg:col-span-3">
          {data.nextCharge ? <NextPaymentHero charge={data.nextCharge} today={today} /> : data.motorcycle && <AllPaid />}

          {data.overdue && (
            <Panel className="border-destructive/40">
              <div className="flex items-center gap-3">
                <ToneIcon icon={CircleAlert} tone="danger" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">
                    {moreThanOneLate ? `Total em atraso (${plural(data.overdue.count, 'pagamento', 'pagamentos')})` : 'Total em atraso'}
                  </p>
                  <p className="text-2xl font-bold tabular tracking-tight text-destructive">{formatBRL(data.overdue.amount)}</p>
                  <p className="text-xs text-muted-foreground">Já com multa e juros até hoje</p>
                </div>
              </div>
              <Button asChild variant="outline" size="lg" className="mt-4 w-full">
                <Link href="/app/payments">Ver pagamentos em aberto</Link>
              </Button>
            </Panel>
          )}

          {data.motorcycle && <Shortcuts />}

          {data.motorcycle ? (
            <Panel>
              <PanelHeader icon={Bike} title="Sua moto" action={<PanelLink href="/app/motorcycle">Detalhes</PanelLink>} />
              <p className="text-xl font-bold tracking-tight">{data.motorcycle.label}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                <Plate plate={data.motorcycle.plate} />
                {data.motorcycle.color && <span>{data.motorcycle.color}</span>}
                {data.motorcycle.year && <span>{data.motorcycle.year}</span>}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4">
                {data.rent && (
                  <Metric
                    label="Seu aluguel"
                    value={
                      <>
                        {formatBRL(data.rent.amount)}
                        <span className="text-sm font-normal text-muted-foreground"> /{data.rent.unit}</span>
                      </>
                    }
                    hint={`Até ${formatYmd(data.rent.endDate)}`}
                  />
                )}
                <Metric label="Quilometragem" value={formatKm(data.motorcycle.lastKm)} hint={<Link href="/app/motorcycle?km=1" className="inline-flex items-center gap-1 font-medium text-primary"><Gauge className="size-3.5" aria-hidden /> Informar km</Link>} />
              </div>
            </Panel>
          ) : (
            <Panel className="flex flex-col items-center gap-3 py-10 text-center">
              <ToneIcon icon={Bike} tone="muted" size="lg" />
              <div className="space-y-1">
                <p className="text-lg font-semibold">Você não tem moto alugada no momento</p>
                <p className="mx-auto max-w-sm text-sm text-muted-foreground">Quer alugar? Fale com a Locamania pelo WhatsApp.</p>
              </div>
              <SupportButton />
            </Panel>
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          {data.motorcycle && (
            <MaintenanceCard
              maintenance={data.maintenance}
              headerAction={<PanelLink href="/app/maintenance">Ver</PanelLink>}
              action={data.maintenance?.status === 'OVERDUE' ? <SupportButton label="Agendar com a Locamania" variant="default" /> : undefined}
            />
          )}
          <RecentNotices />
        </div>
      </div>
    </div>
  );
}
