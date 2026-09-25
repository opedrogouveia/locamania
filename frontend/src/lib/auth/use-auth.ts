'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CustomerActor, LoginResponse, Permission, StaffActor } from '@locamania/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';

import { authApi } from '../api/auth';
import { ApiError } from '../api/client';
import { clearSession, getSession, homeFor, setSession, subscribeSession, type StoredSession } from './session';

const serverSnapshot = () => null;
let cached: { raw: string | null; value: StoredSession | null } = { raw: null, value: null };

/** Snapshot estável (mesmo objeto enquanto o localStorage não muda). */
function snapshot(): StoredSession | null {
  const raw = typeof window === 'undefined' ? null : window.localStorage.getItem('locamania_session');
  if (raw !== cached.raw) cached = { raw, value: getSession() };
  return cached.value;
}

/** Sessão reativa (login/logout em qualquer aba atualiza a tela). */
export function useSession(): StoredSession | null {
  return useSyncExternalStore(subscribeSession, snapshot, serverSnapshot);
}

export const ME_KEY = ['me'] as const;

/** Quem está logado — equipe ou cliente, conforme o token. */
export function useMe() {
  const session = useSession();
  return useQuery({
    queryKey: [...ME_KEY, session?.kind, session?.token.slice(-12)],
    queryFn: () => (session?.kind === 'customer' ? authApi.meCustomer() : authApi.meStaff()),
    enabled: !!session,
    retry: false,
    staleTime: 60_000,
  });
}

export function useStaff(): StaffActor | undefined {
  const { data } = useMe();
  return data?.kind === 'staff' ? data : undefined;
}

export function useCustomerActor(): CustomerActor | undefined {
  const { data } = useMe();
  return data?.kind === 'customer' ? data : undefined;
}

/** A tela reforça; quem decide é a API. */
export function useCan(...permissions: Permission[]): boolean {
  const staff = useStaff();
  return !!staff && permissions.every((p) => staff.permissions.includes(p));
}

export function storeLogin(result: LoginResponse): void {
  setSession({ token: result.accessToken, kind: result.actor.kind });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ identifier, password }: { identifier: string; password: string }) =>
      authApi.login(identifier, password),
    onSuccess: (result) => {
      qc.clear();
      storeLogin(result);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async () => {
      const session = getSession();
      try {
        if (session?.kind === 'customer') await authApi.logoutCustomer();
        else if (session) await authApi.logoutStaff();
      } catch {
        // Sair funciona mesmo sem rede: o token some do aparelho.
      }
    },
    onSettled: () => {
      clearSession();
      qc.clear();
      router.replace('/login');
    },
  });
}

/**
 * Guarda de área: sem sessão → login; sessão do tipo errado → a área certa.
 * Retorna `ready` quando pode renderizar.
 */
export function useAreaGuard(kind: 'staff' | 'customer'): { ready: boolean } {
  const session = useSession();
  const router = useRouter();
  const me = useMe();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!getSession()) {
      const next = `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (session && session.kind !== kind) router.replace(homeFor(session.kind));
  }, [session, kind, router]);

  // Só 401 derruba a sessão; sem internet, a tela continua com o que tem.
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) {
      clearSession();
      router.replace('/login?expired=1');
    }
  }, [me.error, router]);

  return { ready: !!session && session.kind === kind && !!me.data };
}
