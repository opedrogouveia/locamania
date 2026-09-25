'use client';

import { Permission } from '@locamania/shared';
import { Ban, CheckCircle2, Gavel, Loader2, MoreHorizontal, Receipt, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FormError } from '@/components/ui/form-error';
import { Field } from '@/components/ui/kit';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { useSetCollection, useSetCustomerManualStatus } from '@/lib/contracts/queries';

export interface DelinquencyTarget {
  id: string;
  name: string;
  status: string;
  inCollection: boolean;
  daysLate?: number;
}

/** Bloqueio administrativo com motivo (§14). Não bloqueia a moto — isso é no rastreamento. */
function BlockDialog({
  target,
  onOpenChange,
}: {
  target: DelinquencyTarget | null;
  onOpenChange: (v: boolean) => void;
}) {
  const setStatus = useSetCustomerManualStatus();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setReason(target.daysLate ? `Pagamento em atraso há ${target.daysLate} dias.` : '');
      setError(null);
    }
  }, [target]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    if (reason.trim().length < 3) return setError('Escreva o motivo.');
    try {
      await setStatus.mutateAsync({
        id: target.id,
        manualStatus: 'BLOCKED',
        reason: reason.trim(),
      });
      toast.success('Cliente bloqueado', { description: target.name });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <form onSubmit={submit} className="space-y-4">
        <DialogHeader>
          <DialogTitle>Bloquear {target?.name}?</DialogTitle>
          <DialogDescription>
            O cliente fica impedido de novos aluguéis até ser desbloqueado. A moto não é bloqueada —
            isso é feito no rastreamento, com confirmação.
          </DialogDescription>
        </DialogHeader>
        <Field label="Motivo" required hint="Fica na ficha e no histórico.">
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
          )}
        </Field>
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button type="submit" variant="destructive" disabled={setStatus.isPending}>
            {setStatus.isPending && <Loader2 className="animate-spin" />} Bloquear
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/**
 * Ações por cliente da inadimplência: ver pagamentos, bloquear/desbloquear,
 * encaminhar/retirar da cobrança. Devolve o menu e os diálogos.
 */
export function useDelinquencyActions() {
  const router = useRouter();
  const canBlock = useCan(Permission.CUSTOMERS_MANAGE);
  const canCollect = useCan(Permission.PAYMENTS_MANAGE);
  const collection = useSetCollection();
  const status = useSetCustomerManualStatus();
  const confirm = useConfirm();
  const [blocking, setBlocking] = useState<DelinquencyTarget | null>(null);

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function toggleCollection(t: DelinquencyTarget) {
    if (t.inCollection) {
      if (
        await confirm({
          title: 'Retirar da cobrança?',
          description: `${t.name} volta para a lista comum de atrasos.`,
          confirmText: 'Retirar',
        })
      )
        await run(
          () => collection.mutateAsync({ id: t.id, inCollection: false }),
          'Cliente retirado da cobrança',
        );
      return;
    }
    if (
      await confirm({
        title: `Encaminhar ${t.name} para cobrança?`,
        description: 'Marca o cliente como "em cobrança". Os lembretes automáticos continuam.',
        confirmText: 'Encaminhar',
      })
    )
      await run(
        () => collection.mutateAsync({ id: t.id, inCollection: true }),
        'Cliente encaminhado para cobrança',
      );
  }

  async function unblock(t: DelinquencyTarget) {
    if (
      await confirm({
        title: `Desbloquear ${t.name}?`,
        description:
          'A situação volta a ser calculada (continua "em atraso" enquanto houver dívida).',
        confirmText: 'Desbloquear',
      })
    )
      await run(() => status.mutateAsync({ id: t.id, manualStatus: null }), 'Cliente desbloqueado');
  }

  function menu(t: DelinquencyTarget, { showPayments = true }: { showPayments?: boolean } = {}) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className="flex size-10 shrink-0 items-center justify-center rounded-md border border-input bg-card text-muted-foreground hover:bg-accent">
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Mais ações para {t.name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {showPayments && (
            <DropdownMenuItem onSelect={() => router.push(`/admin/customers/${t.id}?tab=payments`)}>
              <Receipt /> Ver pagamentos
            </DropdownMenuItem>
          )}
          {canCollect && (
            <DropdownMenuItem onSelect={() => toggleCollection(t)}>
              {t.inCollection ? <Undo2 /> : <Gavel />}{' '}
              {t.inCollection ? 'Retirar da cobrança' : 'Encaminhar para cobrança'}
            </DropdownMenuItem>
          )}
          {canBlock && (
            <>
              <DropdownMenuSeparator />
              {t.status === 'BLOCKED' ? (
                <DropdownMenuItem onSelect={() => unblock(t)}>
                  <CheckCircle2 /> Desbloquear cliente
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem variant="destructive" onSelect={() => setBlocking(t)}>
                  <Ban /> Bloquear cliente
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const dialogs = <BlockDialog target={blocking} onOpenChange={(v) => !v && setBlocking(null)} />;
  return { menu, dialogs };
}

/** Botão "Ver pagamentos" (ficha do cliente já na aba). */
export function PaymentsLink({
  customerId,
  className,
}: {
  customerId: string;
  className?: string;
}) {
  return (
    <Button asChild variant="outline" className={className}>
      <Link href={`/admin/customers/${customerId}?tab=payments`}>
        <Receipt /> Pagamentos
      </Link>
    </Button>
  );
}
