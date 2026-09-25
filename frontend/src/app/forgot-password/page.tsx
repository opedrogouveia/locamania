'use client';

import { formatCpf, onlyDigits } from '@locamania/shared';
import { MailCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { AuthLayout } from '@/components/auth/auth-layout';
import { BackLink } from '@/components/ui/back-link';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { authApi } from '@/lib/api/auth';
import { errorMessage } from '@/lib/api/client';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await authApi.forgot(identifier);
      setSent(res.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout title="Esqueci minha senha" description="Enviamos um link para você criar uma nova senha.">
      {sent ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4 text-sm">
            <MailCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            <p>{sent}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Cliente sem e-mail cadastrado? Fale com a Locamania pelo WhatsApp e peça um novo link de acesso.
          </p>
          <BackLink href="/login">Voltar ao login</BackLink>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="identifier">E-mail ou CPF</Label>
            <Input
              id="identifier"
              autoComplete="username"
              autoCapitalize="none"
              value={identifier}
              onChange={(e) => {
                const v = e.target.value;
                setIdentifier(!/[a-zA-Z@]/.test(v) && onlyDigits(v) ? formatCpf(v) : v);
              }}
              required
            />
          </div>
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" disabled={pending || !identifier}>
            {pending && <Spinner />}
            Enviar link
          </Button>
          <BackLink href="/login">Voltar ao login</BackLink>
        </form>
      )}
    </AuthLayout>
  );
}
