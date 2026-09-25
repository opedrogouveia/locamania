'use client';

import {
  PERIODICITY_UNIT,
  Permission,
  addDays,
  buildRentSchedule,
  fromCents,
  toCents,
  todayYmd,
  type ContractDto,
  type PortalInviteResponse,
  type SendContractResponse,
} from '@locamania/shared';
import {
  CheckCircle2,
  ExternalLink,
  FileSignature,
  Info,
  Loader2,
  Mail,
  MailX,
  Smartphone,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { InviteDialog } from '@/components/customers/customer-dialogs';
import { WhatsAppIcon } from '@/components/shared/whatsapp-icon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/kit';
import { MoneyInput, NumberInput } from '@/components/ui/masked-input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { useUploadMany } from '@/lib/contracts/queries';
import { endDateForMonths } from '@/lib/contracts/rules';
import type { PreparedFile } from '@/lib/files';
import {
  useAdjustContract,
  useCancelContract,
  useDeliverContract,
  useExtendContract,
  useInviteCustomer,
  useMotorcycle,
  useSendContract,
  useSignContract,
} from '@/lib/queries';
import { cn, formatBRL, formatDateTime, formatKm, formatPlate, formatYmd } from '@/lib/utils';
import { PhotoPicker } from './photo-picker';

type DialogProps = { contract: ContractDto; open: boolean; onOpenChange: (v: boolean) => void };

function Note({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warning' | 'success';
  children: ReactNode;
}) {
  const Icon = tone === 'warning' ? TriangleAlert : tone === 'success' ? CheckCircle2 : Info;
  return (
    <div
      className={cn(
        'flex gap-2 rounded-lg p-3 text-sm',
        tone === 'warning' && 'bg-warning/10',
        tone === 'info' && 'bg-muted/70',
        tone === 'success' && 'bg-success/10',
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 size-4 shrink-0',
          tone === 'warning'
            ? 'text-warning'
            : tone === 'success'
              ? 'text-success'
              : 'text-muted-foreground',
        )}
      />
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  );
}

// ───────────────────────────── Enviar ao cliente ─────────────────────────────

/** E-mail com o PDF + aviso no app + mensagem pronta no WhatsApp (§10, §19). */
export function SendContractDialog({ contract: c, open, onOpenChange }: DialogProps) {
  const send = useSendContract(c.id);
  const invite = useInviteCustomer(c.customer.id);
  const [result, setResult] = useState<SendContractResponse | null>(null);
  const [inviteResult, setInviteResult] = useState<PortalInviteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canInvite = useCan(Permission.CUSTOMERS_MANAGE);

  useEffect(() => {
    if (open) {
      setResult(null);
      setError(null);
    }
  }, [open]);

  async function submit() {
    setError(null);
    try {
      setResult(await send.mutateAsync());
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogHeader>
          <DialogTitle>{result ? 'Contrato enviado' : 'Enviar contrato ao cliente'}</DialogTitle>
          <DialogDescription>
            {c.number} · {c.customer.label}
          </DialogDescription>
        </DialogHeader>
        {!result ? (
          <div className="space-y-3">
            <ul className="space-y-2.5 text-sm">
              <li className="flex gap-2.5">
                {c.customerEmail ? (
                  <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <MailX className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <span>
                  {c.customerEmail ? (
                    <>
                      E-mail com o PDF para{' '}
                      <strong className="font-medium">{c.customerEmail}</strong>
                    </>
                  ) : (
                    'Sem e-mail cadastrado — o PDF não vai por e-mail.'
                  )}
                </span>
              </li>
              <li className="flex gap-2.5">
                <Smartphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  {c.customerPortalEnabled
                    ? c.signatureStatus === 'PENDING'
                      ? 'Aviso no aplicativo: o cliente lê e aceita em "Meu contrato".'
                      : 'Aviso no aplicativo, em "Meu contrato".'
                    : 'O cliente ainda não usa o aplicativo (dá para liberar o acesso depois).'}
                </span>
              </li>
              <li className="flex gap-2.5">
                <WhatsAppIcon className="mt-0.5 size-4 shrink-0 text-success" />
                <span>
                  {c.customerWhatsapp || c.customerPhone
                    ? 'Mensagem pronta para mandar pelo WhatsApp.'
                    : 'Sem celular cadastrado para o WhatsApp.'}
                </span>
              </li>
            </ul>
            {c.sentAt && (
              <p className="text-xs text-muted-foreground">
                Último envio: {formatDateTime(c.sentAt)}
              </p>
            )}
            <FormError message={error} />
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={submit} disabled={send.isPending}>
                {send.isPending && <Loader2 className="animate-spin" />} Enviar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <Note tone={result.emailSent ? 'success' : 'info'}>
              <p>
                {result.emailSent
                  ? `E-mail enviado para ${c.customerEmail}.`
                  : c.customerEmail
                    ? 'Não foi possível enviar o e-mail agora.'
                    : 'Sem e-mail cadastrado.'}
              </p>
              {c.customerPortalEnabled && <p>O aviso já aparece no aplicativo do cliente.</p>}
            </Note>
            {!c.customerPortalEnabled && canInvite && (
              <Note>
                <p>
                  Com o aplicativo, o cliente aceita o contrato sozinho e acompanha os pagamentos.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1"
                  disabled={invite.isPending}
                  onClick={async () => {
                    try {
                      setInviteResult(await invite.mutateAsync());
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                >
                  <Smartphone /> Liberar acesso ao app
                </Button>
              </Note>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              {result.whatsappLink && (
                <Button asChild>
                  <a href={result.whatsappLink} target="_blank" rel="noreferrer">
                    <WhatsAppIcon className="size-4" /> Mandar no WhatsApp{' '}
                    <ExternalLink className="opacity-60" />
                  </a>
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </Dialog>
      <InviteDialog invite={inviteResult} onOpenChange={(v) => !v && setInviteResult(null)} />
    </>
  );
}

// ───────────────────────────── Assinatura presencial ─────────────────────────────

/** Contrato impresso assinado no balcão, com o escaneado opcional (§10). */
export function SignContractDialog({ contract: c, open, onOpenChange }: DialogProps) {
  const sign = useSignContract(c.id);
  const upload = useUploadMany();
  const canDocs = useCan(Permission.DOCUMENTS_MANAGE);
  const [files, setFiles] = useState<PreparedFile[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFiles([]);
      setConfirmed(false);
      setError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!confirmed) return setError('Confirme que o cliente assinou.');
    try {
      let documentId: string | null = null;
      if (files.length) {
        [documentId = null] = await upload.mutateAsync({
          files,
          ownerType: 'CONTRACT',
          ownerId: c.id,
          typeCode: 'CONTRACT_SIGNED',
          title: `Contrato assinado — ${c.number}`,
          visibleToCustomer: true,
        });
      }
      await sign.mutateAsync(documentId);
      toast.success('Assinatura registrada', { description: 'Próximo passo: entregar a moto.' });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const busy = sign.isPending || upload.isPending;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={submit} className="space-y-4">
        <DialogHeader>
          <DialogTitle>Registrar assinatura presencial</DialogTitle>
          <DialogDescription>
            Para quando o cliente assinou o contrato impresso, na loja.
          </DialogDescription>
        </DialogHeader>
        {canDocs && (
          <Field
            label="Contrato assinado (foto ou PDF)"
            hint="Opcional, mas recomendado: fica guardado nos documentos do contrato e visível para o cliente no app."
          >
            {() => (
              <PhotoPicker
                single
                files={files}
                onChange={setFiles}
                label="Fotografar ou escolher arquivo"
                hint=""
                disabled={busy}
              />
            )}
          </Field>
        )}
        <Note>
          <p>
            Depois de assinado, o texto do contrato fica congelado (com código de verificação) e as
            condições não mudam mais — só por reajuste ou prorrogação.
          </p>
        </Note>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <Checkbox
            checked={confirmed}
            onCheckedChange={setConfirmed}
            className="mt-0.5"
            aria-label="Confirmo a assinatura"
          />
          <span>
            Confirmo que <strong className="font-medium">{c.customer.label}</strong> assinou o
            contrato {c.number}.
          </span>
        </label>
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <FileSignature />} Registrar assinatura
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ───────────────────────────── Entrega da moto ─────────────────────────────

/**
 * Entrega (§39 etapas 9–13): km de saída, fotos e observações. Ativa o
 * contrato, a moto vira Alugada e as cobranças são geradas. Sem assinatura a
 * API recusa — a tela avisa antes.
 */
export function DeliverContractDialog({
  contract: c,
  open,
  onOpenChange,
  onNeedSignature,
  onDelivered,
}: DialogProps & { onNeedSignature: () => void; onDelivered?: () => void }) {
  const deliver = useDeliverContract(c.id);
  const upload = useUploadMany();
  const canDocs = useCan(Permission.DOCUMENTS_MANAGE);
  const moto = useMotorcycle(open ? c.motorcycle.id : undefined);
  const [km, setKm] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<PreparedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const currentKm = moto.data?.currentKm ?? null;

  useEffect(() => {
    if (open) {
      setNotes('');
      setFiles([]);
      setError(null);
    }
  }, [open]);
  useEffect(() => {
    if (open && currentKm !== null) setKm(currentKm);
  }, [open, currentKm]);

  const schedule = useMemo(
    () =>
      c.rentAmount
        ? buildRentSchedule({
            startDate: c.startDate,
            endDate: c.endDate,
            firstDueDate: c.firstDueDate,
            periodicity: c.periodicity,
            amount: c.rentAmount,
          })
        : null,
    [c],
  );
  const signed = c.signatureStatus === 'SIGNED';
  const today = todayYmd();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (km === null) return setError('Informe a quilometragem de saída.');
    if (currentKm !== null && km < currentKm)
      return setError(
        `A quilometragem não pode ser menor que a atual da moto (${formatKm(currentKm)}).`,
      );
    try {
      await deliver.mutateAsync({ initialKm: km, notes: notes.trim() || null });
      if (files.length) {
        try {
          await upload.mutateAsync({
            files,
            ownerType: 'CONTRACT',
            ownerId: c.id,
            typeCode: 'PHOTO_DELIVERY',
            title: `Fotos da entrega — ${c.number}`,
          });
        } catch (err) {
          toast.warning('Moto entregue, mas as fotos não subiram', {
            description: `${errorMessage(err)} Anexe de novo em Documentos.`,
          });
        }
      }
      toast.success('Moto entregue — aluguel ativo', {
        description: 'As cobranças foram geradas e o cliente foi avisado.',
      });
      onOpenChange(false);
      onDelivered?.();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const busy = deliver.isPending || upload.isPending;

  if (!signed) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogHeader>
          <DialogTitle>Falta a assinatura</DialogTitle>
          <DialogDescription>A moto só é entregue com o contrato assinado.</DialogDescription>
        </DialogHeader>
        <Note tone="warning">
          <p>
            Registre a assinatura presencial
            {c.customerPortalEnabled ? ' ou aguarde o cliente aceitar pelo aplicativo' : ''}. Depois
            volte aqui para entregar.
          </p>
        </Note>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onNeedSignature();
            }}
          >
            <FileSignature /> Registrar assinatura
          </Button>
        </DialogFooter>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={submit} className="space-y-4">
        <DialogHeader>
          <DialogTitle>Entregar a moto</DialogTitle>
          <DialogDescription>
            {formatPlate(c.motorcycle.plate)} · {c.motorcycle.label} para {c.customer.label}
          </DialogDescription>
        </DialogHeader>
        <Field
          label="Km de saída"
          required
          hint={
            currentKm !== null
              ? `Km atual da moto: ${formatKm(currentKm)}.`
              : 'Confira no painel da moto.'
          }
        >
          {(id) => <NumberInput id={id} value={km} onValue={setKm} suffix="km" />}
        </Field>
        <div className="rounded-lg border border-border px-3 py-2.5 text-sm">
          <span className="text-muted-foreground">Data da entrega: </span>
          agora ({formatDateTime(new Date())})
        </div>
        {canDocs && (
          <Field
            label="Fotos da moto na entrega"
            hint="Opcional: registram o estado da moto (lataria, painel, pneus)."
          >
            {() => <PhotoPicker files={files} onChange={setFiles} hint="" disabled={busy} />}
          </Field>
        )}
        <Field label="Observações" hint="Ex.: saiu com capacete, baú e carregador.">
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
        <Note>
          <p className="font-medium">Ao confirmar:</p>
          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
            <li>a moto passa para Alugada e o contrato fica ativo;</li>
            <li>
              {schedule
                ? `${schedule.length} parcelas de aluguel são geradas — a 1ª de ${formatBRL(schedule[0]?.amount)} vence em ${formatYmd(schedule[0]?.dueDate)}`
                : 'as parcelas do aluguel são geradas'}
              {c.depositAmount &&
                toCents(c.depositAmount) > 0 &&
                `, mais a caução de ${formatBRL(c.depositAmount)}`}
              ;
            </li>
            <li>o cliente é avisado e os lembretes de pagamento começam.</li>
          </ul>
          {c.startDate > today && (
            <p className="pt-1 text-warning">O aluguel começa em {formatYmd(c.startDate)}.</p>
          )}
        </Note>
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy || moto.isLoading}>
            {busy && <Loader2 className="animate-spin" />} Confirmar entrega
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ───────────────────────────── Reajuste ─────────────────────────────

export function AdjustRentDialog({ contract: c, open, onOpenChange }: DialogProps) {
  const adjust = useAdjustContract(c.id);
  const today = todayYmd();
  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState(today);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount('');
      setFrom(c.nextDueDate && c.nextDueDate > today ? c.nextDueDate : today);
      setReason('');
      setError(null);
    }
  }, [open, c.nextDueDate, today]);

  const diff = amount && c.rentAmount ? toCents(amount) - toCents(c.rentAmount) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (toCents(amount) <= 0) return setError('Informe o novo valor.');
    if (from < today) return setError('O reajuste vale a partir de hoje ou de uma data futura.');
    try {
      await adjust.mutateAsync({
        rentAmount: amount,
        effectiveFrom: from,
        reason: reason.trim() || null,
      });
      toast.success('Valor reajustado', {
        description: `${formatBRL(amount)} por ${PERIODICITY_UNIT[c.periodicity]} a partir de ${formatYmd(from)}. O cliente foi avisado.`,
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
          <DialogTitle>Reajustar valor</DialogTitle>
          <DialogDescription>
            Hoje: {formatBRL(c.rentAmount)} por {PERIODICITY_UNIT[c.periodicity]}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={`Novo valor por ${PERIODICITY_UNIT[c.periodicity]}`}
            required
            hint={
              diff
                ? `${diff > 0 ? '+' : '−'}${formatBRL(fromCents(Math.abs(diff)))} por parcela`
                : undefined
            }
          >
            {(id) => <MoneyInput id={id} value={amount} onValue={setAmount} autoFocus />}
          </Field>
          <Field label="A partir de" required>
            {(id) => (
              <Input
                id={id}
                type="date"
                value={from}
                min={today}
                onChange={(e) => setFrom(e.target.value)}
              />
            )}
          </Field>
        </div>
        <Field label="Motivo" hint="Vai no aviso para o cliente.">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="Ex.: reajuste anual"
            />
          )}
        </Field>
        <Note>
          <p>
            Muda só as parcelas em aberto que vencem a partir dessa data. As já pagas continuam como
            estão.
          </p>
        </Note>
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={adjust.isPending}>
            {adjust.isPending && <Loader2 className="animate-spin" />} Reajustar
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ───────────────────────────── Prorrogação ─────────────────────────────

export function ExtendContractDialog({ contract: c, open, onOpenChange }: DialogProps) {
  const extend = useExtendContract(c.id);
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const nextDay = addDays(c.endDate, 1);

  useEffect(() => {
    if (open) {
      setEndDate(endDateForMonths(nextDay, 3));
      setError(null);
    }
  }, [open, nextDay]);

  const extra = useMemo(() => {
    if (!c.rentAmount || !endDate || endDate <= c.endDate) return null;
    const base = {
      startDate: c.startDate,
      firstDueDate: c.firstDueDate,
      periodicity: c.periodicity,
      amount: c.rentAmount,
    };
    const before = buildRentSchedule({ ...base, endDate: c.endDate });
    const after = buildRentSchedule({ ...base, endDate });
    return {
      count: after.length - before.length,
      amount: fromCents(
        after.reduce((a, i) => a + toCents(i.amount), 0) -
          before.reduce((a, i) => a + toCents(i.amount), 0),
      ),
    };
  }, [c, endDate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!endDate || endDate <= c.endDate)
      return setError('A nova data de término precisa ser depois da atual.');
    try {
      await extend.mutateAsync(endDate);
      toast.success('Contrato prorrogado', {
        description: `Agora vai até ${formatYmd(endDate)}. O cliente foi avisado.`,
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
          <DialogTitle>Prorrogar contrato</DialogTitle>
          <DialogDescription>Término atual: {formatYmd(c.endDate)}.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {[1, 3, 6].map((m) => {
            const d = endDateForMonths(nextDay, m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => setEndDate(d)}
                aria-pressed={endDate === d}
                className={cn(
                  'h-11 rounded-lg border text-sm font-medium transition-colors',
                  endDate === d
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card hover:bg-accent',
                )}
              >
                + {m} {m === 1 ? 'mês' : 'meses'}
              </button>
            );
          })}
        </div>
        <Field label="Novo término" required>
          {(id) => (
            <Input
              id={id}
              type="date"
              value={endDate}
              min={nextDay}
              onChange={(e) => setEndDate(e.target.value)}
            />
          )}
        </Field>
        <Note>
          <p>
            {extra && extra.count > 0
              ? `Gera ${extra.count} ${extra.count === 1 ? 'nova parcela' : 'novas parcelas'} (${formatBRL(extra.amount)} no total), com o mesmo valor e vencimento.`
              : 'As novas parcelas seguem o mesmo valor e dia de vencimento.'}{' '}
            O cliente é avisado.
          </p>
        </Note>
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={extend.isPending}>
            {extend.isPending && <Loader2 className="animate-spin" />} Prorrogar
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ───────────────────────────── Cancelamento (rascunho) ─────────────────────────────

export function CancelContractDialog({ contract: c, open, onOpenChange }: DialogProps) {
  const cancel = useCancelContract(c.id);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (reason.trim().length < 3) return setError('Escreva o motivo.');
    try {
      await cancel.mutateAsync(reason.trim());
      toast.success('Contrato cancelado', { description: 'A moto voltou a ficar disponível.' });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={submit} className="space-y-4">
        <DialogHeader>
          <DialogTitle>Cancelar contrato {c.number}?</DialogTitle>
          <DialogDescription>
            O rascunho deixa de valer e a moto {formatPlate(c.motorcycle.plate)} volta a ficar
            disponível. Fica tudo no histórico.
          </DialogDescription>
        </DialogHeader>
        <Field label="Motivo" required>
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="Ex.: cliente desistiu"
              autoFocus
            />
          )}
        </Field>
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button type="submit" variant="destructive" disabled={cancel.isPending}>
            {cancel.isPending && <Loader2 className="animate-spin" />} Cancelar contrato
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
