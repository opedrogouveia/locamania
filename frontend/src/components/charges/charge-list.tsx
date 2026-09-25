'use client';

import { CHARGE_KIND_LABELS, PAYMENT_METHOD_LABELS, Permission, fromCents, toCents, type ChargeDto } from '@locamania/shared';
import { Ban, Download, MoreHorizontal, Paperclip, QrCode, Receipt, RotateCcw, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MobileRow } from '@/components/ui/kit';
import { ChargeStatusBadge } from '@/components/ui/status-badge';
import { toast } from '@/components/ui/toaster';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { FormError } from '@/components/ui/form-error';
import { downloadFile, errorMessage, openFile } from '@/lib/api/client';
import { chargesApi, documentsApi } from '@/lib/api/resources';
import { useCan } from '@/lib/auth/use-auth';
import { useCancelCharge, useReverseCharge, useSimulatePix } from '@/lib/queries';
import { cn, formatBRL, formatDateTime, formatYmd } from '@/lib/utils';
import { PayChargeDialog } from './pay-charge-dialog';

/** Multa + juros de atraso (o `lateFees.total` da API inclui o valor da cobrança). */
function feesOf(c: ChargeDto): string {
  return c.lateFees ? fromCents(toCents(c.lateFees.fine) + toCents(c.lateFees.interest)) : '0.00';
}

/** "Aluguel semana 3 — LOC-2026-0012" vira "Aluguel semana 3" dentro do próprio contrato. */
function describe(c: ChargeDto, hide: string[]): string {
  if (!hide.includes('contract') || !c.contract) return c.description;
  const suffix = ` — ${c.contract.number}`;
  return c.description.endsWith(suffix) ? c.description.slice(0, -suffix.length) : c.description;
}

/** Pede o motivo (estorno/cancelamento) — fica no histórico. */
function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmText: string;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setReason('');
          setError(null);
        }
        onOpenChange(v);
      }}
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (reason.trim().length < 3) return setError('Escreva o motivo.');
          setBusy(true);
          try {
            await onConfirm(reason.trim());
            setReason('');
            onOpenChange(false);
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo" aria-label="Motivo" autoFocus />
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button type="submit" variant="destructive" disabled={busy}>
            {confirmText}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/** Menu de ações de uma cobrança + diálogos (pagar, estornar, cancelar). */
export function useChargeActions() {
  const canManage = useCan(Permission.PAYMENTS_MANAGE);
  const canDocs = useCan(Permission.DOCUMENTS_VIEW);
  const [paying, setPaying] = useState<ChargeDto | null>(null);
  const [reasonFor, setReasonFor] = useState<{ charge: ChargeDto; kind: 'reverse' | 'cancel' } | null>(null);
  const reverse = useReverseCharge();
  const cancel = useCancelCharge();
  const simulate = useSimulatePix();
  const confirm = useConfirm();

  async function run(fn: () => Promise<unknown>, ok?: string) {
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  function menu(c: ChargeDto) {
    const open = c.status !== 'PAID' && c.status !== 'CANCELLED';
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent">
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Ações da cobrança</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {open && canManage && (
            <DropdownMenuItem onSelect={() => setPaying(c)}>
              <Wallet /> Registrar pagamento
            </DropdownMenuItem>
          )}
          {open && canManage && (
            <DropdownMenuItem
              onSelect={async () => {
                const ok = await confirm({
                  title: 'Simular PIX pago?',
                  description: 'Ambiente de testes: gera o PIX e confirma como se o banco tivesse avisado (webhook). Nenhum valor é cobrado.',
                  confirmText: 'Simular',
                });
                if (ok) await run(() => simulate.mutateAsync(c.id), 'PIX confirmado pelo gateway (teste)');
              }}
            >
              <QrCode /> Simular PIX (teste)
            </DropdownMenuItem>
          )}
          {c.status === 'PAID' && (
            <DropdownMenuItem onSelect={() => run(() => openFile(chargesApi.receiptPath(c.id)))}>
              <Receipt /> Ver recibo
            </DropdownMenuItem>
          )}
          {c.receiptDocumentId && canDocs && (
            <DropdownMenuItem onSelect={() => run(() => openFile(documentsApi.filePath(c.receiptDocumentId!)))}>
              <Paperclip /> Ver comprovante
            </DropdownMenuItem>
          )}
          {c.status === 'PAID' && (
            <DropdownMenuItem onSelect={() => run(() => downloadFile(chargesApi.receiptPath(c.id), `recibo-${c.number}.pdf`))}>
              <Download /> Baixar recibo
            </DropdownMenuItem>
          )}
          {c.status === 'PAID' && canManage && (
            <DropdownMenuItem onSelect={() => setReasonFor({ charge: c, kind: 'reverse' })}>
              <RotateCcw /> Estornar pagamento
            </DropdownMenuItem>
          )}
          {open && canManage && (
            <DropdownMenuItem onSelect={() => setReasonFor({ charge: c, kind: 'cancel' })}>
              <Ban /> Cancelar cobrança
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const dialogs = (
    <>
      <PayChargeDialog charge={paying} open={!!paying} onOpenChange={(v) => !v && setPaying(null)} />
      <ReasonDialog
        open={!!reasonFor}
        onOpenChange={(v) => !v && setReasonFor(null)}
        title={reasonFor?.kind === 'reverse' ? 'Estornar pagamento' : 'Cancelar cobrança'}
        description={
          reasonFor?.kind === 'reverse'
            ? 'A cobrança volta a ficar em aberto. O motivo fica registrado no histórico.'
            : 'A cobrança deixa de valer. O motivo fica registrado no histórico.'
        }
        confirmText={reasonFor?.kind === 'reverse' ? 'Estornar' : 'Cancelar cobrança'}
        onConfirm={async (reason) => {
          if (!reasonFor) return;
          if (reasonFor.kind === 'reverse') await reverse.mutateAsync({ id: reasonFor.charge.id, reason });
          else await cancel.mutateAsync({ id: reasonFor.charge.id, reason });
          toast.success(reasonFor.kind === 'reverse' ? 'Pagamento estornado' : 'Cobrança cancelada');
        }}
      />
    </>
  );

  return { menu, dialogs, pay: setPaying, canManage };
}

/**
 * Tabela de cobranças (pagamentos, ficha do cliente, contrato). `hide` tira
 * colunas redundantes no contexto (ex.: cliente dentro da ficha do cliente).
 */
export function ChargeList({
  rows,
  loading,
  hide = [],
  empty,
}: {
  rows: ChargeDto[] | undefined;
  loading?: boolean;
  hide?: ('customer' | 'contract' | 'kind')[];
  empty?: { title: string; description?: string };
}) {
  const actions = useChargeActions();
  const columns: Column<ChargeDto>[] = [
    {
      key: 'due',
      header: 'Vencimento',
      cell: (c) => <span className="whitespace-nowrap tabular">{formatYmd(c.dueDate)}</span>,
    },
    ...(hide.includes('customer')
      ? []
      : [
          {
            key: 'customer',
            header: 'Cliente',
            cell: (c: ChargeDto) => (
              <Link href={`/admin/customers/${c.customer.id}`} className="block max-w-[14rem] truncate font-medium hover:underline xl:max-w-[18rem]" title={c.customer.label} onClick={(e) => e.stopPropagation()}>
                {c.customer.label}
              </Link>
            ),
          },
        ]),
    {
      key: 'desc',
      header: 'Descrição',
      className: 'w-full max-w-0',
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate" title={describe(c, hide)}>
            {describe(c, hide)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {c.number}
            {!hide.includes('contract') && c.contract && ` · ${c.contract.number}`}
            {!hide.includes('kind') && c.kind !== 'RENT' && ` · ${CHARGE_KIND_LABELS[c.kind]}`}
          </p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Valor',
      align: 'right',
      cell: (c) => (
        <div>
          <p className="whitespace-nowrap font-medium">{formatBRL(c.paidAmount ?? c.amount)}</p>
          {c.lateFees && c.lateFees.daysLate > 0 && <p className="whitespace-nowrap text-xs text-destructive">+{formatBRL(feesOf(c))} encargos</p>}
        </div>
      ),
    },
    { key: 'status', header: 'Situação', cell: (c) => <ChargeStatusBadge status={c.displayStatus} /> },
    {
      key: 'paid',
      header: 'Pagamento',
      hideBelow: 'lg',
      cell: (c) =>
        c.paidAt ? (
          <div className="whitespace-nowrap text-xs">
            <p>{formatDateTime(c.paidAt)}</p>
            <p className="text-muted-foreground">
              {c.method ? PAYMENT_METHOD_LABELS[c.method] : ''}
              {c.confirmedByGateway && ' · automático'}
            </p>
          </div>
        ) : c.lateFees && c.lateFees.daysLate > 0 ? (
          <span className="whitespace-nowrap text-xs text-destructive">{c.lateFees.daysLate} dias de atraso</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { key: 'actions', header: '', align: 'right', className: 'w-12', cell: (c) => actions.menu(c) },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        loading={loading}
        columns={columns}
        rowKey={(c) => c.id}
        empty={{ icon: Receipt, title: empty?.title ?? 'Nenhuma cobrança', description: empty?.description }}
        rowClassName={(c) => cn(c.displayStatus === 'OVERDUE' && 'bg-destructive/[0.03]')}
        mobileCard={(c) => (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <MobileRow
                wrapTitle
                title={hide.includes('customer') ? describe(c, hide) : c.customer.label}
                subtitle={hide.includes('customer') ? `${c.number} · vence ${formatYmd(c.dueDate)}` : describe(c, hide)}
                meta={
                  <>
                    <ChargeStatusBadge status={c.displayStatus} />
                    {!hide.includes('customer') && !c.paidAt && <span className="tabular">vence {formatYmd(c.dueDate)}</span>}
                    {c.paidAt ? (
                      <span>
                        Pago em {formatDateTime(c.paidAt)}
                        {c.method && ` · ${PAYMENT_METHOD_LABELS[c.method]}`}
                      </span>
                    ) : c.lateFees && c.lateFees.daysLate > 0 ? (
                      <span className="text-destructive">
                        {c.lateFees.daysLate} dias · +{formatBRL(feesOf(c))} encargos
                      </span>
                    ) : null}
                  </>
                }
                right={<span className="text-sm font-semibold tabular">{formatBRL(c.paidAmount ?? c.amount)}</span>}
              />
            </div>
            <div className="-mr-2 -mt-2">{actions.menu(c)}</div>
          </div>
        )}
      />
      {actions.dialogs}
    </>
  );
}


