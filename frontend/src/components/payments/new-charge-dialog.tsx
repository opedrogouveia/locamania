'use client';

import {
  CHARGE_KIND_LABELS,
  CHARGE_KINDS,
  CONTRACT_STATUS_LABELS,
  toCents,
  todayYmd,
  type ChargeKind,
} from '@locamania/shared';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { CustomerLookup } from '@/components/pickers/entity-lookup';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Field, FormGrid } from '@/components/ui/kit';
import { MoneyInput } from '@/components/ui/masked-input';
import { SelectMenu } from '@/components/ui/select-menu';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useContracts, useCreateCharge } from '@/lib/queries';
import { formatBRL, formatPlate, formatYmd } from '@/lib/utils';

/** Multa, avaria e outros primeiro; aluguel avulso (ex.: dias extras) no fim. */
const KINDS: ChargeKind[] = [...CHARGE_KINDS.filter((k) => k !== 'RENT'), 'RENT'];

/**
 * Cobrança avulsa (§11): multa repassada, avaria, taxa, caução... O cliente
 * recebe o aviso e ela entra nos pagamentos dele como qualquer outra.
 */
export function NewChargeDialog({
  open,
  onOpenChange,
  customerId: presetCustomer,
  customerLabel: presetLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId?: string | null;
  customerLabel?: string | null;
}) {
  const create = useCreateCharge();
  const [customer, setCustomer] = useState<{ id: string | null; label: string | null }>({
    id: null,
    label: null,
  });
  const [contractId, setContractId] = useState('');
  const [kind, setKind] = useState<ChargeKind>('OTHER');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(todayYmd());
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCustomer({ id: presetCustomer ?? null, label: presetLabel ?? null });
    setContractId('');
    setKind('OTHER');
    setDescription('');
    setDueDate(todayYmd());
    setAmount('');
    setErrors({});
    setError(null);
  }, [open, presetCustomer, presetLabel]);

  const contracts = useContracts(
    { customerId: customer.id ?? undefined, pageSize: 20 },
    open && !!customer.id,
  );
  const options = useMemo(
    () => (contracts.data?.data ?? []).filter((c) => c.status === 'ACTIVE' || c.status === 'ENDED'),
    [contracts.data],
  );
  // O contrato ativo já vem escolhido (liga a cobrança à moto do aluguel).
  useEffect(() => {
    const active = options.find((c) => c.status === 'ACTIVE');
    setContractId(active?.id ?? '');
  }, [options]);
  const contract = options.find((c) => c.id === contractId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const found: Record<string, string> = {};
    if (!customer.id) found.customer = 'Escolha o cliente.';
    if (description.trim().length < 3) found.description = 'Descreva a cobrança.';
    if (!dueDate) found.dueDate = 'Informe o vencimento.';
    if (toCents(amount) <= 0) found.amount = 'Informe o valor.';
    setErrors(found);
    if (Object.keys(found).length) return;
    try {
      const c = await create.mutateAsync({
        customerId: customer.id!,
        contractId: contract?.id ?? null,
        motorcycleId: contract?.motorcycle.id ?? null,
        kind,
        description: description.trim(),
        dueDate,
        amount,
      });
      toast.success('Cobrança criada', {
        description: `${c.customer.label} · ${formatBRL(c.amount)} para ${formatYmd(c.dueDate)}. O cliente foi avisado.`,
      });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <DialogHeader>
          <DialogTitle>Nova cobrança avulsa</DialogTitle>
          <DialogDescription>
            Multa, avaria, taxa ou outro valor fora do aluguel. O cliente recebe o aviso.
          </DialogDescription>
        </DialogHeader>
        <Field label="Cliente" required error={errors.customer}>
          {(id) => (
            <CustomerLookup
              id={id}
              value={customer.id}
              valueLabel={customer.label}
              onChange={(cid, label) => setCustomer({ id: cid, label: label ?? null })}
            />
          )}
        </Field>
        {customer.id && (
          <Field
            label="Contrato"
            hint={
              options.length === 0 && !contracts.isLoading
                ? 'Este cliente não tem contrato — a cobrança fica só no cliente.'
                : 'Liga a cobrança ao aluguel e à moto.'
            }
          >
            {(id) => (
              <SelectMenu
                id={id}
                value={contractId}
                onChange={setContractId}
                placeholder="Sem contrato"
                options={options.map((c) => ({
                  value: c.id,
                  label: `${c.number} · ${formatPlate(c.motorcycle.plate)}`,
                  hint: CONTRACT_STATUS_LABELS[c.status],
                }))}
              />
            )}
          </Field>
        )}
        <FormGrid>
          <Field label="Tipo" required>
            {(id) => (
              <SelectMenu
                id={id}
                value={kind}
                onChange={(v) => setKind(v as ChargeKind)}
                options={KINDS.map((k) => ({ value: k, label: CHARGE_KIND_LABELS[k] }))}
              />
            )}
          </Field>
          <Field label="Valor" required error={errors.amount}>
            {(id) => <MoneyInput id={id} value={amount} onValue={setAmount} />}
          </Field>
        </FormGrid>
        <Field label="Descrição" required error={errors.description} hint="Aparece para o cliente.">
          {(id) => (
            <Input
              id={id}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              placeholder="Ex.: multa por excesso de velocidade (AIT 123)"
            />
          )}
        </Field>
        <Field label="Vencimento" required error={errors.dueDate}>
          {(id) => (
            <Input
              id={id}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="sm:max-w-xs"
            />
          )}
        </Field>
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" />} Criar cobrança
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
