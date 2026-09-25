'use client';

import { Gauge, WifiOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form-error';
import { NumberInput } from '@/components/ui/masked-input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useReportOdometer } from '@/lib/queries/portal';
import { useOnline } from '@/lib/use-online';
import { formatKm } from '@/lib/utils';

/** Acima disso desde a última leitura, pedimos para conferir (erro de digitação comum: um zero a mais). */
const BIG_JUMP_KM = 3000;

/**
 * "Informar quilometragem": o cliente digita o número do painel. A API confere
 * (não pode voltar) e avisa a equipe; aqui só ajudamos a não errar.
 */
export function OdometerDialog({ open, onOpenChange, lastKm }: { open: boolean; onOpenChange: (open: boolean) => void; lastKm: number }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* O formulário só existe com o diálogo aberto: abrir de novo começa limpo. */}
      <OdometerForm lastKm={lastKm} onDone={() => onOpenChange(false)} />
    </Dialog>
  );
}

function OdometerForm({ lastKm, onDone }: { lastKm: number; onDone: () => void }) {
  const [km, setKm] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const report = useReportOdometer();
  const confirm = useConfirm();
  const online = useOnline();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (km === null) return setError('Digite a quilometragem que aparece no painel da moto.');
    if (km < lastKm) return setError(`O número não pode ser menor que o último informado (${formatKm(lastKm)}).`);
    if (km - lastKm > BIG_JUMP_KM) {
      const ok = await confirm({
        title: `Confirma ${formatKm(km)}?`,
        description: `São ${formatKm(km - lastKm)} a mais que a última leitura (${formatKm(lastKm)}). Confira se não sobrou nenhum número.`,
        confirmText: 'Está certo',
        cancelText: 'Corrigir',
      });
      if (!ok) return;
    }
    try {
      await report.mutateAsync(km);
      toast.success('Quilometragem enviada. Obrigado!');
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Informar quilometragem</DialogTitle>
        <DialogDescription>Olhe o painel da moto e digite o número que aparece no hodômetro.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <label htmlFor="odometer-km" className="sr-only">
          Quilometragem atual
        </label>
        <NumberInput
          id="odometer-km"
          autoFocus
          enterKeyHint="send"
          placeholder={lastKm.toLocaleString('pt-BR')}
          value={km}
          onValue={(v) => {
            setKm(v);
            setError(null);
          }}
          suffix="km"
          className="h-16 rounded-xl text-center text-3xl! font-bold tracking-tight"
          aria-describedby="odometer-hint"
        />
        <p id="odometer-hint" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <Gauge className="size-4" aria-hidden /> Última leitura: <span className="font-medium text-foreground tabular">{formatKm(lastKm)}</span>
        </p>
        {!online && (
          <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-destructive">
            <WifiOff className="size-4" aria-hidden /> Sem conexão com a internet.
          </p>
        )}
        <FormError message={error} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={report.isPending || !online}>
          {report.isPending && <Spinner />}
          Enviar
        </Button>
      </DialogFooter>
    </form>
  );
}
