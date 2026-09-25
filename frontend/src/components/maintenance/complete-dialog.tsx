'use client';

import {
  Permission,
  todayYmd,
  type CompleteMaintenanceRequest,
  type MaintenanceRecordDto,
} from '@locamania/shared';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { Plate } from '@/components/motorcycles/plate';
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
import { MoneyInput, NumberInput } from '@/components/ui/masked-input';
import { SelectMenu } from '@/components/ui/select-menu';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { useWorkshopSuggestions } from '@/lib/motorcycles/queries';
import { useCompleteMaintenance, useMotorcycle } from '@/lib/queries';
import { formatKm } from '@/lib/utils';

/**
 * Concluir (§41): data, km, serviço, peças, valor e oficina. O sistema recalcula
 * o próximo intervalo de cada serviço feito e devolve a moto para a situação certa.
 */
export function CompleteMaintenanceDialog({
  record,
  open,
  onOpenChange,
  onDone,
}: {
  record: MaintenanceRecordDto | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone?: (record: MaintenanceRecordDto) => void;
}) {
  const canFinance = useCan(Permission.FINANCE_VIEW);
  const complete = useCompleteMaintenance();
  const moto = useMotorcycle(open && record ? record.motorcycle.id : undefined);
  const workshops = useWorkshopSuggestions(open);
  const listId = useId();
  const today = todayYmd();
  const [completedAt, setCompletedAt] = useState(today);
  const [km, setKm] = useState<number | null>(null);
  const [cost, setCost] = useState('');
  const [workshop, setWorkshop] = useState('');
  const [parts, setParts] = useState('');
  const [notes, setNotes] = useState('');
  const [next, setNext] = useState<'' | 'AVAILABLE' | 'RENTED'>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !record) return;
    setCompletedAt(today);
    setKm(record.km);
    setCost(record.cost ?? '');
    setWorkshop(record.workshop ?? '');
    setParts(record.parts ?? '');
    setNotes(record.notes ?? '');
    setNext('');
    setError(null);
  }, [open, record, today]);

  const m = moto.data;
  useEffect(() => {
    if (!m || !open) return;
    setKm((k) => k ?? m.currentKm);
    setNext(m.currentRental ? 'RENTED' : 'AVAILABLE');
  }, [m, open]);

  if (!record) return null;
  const inMaintenance = m?.status === 'MAINTENANCE';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!record) return;
    if (!completedAt) return setError('Informe a data do serviço.');
    if (completedAt > today) return setError('A data não pode ser no futuro.');
    if (km === null) return setError('Informe a quilometragem da moto no serviço.');
    const n = (s: string) => (s.trim() ? s.trim() : null);
    const body: CompleteMaintenanceRequest = {
      completedAt,
      km,
      workshop: n(workshop),
      parts: n(parts),
      notes: n(notes),
      nextMotorcycleStatus: inMaintenance && next ? next : null,
    };
    if (canFinance) body.cost = cost || null;
    try {
      const done = await complete.mutateAsync({ id: record.id, ...body });
      toast.success('Manutenção concluída', {
        description: 'O próximo intervalo já foi recalculado.',
      });
      onDone?.(done);
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-xl">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <DialogHeader>
          <DialogTitle>Concluir manutenção</DialogTitle>
          <DialogDescription>
            <span className="inline-flex flex-wrap items-center gap-2">
              <Plate plate={record.motorcycle.plate} /> {record.types.map((t) => t.name).join(', ')}
            </span>
          </DialogDescription>
        </DialogHeader>
        <FormGrid cols={2}>
          <Field label="Data do serviço" required>
            {(id) => (
              <Input
                id={id}
                type="date"
                value={completedAt}
                max={today}
                onChange={(e) => setCompletedAt(e.target.value)}
              />
            )}
          </Field>
          <Field
            label="Quilometragem"
            required
            hint={m ? `Atual da moto: ${formatKm(m.currentKm)}.` : undefined}
          >
            {(id) => <NumberInput id={id} value={km} onValue={setKm} suffix="km" />}
          </Field>
          <Field label="Oficina">
            {(id) => (
              <>
                <Input
                  id={id}
                  value={workshop}
                  onChange={(e) => setWorkshop(e.target.value)}
                  list={`${listId}-w`}
                  maxLength={120}
                  autoComplete="off"
                />
                <datalist id={`${listId}-w`}>
                  {workshops.slice(0, 30).map((w) => (
                    <option key={w} value={w} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          {canFinance && (
            <Field label="Valor" hint="Peças + mão de obra.">
              {(id) => <MoneyInput id={id} value={cost} onValue={setCost} placeholder="0,00" />}
            </Field>
          )}
        </FormGrid>
        <Field label="Peças trocadas">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={parts}
              onChange={(e) => setParts(e.target.value)}
              maxLength={2000}
            />
          )}
        </Field>
        <Field label="Observações">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
            />
          )}
        </Field>
        {inMaintenance && (
          <Field
            label="Depois do serviço, a moto fica"
            hint="Se houver outra manutenção aberta, ela continua em manutenção."
          >
            {(id) => (
              <SelectMenu
                id={id}
                value={next}
                onChange={(x) => setNext(x as typeof next)}
                options={[
                  { value: 'AVAILABLE', label: 'Disponível para alugar' },
                  ...(m?.currentRental
                    ? [
                        {
                          value: 'RENTED',
                          label: `Volta para ${m.currentRental.customerName.split(' ')[0]} (alugada)`,
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </Field>
        )}
        <p className="flex items-start gap-2 rounded-lg bg-success/10 p-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <span>
            Os planos destes serviços recomeçam a contar a partir desta data e deste km. Fotos e
            notas podem ser anexadas na manutenção.
          </span>
        </p>
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button type="submit" disabled={complete.isPending}>
            {complete.isPending && <Loader2 className="animate-spin" />}
            Concluir
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
