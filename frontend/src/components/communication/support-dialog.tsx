'use client';

import { Permission, type SupportMessageDto } from '@locamania/shared';
import { CheckCircle2, Loader2, Phone, Send, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { WhatsAppIcon } from '@/components/shared/whatsapp-icon';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form-error';
import { SupportStatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { useAnswerSupport, useCloseSupport, useCustomer } from '@/lib/queries';
import { useCustomerSupport } from '@/lib/settings/queries';
import { cn, firstName, formatDateTime, formatPhone, whatsappLink } from '@/lib/utils';

const ANSWER_MAX = 2000;

/** Mensagem do cliente: ler, responder (e encerrar), falar pelo WhatsApp. */
export function SupportDialog({
  message,
  onOpenChange,
  onChanged,
  onPick,
}: {
  message: SupportMessageDto | null;
  onOpenChange: (open: boolean) => void;
  /** A API devolve a mensagem atualizada: a tela mantém o diálogo em dia. */
  onChanged: (m: SupportMessageDto) => void;
  /** Abrir outra mensagem do mesmo cliente. */
  onPick: (m: SupportMessageDto) => void;
}) {
  const canCustomer = useCan(Permission.CUSTOMERS_VIEW);
  const { data: customer } = useCustomer(message && canCustomer ? message.customer.id : undefined);
  const { data: others } = useCustomerSupport(message?.customer.id);
  const answer = useAnswerSupport();
  const close = useCloseSupport();
  const confirm = useConfirm();
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText('');
    setEditing(false);
    setError(null);
  }, [message?.id]);

  if (!message) return null;
  const m = message;

  const phone = customer?.whatsapp ?? customer?.phone ?? null;
  const wa = whatsappLink(phone, `Olá, ${firstName(m.customer.label)}! Aqui é da Locamania, sobre a sua mensagem "${m.subject}": `);
  const canReply = m.status === 'OPEN' || editing;
  const otherMessages = (others?.data ?? []).filter((o) => o.id !== m.id).slice(0, 3);

  async function reply(closeToo: boolean) {
    if (!text.trim()) return setError('Escreva a resposta.');
    setError(null);
    try {
      const out = await answer.mutateAsync({ id: m.id, answer: text.trim(), close: closeToo });
      onChanged(out);
      setText('');
      setEditing(false);
      toast.success(closeToo ? 'Resposta enviada e conversa encerrada' : 'Resposta enviada', { description: `${m.customer.label} recebe o aviso no aplicativo (e por e-mail, se tiver).` });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onClose() {
    const ok = await confirm({
      title: 'Encerrar esta mensagem?',
      description: m.status === 'OPEN' ? 'Ela sai de "Aguardando resposta" sem resposta pelo aplicativo — use quando já resolveu por telefone ou WhatsApp.' : 'Ela vai para "Encerradas".',
      confirmText: 'Encerrar',
    });
    if (!ok) return;
    try {
      onChanged(await close.mutateAsync(m.id));
      toast.success('Mensagem encerrada');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const busy = answer.isPending || close.isPending;

  return (
    <Dialog open onOpenChange={onOpenChange} className="sm:max-w-2xl">
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <SupportStatusBadge status={m.status} />
          <span className="text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</span>
        </div>
        <DialogTitle>{m.subject}</DialogTitle>
        <DialogDescription>Mensagem enviada pelo aplicativo.</DialogDescription>
      </DialogHeader>

      {/* Cliente + atalhos */}
      <div className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={m.customer.label} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{m.customer.label}</p>
            <p className="truncate text-xs text-muted-foreground tabular">{phone ? formatPhone(phone) : 'Cliente'}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {canCustomer && (
            <Button asChild variant="outline" size="default">
              <Link href={`/admin/customers/${m.customer.id}`}>
                <UserRound /> Ver ficha
              </Link>
            </Button>
          )}
          {wa ? (
            <Button asChild variant="outline">
              <a href={wa} target="_blank" rel="noreferrer">
                <WhatsAppIcon className="size-4 text-success" /> WhatsApp
              </a>
            </Button>
          ) : (
            customer?.phone && (
              <Button asChild variant="outline">
                <a href={`tel:+55${customer.phone}`}>
                  <Phone /> Ligar
                </a>
              </Button>
            )
          )}
        </div>
      </div>

      {/* Conversa */}
      <div className="mt-4 space-y-3">
        <div className="mr-8 rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
          <p className="whitespace-pre-line break-words text-[15px] leading-relaxed sm:text-sm">{m.body}</p>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {firstName(m.customer.label)} · {formatDateTime(m.createdAt)}
          </p>
        </div>
        {m.answer && !editing && (
          <div className="ml-8 rounded-2xl rounded-tr-sm bg-primary/10 px-4 py-3">
            <p className="whitespace-pre-line break-words text-[15px] leading-relaxed sm:text-sm">{m.answer}</p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {m.answeredBy ?? 'Equipe'} · {m.answeredAt ? formatDateTime(m.answeredAt) : ''}
            </p>
          </div>
        )}
      </div>

      {/* Resposta */}
      {canReply ? (
        <div className="mt-4 space-y-2">
          <label htmlFor="support-answer" className="text-[13px] font-medium">
            {editing ? 'Nova resposta (substitui a anterior)' : 'Sua resposta'}
          </label>
          <Textarea
            id="support-answer"
            value={text}
            onChange={(e) => (setText(e.target.value), setError(null))}
            rows={4}
            maxLength={ANSWER_MAX}
            placeholder={`Olá, ${firstName(m.customer.label)}! …`}
            autoCapitalize="sentences"
            className="text-[15px] leading-relaxed"
          />
          <p className="text-xs text-muted-foreground">O cliente recebe a resposta no aplicativo (e por e-mail, se tiver e-mail cadastrado).</p>
          <FormError message={error} />
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            {editing ? (
              <Button type="button" variant="ghost" onClick={() => (setEditing(false), setText(''))} disabled={busy}>
                Cancelar
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                Encerrar sem responder
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => void reply(false)} disabled={busy}>
              {answer.isPending ? <Loader2 className="animate-spin" /> : <Send />}
              Responder
            </Button>
            <Button type="button" onClick={() => void reply(true)} disabled={busy}>
              <CheckCircle2 /> Responder e encerrar
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {m.status === 'ANSWERED' && (
            <>
              <Button type="button" variant="outline" onClick={() => (setEditing(true), setText(m.answer ?? ''))} disabled={busy}>
                Corrigir resposta
              </Button>
              <Button type="button" onClick={onClose} disabled={busy}>
                {close.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                Encerrar
              </Button>
            </>
          )}
          {m.status === 'CLOSED' && <p className="text-sm text-muted-foreground">Conversa encerrada.</p>}
        </div>
      )}

      {otherMessages.length > 0 && (
        <div className="mt-6 border-t border-border pt-4">
          <p className="mb-2 text-[13px] font-medium">Outras mensagens de {firstName(m.customer.label)}</p>
          <ul className="space-y-1">
            {otherMessages.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => onPick(o)}
                  className={cn('flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent')}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{o.subject}</span>
                    <span className="block text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</span>
                  </span>
                  <SupportStatusBadge status={o.status} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
