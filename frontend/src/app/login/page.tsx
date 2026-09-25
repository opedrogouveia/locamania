'use client';

import { formatCpf, onlyDigits } from '@locamania/shared';
import { Info, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Spinner } from '@/components/ui/spinner';
import { errorMessage } from '@/lib/api/client';
import { getSession, homeFor } from '@/lib/auth/session';
import { useLogin } from '@/lib/auth/use-auth';

/**
 * Login único (decisão D5): quem digita e-mail entra no painel; quem digita
 * CPF entra no app do cliente. Uma URL só para mandar a todo mundo.
 */
export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);

  // `window.location` e não `useSearchParams`: o hook exige Suspense e quebra o build estático.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(params.get('next'));
    if (params.get('expired')) setNotice('Sua sessão expirou. Entre novamente.');
    if (params.get('reset')) setNotice('Senha definida. Entre com a nova senha.');
    const session = getSession();
    if (session) router.replace(homeFor(session.kind));
  }, [router]);

  // Digitou só números? Formata como CPF enquanto digita.
  function onIdentifierChange(value: string) {
    const looksLikeCpf = !/[a-zA-Z@]/.test(value) && onlyDigits(value).length > 0;
    setIdentifier(looksLikeCpf ? formatCpf(value) : value);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate(
      { identifier, password },
      {
        onSuccess: (result) => {
          const home = homeFor(result.actor.kind);
          const target = next && next.startsWith(home) ? next : home;
          router.replace(target);
        },
      },
    );
  }

  return (
    <AuthLayout title="Entrar" description="Use seu e-mail (equipe) ou CPF (cliente) e a sua senha.">
      {notice && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 p-3 text-sm text-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          {notice}
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="identifier">E-mail ou CPF</Label>
          <Input
            id="identifier"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="seu@email.com ou 000.000.000-00"
            value={identifier}
            onChange={(e) => onIdentifierChange(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
              Esqueci minha senha
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <FormError message={login.isError ? errorMessage(login.error) : null} />
        <Button type="submit" size="lg" className="w-full" disabled={login.isPending || !identifier || !password}>
          {login.isPending ? <Spinner /> : <LogIn />}
          Entrar
        </Button>
      </form>
      <p className="mt-8 text-center text-xs text-muted-foreground">
        Cliente sem senha? Use o link de primeiro acesso que a Locamania enviou.{' '}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacidade
        </Link>
      </p>
    </AuthLayout>
  );
}
