'use client';

import { PAYMENT_METHOD_LABELS, PaymentMethod, fromCents, toCents, todayYmd, type ChargeDto } from '@locamania/shared';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Field, FormGrid } from '@/components/ui/kit';
import { MoneyInput } from '@/components/ui/masked-input';
import { SelectMenu } from '@/components/ui/select-menu';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { usePayCharge } from '@/lib/queries';
import { formatBRL, formatYmd } from '@/lib/utils';

/**
 * Dar baixa numa cobrança: forma, data, encargos sugeridos (multa e juros de
 * atraso calculados pela API) e desconto. O total pago é a soma — a pessoa
 * confere antes de confirmar.
 */
export function PayChargeDialog({ charge, open, onOpenChange }: { charge: ChargeDto | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const pay = usePayCharge();
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [paidAt, setPaidAt] = useState(todayYmd());
  const [fine, setFine] = useState('');
  const [interest, setInterest] = useState('');
  const [discount, setDiscount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !charge) return;
    setMethod(PaymentMethod.PIX);
    setPaidAt(todayYmd());
    setFine(charge.lateFees?.fine && toCents(charge.lateFees.fine) > 0 ? charge.lateFees.fine : '');
    setInterest(charge.lateFees?.interest && toCents(charge.lateFees.interest) > 0 ? charge.lateFees.interest : '');
    setDiscount('');
    setNotes('');
    setError(null);
  }, [open, charge]);

  if (!charge) return null;
  const totalCents = toCents(charge.amount) + toCents(fine || 0) + toCents(interest || 0) - toCents(discount || 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!charge) return;
    setError(null);
    if (totalCents <= 0) return setError('O total pago precisa ser maior que zero.');
    try {
      await pay.mutateAsync({
        id: charge.id,
        paidAt,
        method,
        paidAmount: fromCents(totalCents),
        fineAmount: fine || null,
        interestAmount: interest || null,
        discountAmount: discount || null,
        notes: notes || null,
      });
      toast.success('Pagamento registrado', { description: `${charge.customer.label} · ${formatBRL(fromCents(totalCents))}` });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={submit} className="space-y-4">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            {charge.customer.label} · {charge.description} · vence {formatYmd(charge.dueDate)}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-muted/60 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor da cobrança</span>
            <span className="tabular">{formatBRL(charge.amount)}</span>
          </div>
          {charge.lateFees && charge.lateFees.daysLate > 0 && (
            <p className="mt-1 text-xs text-destructive">
              {charge.lateFees.daysLate} dias de atraso · encargos sugeridos {formatBRL(charge.lateFees.total)}
            </p>
          )}
        </div>
        <FormGrid>
          <Field label="Forma de pagamento" required>
            {(id) => (
              <SelectMenu
                id={id}
                value={method}
                onChange={(v) => setMethod(v as PaymentMethod)}
                options={Object.values(PaymentMethod).map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
              />
            )}
          </Field>
          <Field label="Data do pagamento" required>
            {(id) => <Input id={id} type="date" value={paidAt} max={todayYmd()} onChange={(e) => setPaidAt(e.target.value)} required />}
          </Field>
          <Field label="Multa">{(id) => <MoneyInput id={id} value={fine} onValue={setFine} />}</Field>
          <Field label="Juros">{(id) => <MoneyInput id={id} value={interest} onValue={setInterest} />}</Field>
          <Field label="Desconto">{(id) => <MoneyInput id={id} value={discount} onValue={setDiscount} />}</Field>
          <div className="flex flex-col justify-end rounded-lg border border-border p-3">
            <span className="text-xs text-muted-foreground">Total pago</span>
            <span className="text-lg font-semibold tabular">{formatBRL(fromCents(Math.max(totalCents, 0)))}</span>
          </div>
        </FormGrid>
        <Field label="Observações">{(id) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pay.isPending}>
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
