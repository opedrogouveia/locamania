'use client';

import { WifiOff } from 'lucide-react';

import { useOnline } from '@/lib/use-online';

/**
 * Faixa fixa "Sem conexão com a internet." (§35). Enquanto aparece, nenhuma
 * ação é enviada — o cliente de API recusa antes de tentar.
 */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-destructive px-4 py-2 pt-safe text-sm font-medium text-destructive-foreground shadow"
    >
      <WifiOff className="size-4" aria-hidden />
      Sem conexão com a internet. Nada será salvo até a conexão voltar.
    </div>
  );
}
