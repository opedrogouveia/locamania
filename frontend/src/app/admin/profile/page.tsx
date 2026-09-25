'use client';

import { STAFF_ROLE_LABELS, isValidPhone, type UserDto } from '@locamania/shared';
import { Check, KeyRound, Loader2, LogOut, MonitorSmartphone, TriangleAlert, X } from 'lucide-react';
import { useState } from 'react';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { DetailList, Field, SectionCard } from '@/components/ui/kit';
import { MaskedInput } from '@/components/ui/masked-input';
import { PageHeader } from '@/components/ui/page-header';
import { PasswordInput } from '@/components/ui/password-input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { clearSession } from '@/lib/auth/session';
import { useLogout } from '@/lib/auth/use-auth';
import { useChangePassword, useEndMySessions, useProfile } from '@/lib/profile/queries';
import { useUpdateProfile } from '@/lib/queries';
import { cn, formatDateTime } from '@/lib/utils';

const RULES = [
  { test: (p: string) => p.length >= 8, label: 'Pelo menos 8 caracteres' },
  { test: (p: string) => /[a-zA-Z]/.test(p) && /\d/.test(p), label: 'Letras e números' },
];

function DataCard({ user }: { user: UserDto }) {
  const update = useUpdateProfile();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const dirty = name.trim() !== user.name || (phone || null) !== (user.phone || null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const found: typeof errors = {};
    if (name.trim().length < 3) found.name = 'Informe o nome completo.';
    if (phone && !isValidPhone(phone)) found.phone = 'Telefone inválido.';
    setErrors(found);
    if (Object.keys(found).length) return;
    try {
      await update.mutateAsync({ name: name.trim(), phone: phone || null });
      toast.success('Dados atualizados');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <SectionCard title="Seus dados" description="O nome aparece no histórico de tudo o que você faz no sistema.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome completo" required error={errors.name}>
            {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoCapitalize="words" maxLength={120} />}
          </Field>
          <Field label="Celular" error={errors.phone}>
            {(id) => <MaskedInput id={id} mask="phone" value={phone} onValue={setPhone} placeholder="(00) 00000-0000" autoComplete="tel" />}
          </Field>
          <Field label="E-mail (login)" hint="Para trocar o e-mail, peça a quem cuida dos usuários.">
            {(id) => <Input id={id} value={user.email} disabled readOnly />}
          </Field>
        </div>
        <FormError message={error} />
        <div className="flex justify-end">
          <Button type="submit" disabled={!dirty || update.isPending} className="w-full sm:w-auto">
            {update.isPending && <Loader2 className="animate-spin" />}
            Salvar dados
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

function PasswordCard() {
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ok = !!current && RULES.every((r) => r.test(next)) && next === confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    setError(null);
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.success('Senha alterada', { description: 'Os outros aparelhos foram desconectados; este continua conectado.' });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <SectionCard title="Trocar senha" description="Trocar a senha desconecta os outros aparelhos e mantém este.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {/* Campo oculto de usuário: gerenciadores de senha precisam dele para salvar a senha nova. */}
        <input type="text" name="username" autoComplete="username" hidden readOnly />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Senha atual" required>
            {(id) => <PasswordInput id={id} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />}
          </Field>
          <Field label="Nova senha" required>
            {(id) => <PasswordInput id={id} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />}
          </Field>
          <Field label="Repita a nova senha" required error={confirm && confirm !== next ? 'As senhas não conferem.' : null}>
            {(id) => <PasswordInput id={id} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />}
          </Field>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {RULES.map((r) => {
            const pass = r.test(next);
            return (
              <li key={r.label} className={cn('flex items-center gap-1.5', pass ? 'text-success' : 'text-muted-foreground')}>
                {pass ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
                {r.label}
              </li>
            );
          })}
        </ul>
        <FormError message={error} />
        <div className="flex justify-end">
          <Button type="submit" disabled={!ok || change.isPending} className="w-full sm:w-auto">
            {change.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
            Trocar senha
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

function SessionsCard() {
  const endAll = useEndMySessions();
  const logout = useLogout();
  const confirm = useConfirm();

  async function onEndAll() {
    const ok = await confirm({
      title: 'Sair de todos os aparelhos?',
      description: 'Desconecta o celular, o computador e qualquer outro lugar onde sua conta estiver aberta — inclusive este. Você entra de novo com sua senha.',
      confirmText: 'Sair de todos',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await endAll.mutateAsync();
      toast.success('Todos os aparelhos foram desconectados');
      clearSession();
      window.location.href = '/login';
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <SectionCard title="Aparelhos conectados" description="Esqueceu a conta aberta em outro lugar ou perdeu o celular? Desconecte tudo daqui.">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut /> Sair deste aparelho
        </Button>
        <Button variant="destructive" onClick={() => void onEndAll()} disabled={endAll.isPending}>
          {endAll.isPending ? <Loader2 className="animate-spin" /> : <MonitorSmartphone />}
          Sair de todos os aparelhos
        </Button>
      </div>
    </SectionCard>
  );
}

export default function ProfilePage() {
  const { data: user, isLoading, error } = useProfile();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Meu perfil" description="Seus dados, sua senha e os aparelhos conectados." />
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : error || !user ? (
        <EmptyState icon={TriangleAlert} title="Não foi possível carregar seu perfil" description={errorMessage(error)} />
      ) : (
        <>
          <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <Avatar name={user.name} className="size-14 text-lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">{user.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="default">{STAFF_ROLE_LABELS[user.role]}</Badge>
                <span className="truncate">{user.email}</span>
              </div>
            </div>
            <DetailList
              cols={1}
              className="hidden shrink-0 text-right sm:grid"
              items={[
                { label: 'Último acesso', value: user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Primeiro acesso' },
                { label: 'Na equipe desde', value: formatDateTime(user.createdAt).slice(0, 10) },
              ]}
            />
          </div>
          <DataCard key={user.id + user.name + (user.phone ?? '')} user={user} />
          <PasswordCard />
          <SessionsCard />
        </>
      )}
    </div>
  );
}
