'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Spinner } from '@/components/ui/spinner';
import { authApi } from '@/lib/api/auth';
import { errorMessage } from '@/lib/api/client';
import { ME_KEY, useCustomerActor } from '@/lib/auth/use-auth';

/**
 * LGPD: no primeiro acesso o cliente vê o aviso de privacidade e confirma que
 * leu. O aceite fica registrado (data) e auditado.
 */
export function PrivacyGate({ children }: { children: ReactNode }) {
  const customer = useCustomerActor();
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!customer || customer.privacyAccepted) return <>{children}</>;

  async function accept() {
    setPending(true);
    setError(null);
    try {
      await authApi.acceptPrivacy();
      await qc.invalidateQueries({ queryKey: ME_KEY });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="size-6 text-primary" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Bem-vindo ao app da Locamania</h1>
          <p className="text-sm text-muted-foreground">
            Aqui você acompanha seu aluguel, paga pelo PIX e recebe os avisos da sua moto. Seus dados pessoais são usados
            só para o seu contrato, a cobrança e a segurança da moto, conforme a LGPD.
          </p>
        </div>
        <Link href="/privacy" target="_blank" className="block text-sm font-medium text-primary hover:underline">
          Ler o aviso de privacidade completo
        </Link>
        <FormError message={error} />
        <Button size="lg" className="w-full" onClick={accept} disabled={pending}>
          {pending && <Spinner />}
          Li e concordo
        </Button>
      </div>
    </div>
  );
}
