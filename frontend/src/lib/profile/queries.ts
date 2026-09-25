'use client';

/**
 * Hooks da tela "Meu perfil": dados do próprio usuário, troca de senha e
 * "sair de todos os aparelhos". Nome e telefone usam `useUpdateProfile` de
 * `lib/queries` (invalida `['users']`, onde mora a chave daqui).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChangePasswordRequest, UserDto } from '@locamania/shared';

import { authApi } from '../api/auth';
import { api } from '../api/client';
import { usersApi } from '../api/resources';
import { storeLogin } from '../auth/use-auth';

export const PROFILE_KEY = ['users', 'me-profile'] as const;

/** GET /me — nome, e-mail, telefone, perfil e último acesso. */
export const useProfile = () => useQuery({ queryKey: PROFILE_KEY, queryFn: () => api.get<UserDto>('/me') });

/**
 * Troca a senha. A API desconecta os outros aparelhos (nova versão de sessão)
 * e devolve um token novo para este — guardado aqui para não cair no login.
 */
export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) => authApi.changePasswordStaff(body),
    onSuccess: (result) => {
      storeLogin(result);
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

/** Encerra todas as sessões do usuário — inclusive a deste aparelho. */
export const useEndMySessions = () => useMutation({ mutationFn: () => usersApi.endMySessions() });
