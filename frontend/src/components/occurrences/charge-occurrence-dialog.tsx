'use client';

import { addDays, OCCURRENCE_TYPE_LABELS, type OccurrenceDto } from '@locamania/shared';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/kit';
import { MoneyInput } from '@/components/ui/masked-input';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useChargeOccurrence } from '@/lib/queries';
import { formatBRL, todayYmd } from '@/lib/utils';

function defaultDescription(o: OccurrenceDto): string {
  return `${OCCURRENCE_TYPE_LABELS[o.type]}${o.fineNumber ? ` ${o.fineNumber}` : ''} — ${o.description}`.slice(0, 200);
}

/** "Cobrar do cliente" (§22): vira uma cobrança avulsa que aparece nos pagamentos e no app dele. */
function ChargeForm({ occurrence, onDone }: { occurrence: OccurrenceDto; onDone: () => void }) {
  const today = todayYmd();
  const charge = useChargeOccurrence(occurrence.id);
  const [amount, setAmount] = useState(occurrence.amount ?? '');
  // Multa: vence um pouco antes do vencimento da multa, para dar tempo de pagar o Detran.
  const [dueDate, setDueDate] = useState(() => {
    const fine = occurrence.fineDueDate;
    const suggested = fine ? addDays(fine, -3) : addDays(today, 7);
    return suggested < today ? today : suggested;
  });
  const [description, setDescription] = useState(defaultDescription(occurrence));
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!amount || Number(amount) <= 0) return setError('Informe o valor a cobrar.');
    if (!dueDate) return setError('Informe o vencimento.');
    try {
      await charge.mutateAsync({ amount, dueDate, description: description.trim() || null });
      toast.success('Cobrança criada', { description: `${formatBRL(amount)} para ${occurrence.customer?.label ?? 'o cliente'}` });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <DialogHeader>
        <DialogTitle>Cobrar do cliente</DialogTitle>
        <DialogDescription>
          Cria uma cobrança avulsa para {occurrence.customer?.label ?? 'o cliente'}. Ela aparece em Pagamentos e no aplicativo dele.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Valor" required>
          {(id) => <MoneyInput id={id} value={amount} onValue={setAmount} placeholder="0,00" autoFocus />}
        </Field>
        <Field label="Vencimento" required hint={occurrence.fineDueDate ? 'Sugestão: 3 dias antes do vencimento da multa.' : undefined}>
          {(id) => <Input id={id} type="date" value={dueDate} min={today} onChange={(e) => setDueDate(e.target.value)} />}
        </Field>
      </div>
      <Field label="Descrição na cobrança" hint="É o que o cliente lê no aplicativo e no recibo.">
        {(id) => <Input id={id} value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />}
      </Field>
      <FormError message={error} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={charge.isPending}>
          {charge.isPending && <Loader2 className="animate-spin" />}
          Criar cobrança
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ChargeOccurrenceDialog({ occurrence, open, onOpenChange }: { occurrence: OccurrenceDto; open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <ChargeForm occurrence={occurrence} onDone={() => onOpenChange(false)} />}
    </Dialog>
  );
}
