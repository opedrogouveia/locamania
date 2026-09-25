'use client';

import { PERIODICITY_UNIT, formatYmd, type PortalContractDto } from '@locamania/shared';
import { CheckCircle2, Download, Eye, FilePen, FileText, ImageIcon, ShieldCheck, WifiOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Metric, Notice, Panel, PanelHeader, Plate, PortalEmpty, PortalError, PortalSkeleton, PortalTitle, RowLink, RowList, SupportButton } from '@/components/portal/kit';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormError } from '@/components/ui/form-error';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ContractStatusBadge } from '@/components/ui/status-badge';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { portalApi } from '@/lib/api/portal';
import { formatDay, formatTime } from '@/lib/portal/format';
import { useFileAction } from '@/lib/portal/queries';
import { useAcceptContract, usePortalContract, usePortalContractText, usePortalDocuments, usePortalMotorcycle } from '@/lib/queries/portal';
import { useOnline } from '@/lib/use-online';
import { formatBRL } from '@/lib/utils';

/**
 * Aceite eletrônico (§10): ler o texto, marcar "li e concordo" e confirmar com
 * a senha. A API grava data, IP, aparelho e o código do texto aceito.
 */
function AcceptContract({ contract }: { contract: PortalContractDto }) {
  const text = usePortalContractText(true);
  const accept = useAcceptContract();
  const online = useOnline();
  const [agreed, setAgreed] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agreed) return setError('Marque "Li e concordo" para continuar.');
    if (!password) return setError('Digite sua senha para confirmar.');
    try {
      await accept.mutateAsync(password);
      toast.success('Contrato assinado. Obrigado!');
      setPassword('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Panel className="border-warning/50 p-5 sm:p-6">
      <PanelHeader icon={FilePen} tone="warning" title="Assinar o contrato" />
      <p className="mb-4 text-[15px] text-muted-foreground">Leia com atenção. Para assinar, marque que concorda e confirme com a senha do aplicativo.</p>

      <div
        className="max-h-[45dvh] overflow-y-auto rounded-xl border border-border bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-wrap sm:max-h-[420px] sm:p-5"
        role="region"
        aria-label={`Texto do contrato ${contract.number}`}
      >
        {text.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : text.error ? (
          <p className="text-destructive">{errorMessage(text.error)}</p>
        ) : (
          text.data?.text
        )}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        <label htmlFor="contract-agree" className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 hover:bg-accent/40">
          <Checkbox id="contract-agree" checked={agreed} onCheckedChange={setAgreed} className="mt-0.5 size-6" />
          <span className="text-[15px]">
            <span className="font-semibold">Li e concordo</span> com o contrato {contract.number}.
          </span>
        </label>
        <div className="space-y-1.5">
          <Label htmlFor="contract-password">Sua senha do aplicativo</Label>
          <PasswordInput
            id="contract-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12"
            enterKeyHint="done"
          />
        </div>
        {!online && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
            <WifiOff className="size-4" aria-hidden /> Sem conexão com a internet.
          </p>
        )}
        <FormError message={error} />
        <Button type="submit" size="lg" className="h-13 w-full text-base sm:w-auto" disabled={accept.isPending || !online || !text.data}>
          {accept.isPending ? <Spinner /> : <ShieldCheck />} Assinar contrato
        </Button>
        <p className="text-xs text-muted-foreground">A assinatura fica registrada com data, hora e o aparelho usado.</p>
      </form>
    </Panel>
  );
}

/**
 * Meu contrato (§10, §17): resumo, PDF (ver/baixar), documentos liberados e o
 * aceite eletrônico quando falta a assinatura.
 */
export default function ContractPage() {
  const { data: contract, isLoading, error, refetch } = usePortalContract();
  const docs = usePortalDocuments();
  const moto = usePortalMotorcycle();
  const files = useFileAction();

  if (isLoading) return <PortalSkeleton />;
  if (error) return <PortalError error={error} onRetry={() => void refetch()} />;
  if (!contract) {
    return (
      <div className="space-y-5">
        <PortalTitle title="Meu contrato" />
        <PortalEmpty icon={FileText} title="Você ainda não tem contrato" description="Quando a Locamania preparar o seu contrato, ele aparece aqui para você ler e assinar." action={<SupportButton />} />
      </div>
    );
  }

  // Os documentos da moto já estão em "Minha moto"; aqui ficam os do cliente e do contrato.
  const motoDocIds = new Set(moto.data?.documents.map((d) => d.id) ?? []);
  const myDocs = (docs.data ?? []).filter((d) => !motoDocIds.has(d.id));
  const pdfPath = portalApi.contractPdfPath();
  const signed = contract.signatureStatus === 'SIGNED';

  return (
    <div className="space-y-5 lg:space-y-6">
      <PortalTitle title="Meu contrato" subtitle={<>Nº {contract.number}</>} actions={<ContractStatusBadge status={contract.status} className="px-3 py-1 text-sm" />} />

      {contract.canAccept && (
        <Notice tone="warning" icon={FilePen} title="Falta a sua assinatura">
          Leia o contrato abaixo e assine pelo aplicativo.
        </Notice>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5 lg:gap-6">
        <div className="space-y-4 lg:col-span-3">
          <Panel className="p-5 sm:p-6">
            <PanelHeader icon={FileText} title="Resumo" />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-lg font-semibold">{contract.motorcycle.label}</p>
              <Plate plate={contract.motorcycle.plate} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-border pt-5">
              <Metric
                label="Aluguel"
                value={
                  <>
                    {formatBRL(contract.rentAmount)}
                    <span className="text-sm font-normal text-muted-foreground"> /{PERIODICITY_UNIT[contract.periodicity]}</span>
                  </>
                }
              />
              <Metric label="Caução" value={contract.depositAmount ? formatBRL(contract.depositAmount) : '—'} />
              <Metric label="Início" value={formatYmd(contract.startDate)} />
              <Metric label="Término" value={formatYmd(contract.endDate)} />
            </div>
            <div className="mt-5 flex items-center gap-2.5 rounded-xl bg-muted/60 px-3.5 py-3 text-sm">
              {signed ? (
                <>
                  <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
                  <span>
                    <span className="font-medium">Assinado</span>
                    {contract.signedAt && <span className="text-muted-foreground"> em {formatDay(contract.signedAt)} às {formatTime(contract.signedAt)}</span>}
                  </span>
                </>
              ) : (
                <>
                  <FilePen className="size-5 shrink-0 text-warning" aria-hidden />
                  <span className="font-medium">Aguardando a sua assinatura</span>
                </>
              )}
            </div>
          </Panel>

          {contract.canAccept && <AcceptContract contract={contract} />}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <PanelHeader icon={FileText} title="Contrato em PDF" />
            <p className="mb-4 text-sm text-muted-foreground">Veja, imprima ou guarde uma cópia no celular.</p>
            <div className="grid grid-cols-2 gap-2.5">
              <Button size="lg" disabled={files.busy === 'pdf'} onClick={() => void files.open(pdfPath, 'pdf')}>
                {files.busy === 'pdf' ? <Spinner /> : <Eye />} Ver
              </Button>
              <Button
                variant="outline"
                size="lg"
                disabled={files.busy === 'pdf-download'}
                onClick={() => void files.download(pdfPath, `contrato-${contract.number}.pdf`, 'pdf-download')}
              >
                {files.busy === 'pdf-download' ? <Spinner /> : <Download />} Baixar
              </Button>
            </div>
          </Panel>

          <Panel>
            <PanelHeader icon={FileText} title="Seus documentos" />
            {docs.isLoading ? (
              <Skeleton className="h-14 w-full" />
            ) : myDocs.length === 0 ? (
              <p className="py-1 text-[15px] text-muted-foreground">Nenhum documento liberado para você.</p>
            ) : (
              <RowList className="-mb-4 sm:-mb-5">
                {myDocs.map((d) => (
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
    </div>
  );
}
