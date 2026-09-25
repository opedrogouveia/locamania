'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import { OfflineBanner } from '@/components/layout/offline-banner';
import { ConfirmProvider } from '@/components/ui/confirm-dialog';
import { Toaster } from '@/components/ui/toaster';
import { ApiError } from '@/lib/api/client';
import { ThemeProvider } from '@/lib/theme/use-theme';

/** Registra o service worker só em produção (em dev ele atrapalha o hot reload). */
function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
}

/** Providers raiz: tema, dados (TanStack Query), confirmação, toasts e aviso offline. */
export function Providers({ children }: { children: ReactNode }) {
  useServiceWorker();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            // Voltar para a aba/app atualiza (§34: "tudo deverá atualizar automaticamente").
            refetchOnWindowFocus: true,
            retry: (count, error) =>
              !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
          },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConfirmProvider>
          <OfflineBanner />
          {children}
        </ConfirmProvider>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
