'use client';

import { formatYmd } from '@locamania/shared';
import { Check, KeyRound, LogOut, UserRound, X } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';

import { Panel, PanelHeader, PortalError, PortalSkeleton, PortalTitle } from '@/components/portal/kit';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useLogout } from '@/lib/auth/use-auth';
import { useChangeCustomerPassword } from '@/lib/portal/queries';
import { usePortalProfile } from '@/lib/queries/portal';
import { useOnline } from '@/lib/use-online';
import { cn, formatPhone } from '@/lib/utils';

/** Mesmas regras da API (8+ caracteres, letras e números) — mostradas enquanto digita. */
const RULES = [
  { test: (p: string) => p.length >= 8, label: 'Pelo menos 8 caracteres' },
  { test: (p: string) => /[a-zA-Z]/.test(p) && /\d/.test(p), label: 'Letras e números' },
];

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-[15px]">{children || '—'}</dd>
    </div>
  );
}

function ChangePassword() {
  const change = useChangeCustomerPassword();
  const online = useOnline();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const rulesOk = RULES.every((r) => r.test(next));
  const ok = !!current && rulesOk && next === confirm;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!ok) return;
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.success('Senha trocada', { description: 'Use a nova senha da próxima vez que entrar.' });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Panel className="p-5 sm:p-6">
      <PanelHeader icon={KeyRound} title="Trocar senha" />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="pw-current">Senha atual</Label>
          <PasswordInput id="pw-current" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="h-12" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-new">Nova senha</Label>
          <PasswordInput id="pw-new" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className="h-12" />
          <ul className="space-y-1 pt-1 text-sm">
            {RULES.map((r) => {
              const pass = r.test(next);
              return (
                <li key={r.label} className={cn('flex items-center gap-2', pass ? 'text-success' : 'text-muted-foreground')}>
                  {pass ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
                  {r.label}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-confirm">Repita a nova senha</Label>
          <PasswordInput id="pw-confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-12" />
          {confirm && confirm !== next && <p className="text-sm text-destructive">As senhas não conferem.</p>}
        </div>
        <FormError message={error ?? (!online ? 'Sem conexão com a internet.' : null)} />
        <Button type="submit" size="lg" className="h-12 w-full text-base sm:w-auto" disabled={!ok || change.isPending || !online}>
          {change.isPending && <Spinner />}
          Salvar nova senha
        </Button>
      </form>
    </Panel>
  );
}

/**
 * Meu perfil (§17): dados básicos só para conferir (quem muda é a Locamania),
 * trocar a senha e sair.
 */
export default function ProfilePage() {
  const { data, isLoading, error, refetch } = usePortalProfile();
  const logout = useLogout();

  if (isLoading) return <PortalSkeleton cards={2} />;
  if (error || !data) return <PortalError error={error} onRetry={() => void refetch()} />;

  return (
    <div className="space-y-5 lg:space-y-6">
      <PortalTitle title="Meu perfil" />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-6">
        <Panel className="p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <Avatar name={data.name} className="size-14 text-lg" />
            <div className="min-w-0">
              <p className="text-lg font-semibold leading-tight">{data.name}</p>
              <p className="text-sm text-muted-foreground tabular">CPF {data.cpfMasked}</p>
            </div>
          </div>
          <dl className="mt-4 divide-y divide-border border-t border-border">
            <InfoRow label="Celular">{data.phone && formatPhone(data.phone)}</InfoRow>
            {data.whatsapp && data.whatsapp !== data.phone && <InfoRow label="WhatsApp">{formatPhone(data.whatsapp)}</InfoRow>}
            <InfoRow label="E-mail">{data.email}</InfoRow>
            <InfoRow label="Endereço">{data.address}</InfoRow>
            <InfoRow label="Validade da CNH">{data.cnhExpiresAt && formatYmd(data.cnhExpiresAt)}</InfoRow>
          </dl>
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-muted/60 px-3.5 py-3 text-sm text-muted-foreground">
            <UserRound className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Algum dado errado ou mudou de endereço?{' '}
              <Link href="/app/support" className="font-medium text-primary underline-offset-4 hover:underline">
                Avise a Locamania
              </Link>
              .
            </span>
          </p>
        </Panel>

        <div className="space-y-4">
          <ChangePassword />
          <Button variant="outline" size="lg" className="h-12 w-full text-base text-destructive hover:text-destructive" onClick={() => logout.mutate()} disabled={logout.isPending}>
            <LogOut /> Sair do aplicativo
          </Button>
        </div>
      </div>
    </div>
  );
}
