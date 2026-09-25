'use client';

import {
  MOTORCYCLE_STATUS_LABELS,
  type MotorcycleDto,
  type SetMotorcycleStatusRequest,
} from '@locamania/shared';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form-error';
import { Field } from '@/components/ui/kit';
import { NumberInput } from '@/components/ui/masked-input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useAddOdometer, useMotorcycleStatus } from '@/lib/queries';
import { cn, formatDateTime, formatKm, formatPlate } from '@/lib/utils';

type Target = SetMotorcycleStatusRequest['status'];

const TARGETS: { value: Target; hint: string }[] = [
  { value: 'AVAILABLE', hint: 'Pronta para um novo aluguel.' },
  { value: 'MAINTENANCE', hint: 'Na oficina ou esperando peça. Sai das motos disponíveis.' },
  { value: 'BLOCKED', hint: 'Roubo, apreensão, problema grave. Não pode ser alugada.' },
  { value: 'INACTIVE', hint: 'Vendida ou fora da frota de vez.' },
];

/** Motivos mais comuns — um toque preenche (continua editável). */
const QUICK_REASONS: Record<Target, string[]> = {
  AVAILABLE: ['Liberada após revisão', 'Voltou da oficina'],
  MAINTENANCE: ['Revisão preventiva', 'Aguardando peça', 'Reparo após devolução'],
  BLOCKED: ['Roubada/furtada — boletim registrado', 'Apreendida', 'Aguardando documentação'],
  INACTIVE: ['Vendida', 'Perda total'],
};

/** Mudar a situação à mão, com motivo (§5). "Alugada" e "Reservada" só pelo contrato. */
export function MotorcycleStatusDialog({
  motorcycle,
  open,
  onOpenChange,
}: {
  motorcycle: MotorcycleDto;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const setStatus = useMotorcycleStatus(motorcycle.id);
  const [target, setTarget] = useState<Target | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTarget(null);
    setReason('');
    setError(null);
  }, [open]);

  const needsReason = target === 'BLOCKED' || target === 'INACTIVE';
  const withRental = !!motorcycle.currentRental || motorcycle.status === 'RESERVED';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!target) return setError('Escolha a nova situação.');
    if (needsReason && reason.trim().length < 3) return setError('Escreva o motivo.');
    try {
      await setStatus.mutateAsync({ status: target, reason: reason.trim() || null });
      toast.success(`Moto ${MOTORCYCLE_STATUS_LABELS[target].toLowerCase()}`, {
        description: formatPlate(motorcycle.plate),
      });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={submit} className="space-y-4">
        <DialogHeader>
          <DialogTitle>Mudar situação</DialogTitle>
          <DialogDescription>
            {formatPlate(motorcycle.plate)} está{' '}
            <strong className="font-medium text-foreground">
              {MOTORCYCLE_STATUS_LABELS[motorcycle.status].toLowerCase()}
            </strong>
            . &ldquo;Alugada&rdquo; e &ldquo;Reservada&rdquo; mudam sozinhas pelo contrato.
          </DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Nova situação" className="grid gap-2">
          {TARGETS.filter((t) => t.value !== motorcycle.status).map((t) => {
            const blocked = withRental && (t.value === 'AVAILABLE' || t.value === 'INACTIVE');
            const active = target === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={blocked}
                onClick={() => {
                  setTarget(t.value);
                  setError(null);
                }}
                className={cn(
                  'flex min-h-12 flex-col items-start rounded-lg border px-3.5 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  active
                    ? 'border-primary bg-primary/8 ring-1 ring-primary'
                    : 'border-border hover:bg-accent',
                )}
              >
                <span className="text-sm font-medium">{MOTORCYCLE_STATUS_LABELS[t.value]}</span>
                <span className="text-xs text-muted-foreground">
                  {blocked
                    ? 'Tem contrato aberto: faça a devolução ou cancele o contrato antes.'
                    : t.hint}
                </span>
              </button>
            );
          })}
        </div>
        {target && (
          <Field label={needsReason ? 'Motivo' : 'Motivo (opcional)'} required={needsReason}>
            {(id) => (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REASONS[target].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className="min-h-9 rounded-full border border-border bg-card px-3 text-xs font-medium hover:bg-accent"
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <Textarea
                  id={id}
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  placeholder="Fica na ficha e no histórico."
                />
              </div>
            )}
          </Field>
        )}
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button
            type="submit"
            variant={target === 'BLOCKED' || target === 'INACTIVE' ? 'destructive' : 'default'}
            disabled={setStatus.isPending || !target}
          >
            {setStatus.isPending && <Loader2 className="animate-spin" />}
            {target ? `Deixar ${MOTORCYCLE_STATUS_LABELS[target].toLowerCase()}` : 'Mudar situação'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/** Registrar km (nunca menor que a atual — o backend também confere). */
export function OdometerDialog({
  motorcycle,
  open,
  onOpenChange,
}: {
  motorcycle: MotorcycleDto;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const add = useAddOdometer(motorcycle.id);
  const [km, setKm] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setKm(null);
    setNotes('');
    setError(null);
  }, [open]);

  const diff = km !== null ? km - motorcycle.currentKm : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (km === null) return setError('Informe a quilometragem do painel.');
    if (km < motorcycle.currentKm)
      return setError(`Não pode ser menor que a atual (${formatKm(motorcycle.currentKm)}).`);
    try {
      await add.mutateAsync({ km, notes: notes.trim() || null });
      toast.success('Quilometragem registrada', {
        description: `${formatPlate(motorcycle.plate)} · ${formatKm(km)}`,
      });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <DialogHeader>
          <DialogTitle>Registrar quilometragem</DialogTitle>
          <DialogDescription>
            Atual: {formatKm(motorcycle.currentKm)}
            {motorcycle.lastOdometerAt ? ` (em ${formatDateTime(motorcycle.lastOdometerAt)})` : ''}.
            A manutenção por km é recalculada na hora.
          </DialogDescription>
        </DialogHeader>
        <Field
          label="Quilometragem do painel"
          required
          hint={
            diff !== null && diff >= 0
              ? `+${diff.toLocaleString('pt-BR')} km desde a última leitura.`
              : undefined
          }
        >
          {(id) => (
            <NumberInput
              id={id}
              value={km}
              onValue={setKm}
              suffix="km"
              autoFocus
              placeholder={motorcycle.currentKm.toLocaleString('pt-BR')}
              className="text-base"
            />
          )}
        </Field>
        <Field label="Observação">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Opcional"
            />
          )}
        </Field>
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={add.isPending}>
            {add.isPending && <Loader2 className="animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
