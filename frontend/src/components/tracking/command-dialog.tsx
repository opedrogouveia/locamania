'use client';

import {
  TRACKER_COMMAND_STATUS_LABELS,
  normalizePlate,
  type TrackerCommandType,
  type TrackerStatusDto,
} from '@locamania/shared';
import { FlaskConical, Loader2, Lock, LockOpen, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

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
import { Field } from '@/components/ui/kit';
import { MaskedInput } from '@/components/ui/masked-input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useStaff } from '@/lib/auth/use-auth';
import { useTrackerCommand } from '@/lib/queries';
import { formatPlate } from '@/lib/utils';
import { BLOCK_REASONS, UNBLOCK_REASONS } from './tracking-meta';

/**
 * Bloqueio seguro (§32) em duas etapas: 1) motivo; 2) conferir a moto
 * digitando a placa. Fica registrado quem fez, quando e por quê. Nunca
 * desliga moto em movimento — o equipamento só corta a partida com ela parada.
 */
export function TrackerCommandDialog({
  tracker,
  type,
  open,
  onOpenChange,
}: {
  tracker: Pick<TrackerStatusDto, 'motorcycle' | 'position' | 'sandbox'>;
  type: TrackerCommandType;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const staff = useStaff();
  const command = useTrackerCommand(tracker.motorcycle.id);
  const [step, setStep] = useState<1 | 2>(1);
  const [reason, setReason] = useState('');
  const [plate, setPlate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const block = type === 'BLOCK';
  const moving = (tracker.position?.speedKmh ?? 0) > 3;
  const plateOk = normalizePlate(plate) === tracker.motorcycle.plate;

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setReason('');
    setPlate('');
    setError(null);
  }, [open, type]);

  function next(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (reason.trim().length < 5) return setError('Descreva o motivo (pelo menos 5 letras).');
    setStep(2);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!plateOk) return setError('A placa digitada não confere com a desta moto.');
    try {
      const result = await command.mutateAsync({
        type,
        reason: reason.trim(),
        confirmPlate: plate,
      });
      const fn = result.status === 'FAILED' ? toast.error : toast.success;
      fn(
        `${block ? 'Bloqueio' : 'Desbloqueio'}: ${TRACKER_COMMAND_STATUS_LABELS[result.status].toLowerCase()}`,
        {
          description: result.providerResponse ?? formatPlate(tracker.motorcycle.plate),
          duration: 8000,
        },
      );
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const quick = block ? BLOCK_REASONS : UNBLOCK_REASONS;
  const Icon = block ? Lock : LockOpen;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={step === 1 ? next : send} className="space-y-4" noValidate>
        <DialogHeader>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Etapa {step} de 2
          </p>
          <DialogTitle>{block ? 'Bloquear a moto' : 'Desbloquear a moto'}</DialogTitle>
          <DialogDescription>
            <span className="inline-flex flex-wrap items-center gap-2">
              <Plate plate={tracker.motorcycle.plate} /> {tracker.motorcycle.label}
            </span>
          </DialogDescription>
        </DialogHeader>

        {tracker.sandbox && (
          <p className="flex items-start gap-2 rounded-lg bg-info/10 p-3 text-sm">
            <FlaskConical className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
            <span>
              Ambiente de teste: o comando é só registrado, nenhuma moto é bloqueada de verdade.
            </span>
          </p>
        )}

        {step === 1 ? (
          <>
            {block ? (
              <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-sm">
                <p className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                  <span>
                    O bloqueio impede a moto de dar partida.{' '}
                    <strong className="font-semibold">
                      Por segurança, o equipamento só corta com a moto parada
                    </strong>{' '}
                    — o sistema nunca desliga uma moto em movimento.
                  </span>
                </p>
                {moving && (
                  <p className="pl-6 font-medium text-destructive">
                    Última posição: em movimento ({tracker.position!.speedKmh} km/h). O bloqueio
                    fica aguardando a moto parar.
                  </p>
                )}
              </div>
            ) : (
              <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
                O desbloqueio libera a partida da moto.
              </p>
            )}
            <Field
              label="Motivo"
              required
              hint="Fica no histórico da moto, com seu nome, data e hora."
            >
              {(id) => (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {quick.map((r) => (
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
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={500}
                    placeholder="Explique o que aconteceu"
                  />
                </div>
              )}
            </Field>
          </>
        ) : (
          <>
            <dl className="space-y-2 rounded-lg border border-border p-3 text-sm">
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-muted-foreground">Comando</dt>
                <dd className="font-medium">{block ? 'Bloqueio' : 'Desbloqueio'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-muted-foreground">Motivo</dt>
                <dd className="min-w-0 break-words">{reason.trim()}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-muted-foreground">Por</dt>
                <dd>{staff?.name ?? 'Você'} · agora</dd>
              </div>
            </dl>
            <Field
              label={`Para confirmar, digite a placa ${formatPlate(tracker.motorcycle.plate)}`}
              required
            >
              {(id) => (
                <MaskedInput
                  id={id}
                  mask="plate"
                  value={plate}
                  onValue={setPlate}
                  autoFocus
                  autoCapitalize="characters"
                  placeholder="Placa"
                  className="text-base"
                />
              )}
            </Field>
          </>
        )}

        <FormError message={error} />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => (step === 2 ? setStep(1) : onOpenChange(false))}
          >
            {step === 2 ? 'Voltar' : 'Cancelar'}
          </Button>
          {step === 1 ? (
            <Button type="submit">Continuar</Button>
          ) : (
            <Button
              type="submit"
              variant={block ? 'destructive' : 'default'}
              disabled={!plateOk || command.isPending}
            >
              {command.isPending ? <Loader2 className="animate-spin" /> : <Icon />}
              {block ? 'Bloquear agora' : 'Desbloquear agora'}
            </Button>
          )}
        </DialogFooter>
      </form>
    </Dialog>
  );
}
