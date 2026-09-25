'use client';

import type { ChangePasswordRequest, NotificationDto } from '@locamania/shared';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { toast } from '@/components/ui/toaster';
import { authApi } from '@/lib/api/auth';
import { downloadFile, errorMessage, openFile } from '@/lib/api/client';
import { storeLogin } from '@/lib/auth/use-auth';
import { usePortalMarkRead } from '@/lib/queries/portal';

/**
 * Complementos do app do cliente que não estão em `lib/queries/portal.ts`.
 */

/**
 * Troca de senha do cliente. A API devolve um token novo (as outras sessões
 * caem) — guardamos para o aparelho continuar logado.
 */
export function useChangeCustomerPassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) => authApi.changePasswordCustomer(body),
    onSuccess: (result) => storeLogin(result),
  });
}

/**
 * Abrir/baixar um arquivo autenticado (recibo, contrato, CRLV) com retorno de
 * erro na tela. `busy` guarda qual arquivo está carregando.
 */
export function useFileAction() {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível abrir o arquivo.'));
    } finally {
      setBusy(null);
    }
  }

  return {
    busy,
    open: (path: string, key = path) => run(key, () => openFile(path)),
    download: (path: string, fileName: string, key = `${path}:download`) => run(key, () => downloadFile(path, fileName)),
  };
}

/**
 * Tocar num aviso: marca como lido e abre o link (só links do próprio app —
 * nunca seguimos endereço de fora vindo de um aviso).
 */
export function useOpenNotification() {
  const router = useRouter();
  const markRead = usePortalMarkRead();
  return (n: NotificationDto) => {
    if (!n.readAt) markRead.mutate([n.id]);
    if (n.link && /^\/app(\/|$|\?)/.test(n.link)) router.push(n.link);
  };
}
