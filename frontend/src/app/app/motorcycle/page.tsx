'use client';

import { Bike, FileText, Gauge, ImageIcon } from 'lucide-react';
import { useState } from 'react';

import { MaintenanceCard } from '@/components/portal/maintenance-card';
import { Panel, PanelHeader, PanelLink, Plate, PortalEmpty, PortalError, PortalSkeleton, PortalTitle, RowLink, RowList, SupportButton, ToneIcon } from '@/components/portal/kit';
import { OdometerDialog } from '@/components/portal/odometer-dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { portalApi } from '@/lib/api/portal';
import { formatDay, formatTime } from '@/lib/portal/format';
import { useFileAction } from '@/lib/portal/queries';
import { usePortalMotorcycle } from '@/lib/queries/portal';
import { useUrlState } from '@/lib/use-url-state';
import { formatKm } from '@/lib/utils';

/**
 * Minha moto (§9, §17, §20): dados básicos, quilometragem com "Informar km",
 * a próxima manutenção e os documentos que a Locamania liberou (CRLV…).
 */
export default function MotorcyclePage() {
  const { data, isLoading, error, refetch } = usePortalMotorcycle();
  const [url, setUrl, ready] = useUrlState({ km: '' });
  const [openLocal, setOpenLocal] = useState(false);
  const files = useFileAction();

  // "?km=1" (atalho da tela inicial) abre direto o "Informar quilometragem".
  const kmOpen = openLocal || (ready && url.km === '1');
  const setKmOpen = (open: boolean) => {
    setOpenLocal(open);
    if (!open && url.km) setUrl({ km: '' });
  };

  if (isLoading) return <PortalSkeleton />;
  if (error) return <PortalError error={error} onRetry={() => void refetch()} />;
  if (!data) {
    return (
      <div className="space-y-5">
        <PortalTitle title="Minha moto" />
        <PortalEmpty icon={Bike} title="Você não tem moto alugada no momento" description="Quando o seu aluguel começar, os dados da moto aparecem aqui." action={<SupportButton />} />
      </div>
    );
  }

  const { motorcycle: m, maintenance, documents } = data;

  return (
    <div className="space-y-5 lg:space-y-6">
      <PortalTitle title="Minha moto" />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5 lg:gap-6">
        <div className="space-y-4 lg:col-span-3">
          <Panel className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <ToneIcon icon={Bike} tone="primary" size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">{m.brand}</p>
                <p className="text-2xl font-bold leading-tight tracking-tight">{m.model}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                  <Plate plate={m.plate} className="text-base" />
                  {m.color && <span>{m.color}</span>}
                  {m.year && <span>Ano {m.year}</span>}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-muted/60 p-4 sm:p-5">
              <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Gauge className="size-4" aria-hidden /> Quilometragem
              </p>
              <p className="mt-1 text-4xl font-bold tracking-tight tabular">{formatKm(m.lastKm)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {m.lastKmAt ? `Última leitura em ${formatDay(m.lastKmAt)} às ${formatTime(m.lastKmAt)}` : 'Ainda sem leitura registrada'}
              </p>
              <Button size="lg" className="mt-4 h-12 w-full text-base sm:w-auto" onClick={() => setKmOpen(true)}>
                <Gauge /> Informar quilometragem
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">Informar o km ajuda a avisar na hora certa da manutenção.</p>
            </div>
          </Panel>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <MaintenanceCard
            maintenance={maintenance}
            headerAction={<PanelLink href="/app/maintenance">Ver</PanelLink>}
            action={maintenance?.status === 'OVERDUE' ? <SupportButton label="Agendar com a Locamania" variant="default" /> : undefined}
          />

          <Panel>
            <PanelHeader icon={FileText} title="Documentos da moto" />
            {documents.length === 0 ? (
              <p className="py-1 text-[15px] text-muted-foreground">Nenhum documento liberado. Se precisar do documento da moto (CRLV), peça à Locamania.</p>
            ) : (
              <RowList className="-mb-4 sm:-mb-5">
                {documents.map((d) => (
                  <RowLink
                    key={d.id}
                    onClick={() => void files.open(portalApi.documentPath(d.id), d.id)}
                    icon={d.mimeType.startsWith('image/') ? ImageIcon : FileText}
                    title={d.title}
                    subtitle={d.typeLabel}
                    right={files.busy === d.id ? <Spinner /> : <span className="text-sm font-medium text-primary">Abrir</span>}
                    chevron={false}
                  />
                ))}
              </RowList>
            )}
          </Panel>
        </div>
      </div>

      <OdometerDialog open={kmOpen} onOpenChange={setKmOpen} lastKm={m.lastKm} />
    </div>
  );
}
