'use client';

import type { AuthTokenInfo } from '@locamania/shared';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { AuthLayout } from '@/components/auth/auth-layout';
import { BackLink } from '@/components/ui/back-link';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { authApi } from '@/lib/api/auth';
import { errorMessage } from '@/lib/api/client';
import { homeFor } from '@/lib/auth/session';
import { storeLogin } from '@/lib/auth/use-auth';
import { cn } from '@/lib/utils';

const RULES = [
  { test: (p: string) => p.length >= 8, label: 'Pelo menos 8 caracteres' },
  { test: (p: string) => /[a-zA-Z]/.test(p) && /\d/.test(p), label: 'Letras e números' },
];

/** Criar senha pelo link: vale para "primeiro acesso" (convite) e "redefinir". */
export function SetPasswordForm({ mode }: { mode: 'first-access' | 'reset' }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [info, setInfo] = useState<AuthTokenInfo | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token');
    setToken(t);
    if (!t) {
      setInfo({ valid: false, purpose: null, name: null });
      return;
    }
    authApi
      .tokenInfo(t)
      .then(setInfo)
      .catch(() => setInfo({ valid: false, purpose: null, name: null }));
  }, []);

  const ok = RULES.every((r) => r.test(password)) && password === confirm;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !ok) return;
    setPending(true);
    setError(null);
    try {
      const result = await authApi.reset(token, password);
      qc.clear();
      storeLogin(result);
      router.replace(homeFor(result.actor.kind));
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  const title = mode === 'first-access' ? 'Primeiro acesso' : 'Criar nova senha';
  const hello = info?.name ? `Olá, ${info.name}! ` : '';
  const description =
    mode === 'first-access'
      ? `${hello}Crie a senha do seu aplicativo Locamania. Depois é só entrar com seu CPF e esta senha.`
      : `${hello}Escolha uma nova senha para entrar.`;

  return (
    <AuthLayout title={title} description={info?.valid ? description : undefined}>
      {!info ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : !info.valid ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            <p>Este link expirou ou já foi usado. Peça um novo à Locamania ou use "Esqueci minha senha".</p>
          </div>
          <BackLink href="/login">Ir para o login</BackLink>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <ul className="space-y-1 text-sm">
            {RULES.map((r) => {
              const pass = r.test(password);
              return (
                <li key={r.label} className={cn('flex items-center gap-2', pass ? 'text-success' : 'text-muted-foreground')}>
                  {pass ? <Check className="size-4" /> : <X className="size-4" />}
                  {r.label}
                </li>
              );
            })}
          </ul>
          <div className="space-y-2">
            <Label htmlFor="confirm">Repita a senha</Label>
            <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {confirm && confirm !== password && <p className="text-sm text-destructive">As senhas não conferem.</p>}
          </div>
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" disabled={!ok || pending}>
            {pending && <Spinner />}
            {mode === 'first-access' ? 'Criar senha e entrar' : 'Salvar nova senha'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
