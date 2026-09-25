'use client';

import type { MaintenanceTypeDto, UpsertMaintenanceTypeRequest } from '@locamania/shared';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/kit';
import { NumberInput } from '@/components/ui/masked-input';
import { Switch } from '@/components/ui/switch';
import { errorMessage } from '@/lib/api/client';

/** Criar/editar tipo de manutenção: nome + intervalo padrão em km e/ou dias. */
export function MaintenanceTypeDialog({
  open,
  type,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  /** Ausente = novo tipo. */
  type: MaintenanceTypeDto | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: UpsertMaintenanceTypeRequest) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [km, setKm] = useState<number | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(type?.name ?? '');
    setKm(type?.defaultIntervalKm ?? null);
    setDays(type?.defaultIntervalDays ?? null);
    setActive(type?.active ?? true);
    setError(null);
  }, [open, type]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Informe o nome.');
    if (km === 0 || days === 0) return setError('O intervalo precisa ser maior que zero (ou deixe em branco).');
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), defaultIntervalKm: km, defaultIntervalDays: days, active });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={submit} noValidate>
        <DialogHeader>
          <DialogTitle>{type ? 'Editar tipo de manutenção' : 'Novo tipo de manutenção'}</DialogTitle>
          <DialogDescription>Preencha km, tempo ou os dois — vale o que vencer primeiro.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Nome" required>
            {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ex.: Troca de óleo" autoCapitalize="sentences" />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="A cada (km)" hint="Ex.: 3.000">
              {(id) => <NumberInput id={id} value={km} onValue={setKm} suffix="km" placeholder="—" />}
            </Field>
            <Field label="A cada (dias)" hint="Ex.: 120 = 4 meses">
              {(id) => <NumberInput id={id} value={days} onValue={setDays} suffix="dias" thousands={false} placeholder="—" className="pr-12" />}
            </Field>
          </div>
          {km === null && days === null && (
            <p className="rounded-lg bg-warning/12 p-3 text-sm">Sem intervalo, o sistema não avisa sozinho — o tipo serve só para registrar serviços avulsos.</p>
          )}
          {type && (
            <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border px-3">
              <label htmlFor="mt-active" className="text-sm">
                <span className="font-medium">Ativo</span>
                <span className="block text-xs text-muted-foreground">Desativado, some das opções de novas manutenções.</span>
              </label>
              <Switch id="mt-active" checked={active} onCheckedChange={setActive} />
            </div>
          )}
          <FormError message={error} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {type ? 'Salvar' : 'Cadastrar tipo'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
