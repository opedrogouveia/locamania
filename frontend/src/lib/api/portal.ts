import type {
  CreateSupportMessageRequest,
  PaginatedResponse,
  PixPaymentDto,
  PortalChargeDto,
  PortalContractDto,
  PortalDocumentDto,
  PortalHomeDto,
  PortalMaintenanceDto,
  PortalMotorcycleDto,
  PortalProfileDto,
  PortalSupportInfoDto,
  NotificationDto,
  SupportMessageDto,
  UnreadCountDto,
  Ymd,
} from '@locamania/shared';

import { api, qs } from './client';

/** App do cliente — só rotas `/portal/*` (o backend lê o cliente do token). */
export const portalApi = {
  home: () => api.get<PortalHomeDto>('/portal/home'),
  charges: () => api.get<PortalChargeDto[]>('/portal/charges'),
  charge: (id: string) => api.get<PortalChargeDto>(`/portal/charges/${id}`),
  pix: (id: string) => api.post<PixPaymentDto>(`/portal/charges/${id}/pix`),
  simulatePix: (id: string) => api.post<PortalChargeDto>(`/portal/charges/${id}/pix/simulate`),
  receiptPath: (id: string) => `/portal/charges/${id}/receipt`,
  motorcycle: () =>
    api.get<{ motorcycle: PortalMotorcycleDto; maintenance: PortalMaintenanceDto | null; documents: PortalDocumentDto[] } | null>('/portal/motorcycle'),
  reportOdometer: (km: number) => api.post<PortalMotorcycleDto>('/portal/motorcycle/odometer', { km }),
  maintenance: () => api.get<{ next: PortalMaintenanceDto | null; history: { date: Ymd; types: string[] }[] }>('/portal/maintenance'),
  contract: () => api.get<PortalContractDto | null>('/portal/contract'),
  contractText: () => api.get<{ text: string; hash: string; frozen: boolean }>('/portal/contract/text'),
  contractPdfPath: () => '/portal/contract/pdf',
  acceptContract: (password: string) => api.post<PortalContractDto | null>('/portal/contract/accept', { accepted: true, password }),
  profile: () => api.get<PortalProfileDto>('/portal/profile'),
  supportInfo: () => api.get<PortalSupportInfoDto>('/portal/support/info'),
  support: () => api.get<PaginatedResponse<SupportMessageDto>>('/portal/support'),
  sendSupport: (body: CreateSupportMessageRequest) => api.post<SupportMessageDto>('/portal/support', body),
  documents: () => api.get<PortalDocumentDto[]>('/portal/documents'),
  documentPath: (id: string) => `/portal/documents/${id}/file`,
  notifications: (page = 1, unreadOnly?: boolean) =>
    api.get<PaginatedResponse<NotificationDto>>(`/portal/notifications${qs({ page, unreadOnly })}`),
  unread: () => api.get<UnreadCountDto>('/portal/notifications/unread-count'),
  read: (ids?: string[]) => api.post<void>('/portal/notifications/read', { ids }),
};
