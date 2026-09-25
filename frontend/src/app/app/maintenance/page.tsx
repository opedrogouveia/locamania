'use client';

import { formatYmd } from '@locamania/shared';
import { CheckCircle2, Gauge, History, Info, Wrench } from 'lucide-react';
import Link from 'next/link';

import { MaintenanceCard } from '@/components/portal/maintenance-card';
import { Notice, Panel, PanelHeader, PortalEmpty, PortalError, PortalSkeleton, PortalTitle, SupportButton, ToneIcon } from '@/components/portal/kit';
import { Button } from '@/components/ui/button';
import { usePortalHome, usePortalMaintenance } from '@/lib/queries/portal';

/**
 * Manutenção para o cliente (§9): só o necessário — a próxima manutenção, o
 * aviso quando precisa levar a moto e o que já foi feito no aluguel dele. Sem
 * custo, oficina ou informação interna.
 */
export default function MaintenancePage() {
  const { data, isLoading, error, refetch } = usePortalMaintenance();
  // Sem moto alugada a API devolve vazio; a tela inicial diz se há aluguel.
  const home = usePortalHome();

  if (isLoading) return <PortalSkeleton cards={2} />;
  if (error || !data) return <PortalError error={error} onRetry={() => void refetch()} />;

  if (home.data && !home.data.motorcycle) {
    return (
      <div className="space-y-5">
        <PortalTitle title="Manutenção" />
        <PortalEmpty icon={Wrench} title="Você não tem moto alugada no momento" description="Os avisos de manutenção aparecem aqui durante o aluguel." action={<SupportButton />} />
      </div>
    );
  }

  const next = data.next;
  const needsAction = next?.status === 'OVERDUE';
  const soon = next?.status === 'DUE_SOON';

  return (
    <div className="space-y-5 lg:space-y-6">
      <PortalTitle title="Manutenção" subtitle="A Locamania cuida da manutenção da sua moto. Aqui você vê quando é a próxima." />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5 lg:gap-6">
        <div className="space-y-4 lg:col-span-3">
          <MaintenanceCard
            maintenance={next}
            action={
              needsAction || soon ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <SupportButton label={needsAction ? 'Agendar com a Locamania' : 'Falar com a Locamania'} variant={needsAction ? 'default' : 'outline'} />
                  <Button asChild variant="ghost" size="lg">
                    <Link href="/app/motorcycle?km=1">
                      <Gauge /> Informar km
                    </Link>
                  </Button>
                </div>
              ) : undefined
            }
          />
          <Notice tone="info" icon={Info} title="Dica">
            Informe a quilometragem da moto de vez em quando em <Link href="/app/motorcycle" className="font-medium text-primary underline-offset-4 hover:underline">Minha moto</Link>. Assim o aviso de manutenção chega na hora certa.
          </Notice>
        </div>

        <Panel className="lg:col-span-2">
          <PanelHeader icon={History} tone="success" title="Já feito no seu aluguel" />
          {data.history.length === 0 ? (
            <p className="py-1 text-[15px] text-muted-foreground">Nenhuma manutenção feita ainda neste aluguel.</p>
          ) : (
            <ol className="relative space-y-5 pl-1">
              {data.history.map((h, i) => (
                <li key={`${h.date}-${i}`} className="relative flex gap-3">
                  {i < data.history.length - 1 && <span className="absolute left-4 top-9 -bottom-5 w-px bg-border" aria-hidden />}
                  <ToneIcon icon={CheckCircle2} tone="success" size="sm" className="rounded-full" />
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="text-[15px] font-semibold">{formatYmd(h.date)}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {h.types.map((t) => (
                        <span key={t} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
