'use client';

import { STAFF_ROLES, STAFF_ROLE_LABELS, isValidPhone, type CreateUserRequest, type StaffRole, type UserDto } from '@locamania/shared';
import { Loader2, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/kit';
import { MaskedInput } from '@/components/ui/masked-input';
import { PasswordInput } from '@/components/ui/password-input';
import { SelectMenu } from '@/components/ui/select-menu';
import { Switch } from '@/components/ui/switch';
import { ApiError, errorMessage } from '@/lib/api/client';
import { ROLE_HINT } from '@/lib/settings/meta';

/** Mesma regra da API: 8+ caracteres, com letra e número. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return 'A senha precisa ter letras e números.';
  return null;
}

/** Senha fácil de ditar: 5 letras (sem l/o/i) + 3 números. */
export function generatePassword(): string {
  const letters = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const rnd = new Uint32Array(8);
  crypto.getRandomValues(rnd);
  const a = Array.from(rnd.slice(0, 5), (n) => letters[n % letters.length]).join('');
  const b = Array.from(rnd.slice(5), (n) => digits[n % digits.length]).join('');
  return a.charAt(0).toUpperCase() + a.slice(1) + b;
}

function PasswordField({ value, onChange, error, label, hint }: { value: string; onChange: (v: string) => void; error?: string | null; label: string; hint: string }) {
  return (
    <Field label={label} required error={error} hint={hint}>
      {(id) => (
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <PasswordInput id={id} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" autoCapitalize="none" spellCheck={false} />
          </div>
          <Button type="button" variant="outline" onClick={() => onChange(generatePassword())}>
            <Wand2 /> Gerar
          </Button>
        </div>
      )}
    </Field>
  );
}

// ───────────────────────────── Criar / editar ─────────────────────────────

type FormErrors = Partial<Record<'name' | 'email' | 'phone' | 'role' | 'password', string>>;

export function UserFormDialog({
  open,
  user,
  isSelf,
  canGrantOwner,
  onOpenChange,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  /** Ausente = novo usuário. */
  user: UserDto | null;
  isSelf: boolean;
  /** Só um Proprietário dá o perfil de Proprietário. */
  canGrantOwner: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (body: CreateUserRequest) => Promise<void>;
  onUpdate: (body: { name: string; email: string; phone: string | null; role: StaffRole; active: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<StaffRole | ''>('');
  const [active, setActive] = useState(true);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setPhone(user?.phone ?? '');
    setRole(user?.role ?? '');
    setActive(user?.active ?? true);
    setPassword('');
    setErrors({});
    setFormError(null);
  }, [open, user]);

  const roleOptions = STAFF_ROLES.filter((r) => canGrantOwner || r !== 'OWNER' || user?.role === 'OWNER').map((r) => ({
    value: r,
    label: STAFF_ROLE_LABELS[r],
    hint: ROLE_HINT[r],
  }));
  const lockRole = isSelf && user?.role === 'OWNER';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found: FormErrors = {};
    if (name.trim().length < 2) found.name = 'Informe o nome.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) found.email = 'E-mail inválido.';
    if (phone && !isValidPhone(phone)) found.phone = 'Telefone inválido (com DDD).';
    if (!role) found.role = 'Escolha o perfil.';
    if (!user) {
      const p = passwordProblem(password);
      if (p) found.password = p;
    }
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setFormError(null);
    try {
      const body = { name: name.trim(), email: email.trim().toLowerCase(), phone: phone || null, role: role as StaffRole };
      if (user) await onUpdate({ ...body, active });
      else await onCreate({ ...body, password });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CONFLICT') setErrors((p) => ({ ...p, email: err.message }));
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={submit} noValidate>
        <DialogHeader>
          <DialogTitle>{user ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
          <DialogDescription>{user ? 'Mudanças de perfil valem na próxima tela que a pessoa abrir.' : 'Cada pessoa da equipe tem o próprio login.'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Nome" required error={errors.name}>
            {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" autoCapitalize="words" maxLength={120} />}
          </Field>
          <Field label="E-mail (login)" required error={errors.email}>
            {(id) => (
              <Input id={id} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={120} />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Celular" error={errors.phone}>
              {(id) => <MaskedInput id={id} mask="phone" value={phone} onValue={setPhone} placeholder="(00) 00000-0000" />}
            </Field>
            <Field label="Perfil" required error={errors.role} hint={lockRole ? 'Você não pode tirar o seu próprio perfil de Proprietário.' : undefined}>
              {(id) => <SelectMenu id={id} value={role} onChange={(v) => setRole(v as StaffRole)} placeholder="Escolha" options={roleOptions} disabled={lockRole} />}
            </Field>
          </div>
          {!user && <PasswordField label="Senha inicial" value={password} onChange={setPassword} error={errors.password} hint="Mínimo 8 caracteres, com letras e números. Passe para a pessoa; ela troca depois em Meu perfil." />}
          {user && (
            <div className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <label htmlFor="user-active" className="text-sm">
                <span className="font-medium">Acesso liberado</span>
                <span className="block text-xs text-muted-foreground">{isSelf ? 'Você não pode desativar a sua própria conta.' : 'Desligado, a pessoa sai do sistema na hora e não entra mais.'}</span>
              </label>
              <Switch id="user-active" checked={active} onCheckedChange={setActive} disabled={isSelf} />
            </div>
          )}
          <FormError message={formError} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {user ? 'Salvar' : 'Cadastrar usuário'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ───────────────────────────── Nova senha ─────────────────────────────

export function PasswordDialog({
  user,
  onOpenChange,
  onSubmit,
}: {
  user: UserDto | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setPassword('');
      setError(null);
    }
  }, [user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = passwordProblem(password);
    if (p) return setError(p);
    setBusy(true);
    setError(null);
    try {
      await onSubmit(password);
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange} className="max-w-md">
      <form onSubmit={submit} noValidate>
        <DialogHeader>
          <DialogTitle>Definir nova senha</DialogTitle>
          <DialogDescription>{user ? `${user.name} sai de todos os aparelhos e entra de novo com a senha nova.` : ''}</DialogDescription>
        </DialogHeader>
        <PasswordField label="Nova senha" value={password} onChange={(v) => (setPassword(v), setError(null))} error={error} hint="Mínimo 8 caracteres, com letras e números." />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            Definir senha
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
