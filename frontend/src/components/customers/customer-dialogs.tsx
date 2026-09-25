'use client';

import type { CustomerDto, PortalInviteResponse } from '@locamania/shared';
import { ExternalLink, Mail } from 'lucide-react';
import { useState } from 'react';

import { CopyButton } from '@/components/shared/copy-button';
import { WhatsAppIcon } from '@/components/shared/whatsapp-icon';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form-error';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useCustomerStatus } from '@/lib/queries';
import { formatDateTime } from '@/lib/utils';

/** Link de primeiro acesso: copiar, mandar pelo WhatsApp (e-mail já saiu, se houver). */
export function InviteDialog({ invite, onOpenChange }: { invite: PortalInviteResponse | null; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={!!invite} onOpenChange={onOpenChange}>
      {invite && (
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle>Acesso ao aplicativo</DialogTitle>
            <DialogDescription>O cliente abre o link, cria a senha e entra com o CPF. Vale até {formatDateTime(invite.expiresAt)}.</DialogDescription>
          </DialogHeader>
          <div className="break-all rounded-lg bg-muted p-3 font-mono text-xs">{invite.link}</div>
          {invite.emailSent && (
            <p className="flex items-center gap-2 text-sm text-success">
              <Mail className="size-4" /> Link enviado também por e-mail.
            </p>
          )}
          <DialogFooter>
            <CopyButton text={invite.link} label="Copiar link" />
            {invite.whatsappLink && (
              <Button asChild>
                <a href={invite.whatsappLink} target="_blank" rel="noreferrer">
                  <WhatsAppIcon className="size-4" /> Enviar no WhatsApp <ExternalLink className="opacity-60" />
                </a>
              </Button>
            )}
          </DialogFooter>
        </div>
      )}
    </Dialog>
  );
}

/** Bloquear / inativar com motivo (fica na ficha e no histórico). */
export function StatusDialog({
  customer,
  target,
  onOpenChange,
}: {
  customer: CustomerDto;
  target: 'BLOCKED' | 'INACTIVE' | null;
  onOpenChange: (v: boolean) => void;
}) {
  const setStatus = useCustomerStatus(customer.id);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const blocking = target === 'BLOCKED';
  return (
    <Dialog
      open={!!target}
      onOpenChange={(v) => {
        if (!v) {
          setReason('');
          setError(null);
        }
        onOpenChange(v);
      }}
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!target) return;
          if (reason.trim().length < 3) return setError('Escreva o motivo.');
          try {
            await setStatus.mutateAsync({ manualStatus: target, reason: reason.trim() });
            toast.success(blocking ? 'Cliente bloqueado' : 'Cliente inativado');
            setReason('');
            onOpenChange(false);
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{blocking ? 'Bloquear cliente' : 'Inativar cliente'}</DialogTitle>
          <DialogDescription>
            {blocking
              ? 'Cliente bloqueado não pode fazer novo aluguel. A moto e o contrato atuais não mudam sozinhos.'
              : 'Cliente inativo sai das listas do dia a dia. Pode ser reativado depois.'}
          </DialogDescription>
        </DialogHeader>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo" aria-label="Motivo" autoFocus />
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button type="submit" variant={blocking ? 'destructive' : 'default'} disabled={setStatus.isPending}>
            {blocking ? 'Bloquear' : 'Inativar'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
