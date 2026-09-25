'use client';

/**
 * Hooks que as telas de Configurações e Comunicação precisam além dos de
 * `lib/queries` (contagens por situação do suporte). As chaves ficam debaixo
 * das mesmas raízes (`communication`), então as mutações de lá já invalidam.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AnnouncementDto, PaginatedResponse, SupportMessageDto, SupportMessageStatus } from '@locamania/shared';

import { api, qs } from '../api/client';
import { K } from '../queries';

const STATUSES: SupportMessageStatus[] = ['OPEN', 'ANSWERED', 'CLOSED'];

/** Quantas mensagens há em cada situação (para os filtros). */
export const useSupportCounts = (enabled = true) =>
  useQuery({
    queryKey: [...K.communication, 'support', 'counts'],
    queryFn: async () => {
      const pages = await Promise.all(
        STATUSES.map((status) => api.get<PaginatedResponse<SupportMessageDto>>(`/support${qs({ status, pageSize: 1 })}`)),
      );
      return Object.fromEntries(STATUSES.map((s, i) => [s, pages[i]!.total])) as Record<SupportMessageStatus, number>;
    },
    enabled,
    refetchInterval: 60_000,
  });

/** Outras mensagens do mesmo cliente (contexto ao responder). */
export const useCustomerSupport = (customerId: string | undefined) =>
  useQuery({
    queryKey: [...K.communication, 'support', 'customer', customerId],
    queryFn: () => api.get<PaginatedResponse<SupportMessageDto>>(`/support${qs({ customerId, pageSize: 10 })}`),
    enabled: !!customerId,
  });

/** Histórico de avisos, só buscado com permissão (sem 403 no console de quem não pode). */
export const useAnnouncementHistory = (page: number, enabled: boolean) =>
  useQuery({
    queryKey: [...K.communication, 'announcements', page],
    queryFn: () => api.get<PaginatedResponse<AnnouncementDto>>(`/announcements${qs({ page })}`),
    placeholderData: keepPreviousData,
    enabled,
  });
