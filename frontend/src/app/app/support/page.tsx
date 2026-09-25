'use client';

import type { SupportMessageDto } from '@locamania/shared';
import { Clock, Mail, MapPin, MessageSquareText, Phone, Send, WifiOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Panel, PanelHeader, PortalError, PortalTitle, ToneIcon } from '@/components/portal/kit';
import { WhatsAppIcon } from '@/components/shared/whatsapp-icon';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { SupportStatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { formatDay, formatTime, timeAgo } from '@/lib/portal/format';
import { usePortalSupport, usePortalSupportInfo, useSendSupport } from '@/lib/queries/portal';
import { useOnline } from '@/lib/use-online';
import { cn, formatPhone } from '@/lib/utils';

/** Assunto por lista (nada de texto livre onde cabe opção) — a equipe já sabe do que se trata. */
const SUBJECTS = ['Pagamento', 'Minha moto', 'Manutenção', 'Contrato', 'Outro assunto'] as const;
const MAX_BODY = 2000;

function ContactCard() {
  const { data, isLoading, error, refetch } = usePortalSupportInfo();

  if (isLoading) return <Skeleton className="h-72 w-full rounded-2xl" />;
  if (error || !data) return <PortalError error={error} onRetry={() => void refetch()} />;

  return (
    <Panel className="p-5 sm:p-6">
      <PanelHeader icon={Phone} title={`Fale com a ${data.companyName}`} />
      <div className="space-y-2.5">
        {data.whatsappLink && (
          <Button asChild size="lg" className="h-14 w-full rounded-2xl bg-success text-base font-semibold text-success-foreground hover:bg-success/90 [&_svg]:size-5">
            <a href={data.whatsappLink} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon /> Chamar no WhatsApp
            </a>
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          {data.phone && (
            <Button asChild variant="outline" size="lg" className="h-12 rounded-xl">
              <a href={`tel:+55${data.phone.replace(/\D/g, '')}`}>
                <Phone /> Ligar
              </a>
            </Button>
          )}
          {data.email && (
            <Button asChild variant="outline" size="lg" className={cn('h-12 rounded-xl', !data.phone && 'col-span-2')}>
              <a href={`mailto:${data.email}`}>
                <Mail /> E-mail
              </a>
            </Button>
          )}
        </div>
      </div>

      <dl className="mt-5 space-y-3.5 border-t border-border pt-5 text-sm">
        {data.supportHours && (
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <dt className="font-medium">Horário de atendimento</dt>
              <dd className="text-muted-foreground">{data.supportHours}</dd>
            </div>
          </div>
        )}
        {(data.phone || data.whatsapp) && (
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <dt className="font-medium">Telefones</dt>
              <dd className="text-muted-foreground tabular">
                {[data.phone && formatPhone(data.phone), data.whatsapp && `${formatPhone(data.whatsapp)} (WhatsApp)`].filter(Boolean).join(' · ')}
              </dd>
            </div>
          </div>
        )}
        {data.email && (
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <dt className="font-medium">E-mail</dt>
              <dd className="break-all text-muted-foreground">{data.email}</dd>
            </div>
          </div>
        )}
        {data.address && (
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <dt className="font-medium">Endereço</dt>
              <dd className="text-muted-foreground">{data.address}</dd>
            </div>
          </div>
        )}
      </dl>
    </Panel>
  );
}

function NewMessage() {
  const send = useSendSupport();
  const online = useOnline();
  const [subject, setSubject] = useState<(typeof SUBJECTS)[number] | null>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!subject) return setError('Escolha o assunto.');
    if (!body.trim()) return setError('Escreva a mensagem.');
    try {
      await send.mutateAsync({ subject, body: body.trim() });
      setSubject(null);
      setBody('');
      toast.success('Mensagem enviada', { description: 'A Locamania responde por aqui. Você recebe um aviso.' });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Panel className="p-5 sm:p-6">
      <PanelHeader icon={MessageSquareText} title="Enviar mensagem" />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Assunto</legend>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSubject(s);
                  setError(null);
                }}
                aria-pressed={subject === s}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-medium transition-colors',
                  subject === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-accent',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="space-y-1.5">
          <Label htmlFor="support-body">Mensagem</Label>
          <Textarea
            id="support-body"
            value={body}
            onChange={(e) => {
              setBody(e.target.value.slice(0, MAX_BODY));
              setError(null);
            }}
            rows={4}
            placeholder="Conte o que aconteceu ou o que você precisa."
            className="min-h-28 rounded-xl"
          />
          {body.length > MAX_BODY - 200 && <p className="text-right text-xs text-muted-foreground tabular">{MAX_BODY - body.length} caracteres restantes</p>}
        </div>
        {!online && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
            <WifiOff className="size-4" aria-hidden /> Sem conexão com a internet.
          </p>
        )}
        <FormError message={error} />
        <Button type="submit" size="lg" className="h-12 w-full text-base sm:w-auto" disabled={send.isPending || !online}>
          {send.isPending ? <Spinner /> : <Send />} Enviar mensagem
        </Button>
      </form>
    </Panel>
  );
}

function MessageItem({ m }: { m: SupportMessageDto }) {
  return (
    <li className="space-y-2.5 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[15px] font-semibold">{m.subject}</p>
        <SupportStatusBadge status={m.status} />
      </div>
      <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-md bg-primary/10 px-3.5 py-2.5 text-sm">
        <p className="whitespace-pre-wrap break-words">{m.body}</p>
        <p className="mt-1 text-right text-xs text-muted-foreground">Você · {timeAgo(m.createdAt)}</p>
      </div>
      {m.answer ? (
        <div className="max-w-[92%] rounded-2xl rounded-tl-md border border-border bg-muted/60 px-3.5 py-2.5 text-sm">
          <p className="whitespace-pre-wrap break-words">{m.answer}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Locamania{m.answeredAt ? ` · ${formatDay(m.answeredAt)} às ${formatTime(m.answeredAt)}` : ''}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Aguardando resposta da Locamania.</p>
      )}
    </li>
  );
}

function Messages() {
  const { data, isLoading, error, refetch } = usePortalSupport();
  return (
    <Panel className="p-5 sm:p-6">
      <PanelHeader icon={MessageSquareText} tone="info" title="Suas mensagens" />
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : error || !data ? (
        <PortalError error={error} onRetry={() => void refetch()} />
      ) : data.data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <ToneIcon icon={MessageSquareText} tone="muted" size="lg" />
          <p className="font-medium">Nenhuma mensagem ainda</p>
          <p className="text-sm text-muted-foreground">As respostas da Locamania aparecem aqui.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {data.data.map((m) => (
            <MessageItem key={m.id} m={m} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * Suporte (§17): WhatsApp, telefone e e-mail da Locamania com o horário, e
 * mensagens pelo app com as respostas da equipe.
 */
export default function SupportPage() {
  return (
    <div className="space-y-5 lg:space-y-6">
      <PortalTitle title="Suporte" subtitle="Precisa de ajuda? Fale com a gente." />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5 lg:gap-6">
        <div className="space-y-4 lg:col-span-2">
          <ContactCard />
        </div>
        <div className="space-y-4 lg:col-span-3">
          <NewMessage />
          <Messages />
        </div>
      </div>
    </div>
  );
}
