/**
 * Funções HTTP por recurso. Tipadas com os contratos do shared; a query
 * string sai do `qs()` genérico. Componentes usam os hooks de `lib/<recurso>/`.
 */
import type {
  AdjustRentRequest,
  AnnouncementDto,
  AnswerSupportMessageRequest,
  AuditLogDto,
  CatalogGroup,
  CatalogItemDto,
  ChargeDto,
  ChargeOccurrenceRequest,
  ChargesSummaryDto,
  CompanySettingsDto,
  CompleteMaintenanceRequest,
  ContractDto,
  ContractListItemDto,
  CreateAnnouncementRequest,
  CreateCatalogItemRequest,
  CreateChargeRequest,
  CreateContractRequest,
  CreateCustomerRequest,
  CreateFinancialEntryRequest,
  CreateMaintenanceRecordRequest,
  CreateMotorcycleRequest,
  CreateOccurrenceRequest,
  CreateUserRequest,
  CustomerDto,
  CustomerListItemDto,
  DashboardDto,
  DelinquentCustomerDto,
  DeliverContractRequest,
  DocumentDto,
  ExpiringItemDto,
  FinanceSummaryDto,
  FinancialEntryDto,
  IntegrationStatusDto,
  JobRunDto,
  ListAuditQuery,
  ListChargesQuery,
  ListContractsQuery,
  ListCustomersQuery,
  ListDocumentsQuery,
  ListFinancialEntriesQuery,
  ListMaintenanceQuery,
  ListMotorcyclesQuery,
  ListNotificationsQuery,
  ListOccurrencesQuery,
  MaintenanceOverviewDto,
  MaintenancePlanDto,
  MaintenanceRecordDto,
  MaintenanceTypeDto,
  MotorcycleDto,
  MotorcycleHistoryItemDto,
  MotorcycleListItemDto,
  NotificationDto,
  OccurrenceDto,
  OdometerReadingDto,
  PaginatedResponse,
  ParameterDto,
  PermissionMeta,
  PortalInviteResponse,
  RegisterPaymentRequest,
  ReportKey,
  ReportTableDto,
  ReturnContractRequest,
  RolePermissionsDto,
  SendContractResponse,
  SetCustomerStatusRequest,
  SetMotorcycleStatusRequest,
  StaffRole,
  SupportMessageDto,
  TrackerCommandDto,
  TrackerCommandRequest,
  TrackerStatusDto,
  UnreadCountDto,
  UpdateCatalogItemRequest,
  UpdateCompanySettingsRequest,
  UpdateContractRequest,
  UpdateCustomerRequest,
  UpdateDocumentRequest,
  UpdateFinancialEntryRequest,
  UpdateMaintenanceRecordRequest,
  UpdateMotorcycleRequest,
  UpdateOccurrenceRequest,
  UpdateProfileRequest,
  UpdateUserRequest,
  UploadDocumentRequest,
  UpsertMaintenancePlanRequest,
  UpsertMaintenanceTypeRequest,
  UserDto,
  Ymd,
} from '@locamania/shared';

import { api, qs } from './client';

type Page<T> = PaginatedResponse<T>;

export const dashboardApi = {
  get: () => api.get<DashboardDto>('/dashboard'),
};

export const customersApi = {
  list: (q: ListCustomersQuery = {}) => api.get<Page<CustomerListItemDto>>(`/customers${qs(q)}`),
  get: (id: string) => api.get<CustomerDto>(`/customers/${id}`),
  create: (body: CreateCustomerRequest) => api.post<CustomerDto>('/customers', body),
  update: (id: string, body: UpdateCustomerRequest) => api.patch<CustomerDto>(`/customers/${id}`, body),
  setStatus: (id: string, body: SetCustomerStatusRequest) => api.post<CustomerDto>(`/customers/${id}/status`, body),
  setCollection: (id: string, inCollection: boolean) => api.post<CustomerDto>(`/customers/${id}/collection`, { inCollection }),
  invite: (id: string) => api.post<PortalInviteResponse>(`/customers/${id}/portal-invite`),
  disablePortal: (id: string) => api.post<void>(`/customers/${id}/portal-disable`),
  archive: (id: string) => api.delete<void>(`/customers/${id}`),
};

export const motorcyclesApi = {
  list: (q: ListMotorcyclesQuery = {}) => api.get<Page<MotorcycleListItemDto>>(`/motorcycles${qs(q)}`),
  get: (id: string) => api.get<MotorcycleDto>(`/motorcycles/${id}`),
  create: (body: CreateMotorcycleRequest) => api.post<MotorcycleDto>('/motorcycles', body),
  update: (id: string, body: UpdateMotorcycleRequest) => api.patch<MotorcycleDto>(`/motorcycles/${id}`, body),
  setStatus: (id: string, body: SetMotorcycleStatusRequest) => api.post<MotorcycleDto>(`/motorcycles/${id}/status`, body),
  odometer: (id: string) => api.get<OdometerReadingDto[]>(`/motorcycles/${id}/odometer`),
  addOdometer: (id: string, km: number, notes?: string | null) => api.post<MotorcycleDto>(`/motorcycles/${id}/odometer`, { km, notes }),
  history: (id: string) => api.get<MotorcycleHistoryItemDto[]>(`/motorcycles/${id}/history`),
  archive: (id: string) => api.delete<void>(`/motorcycles/${id}`),
  plans: (id: string) => api.get<MaintenancePlanDto[]>(`/motorcycles/${id}/maintenance-plans`),
  upsertPlan: (id: string, body: UpsertMaintenancePlanRequest) => api.put<MaintenancePlanDto[]>(`/motorcycles/${id}/maintenance-plans`, body),
};

export const contractsApi = {
  list: (q: ListContractsQuery = {}) => api.get<Page<ContractListItemDto>>(`/contracts${qs(q)}`),
  get: (id: string) => api.get<ContractDto>(`/contracts/${id}`),
  text: (id: string) => api.get<{ text: string; hash: string; frozen: boolean }>(`/contracts/${id}/text`),
  create: (body: CreateContractRequest) => api.post<ContractDto>('/contracts', body),
  update: (id: string, body: UpdateContractRequest) => api.patch<ContractDto>(`/contracts/${id}`, body),
  cancel: (id: string, reason: string) => api.post<ContractDto>(`/contracts/${id}/cancel`, { reason }),
  signature: (id: string, documentId?: string | null) => api.post<ContractDto>(`/contracts/${id}/signature`, { method: 'IN_PERSON', documentId }),
  send: (id: string) => api.post<SendContractResponse>(`/contracts/${id}/send`),
  deliver: (id: string, body: DeliverContractRequest) => api.post<ContractDto>(`/contracts/${id}/deliver`, body),
  adjust: (id: string, body: AdjustRentRequest) => api.post<ContractDto>(`/contracts/${id}/adjust`, body),
  extend: (id: string, endDate: Ymd) => api.post<ContractDto>(`/contracts/${id}/extend`, { endDate }),
  returnContract: (id: string, body: ReturnContractRequest) => api.post<ContractDto>(`/contracts/${id}/return`, body),
  pdfPath: (id: string) => `/contracts/${id}/pdf`,
};

export const chargesApi = {
  list: (q: ListChargesQuery = {}) => api.get<Page<ChargeDto>>(`/charges${qs(q)}`),
  summary: (q: Omit<ListChargesQuery, 'status'> = {}) => api.get<ChargesSummaryDto>(`/charges/summary${qs(q)}`),
  delinquents: () => api.get<DelinquentCustomerDto[]>('/charges/delinquents'),
  get: (id: string) => api.get<ChargeDto>(`/charges/${id}`),
  create: (body: CreateChargeRequest) => api.post<ChargeDto>('/charges', body),
  pay: (id: string, body: RegisterPaymentRequest) => api.post<ChargeDto>(`/charges/${id}/pay`, body),
  reverse: (id: string, reason: string) => api.post<ChargeDto>(`/charges/${id}/reverse`, { reason }),
  cancel: (id: string, reason: string) => api.post<ChargeDto>(`/charges/${id}/cancel`, { reason }),
  simulatePix: (id: string) => api.post<ChargeDto>(`/charges/${id}/pix/simulate`),
  receiptPath: (id: string) => `/charges/${id}/receipt`,
};

export const maintenanceApi = {
  overview: () => api.get<MaintenanceOverviewDto>('/maintenance/overview'),
  due: (tab: 'upcoming' | 'overdue', q: ListMaintenanceQuery = {}) => api.get<Page<MaintenancePlanDto>>(`/maintenance/due/${tab}${qs(q)}`),
  records: (status: 'in_progress' | 'done' | 'scheduled', q: ListMaintenanceQuery = {}) =>
    api.get<Page<MaintenanceRecordDto>>(`/maintenance/records/${status}${qs(q)}`),
  record: (id: string) => api.get<MaintenanceRecordDto>(`/maintenance/record/${id}`),
  create: (body: CreateMaintenanceRecordRequest) => api.post<MaintenanceRecordDto>('/maintenance/records', body),
  update: (id: string, body: UpdateMaintenanceRecordRequest) => api.patch<MaintenanceRecordDto>(`/maintenance/record/${id}`, body),
  complete: (id: string, body: CompleteMaintenanceRequest) => api.post<MaintenanceRecordDto>(`/maintenance/record/${id}/complete`, body),
};

export const occurrencesApi = {
  list: (q: ListOccurrencesQuery = {}) => api.get<Page<OccurrenceDto>>(`/occurrences${qs(q)}`),
  get: (id: string) => api.get<OccurrenceDto>(`/occurrences/${id}`),
  create: (body: CreateOccurrenceRequest) => api.post<OccurrenceDto>('/occurrences', body),
  update: (id: string, body: UpdateOccurrenceRequest) => api.patch<OccurrenceDto>(`/occurrences/${id}`, body),
  charge: (id: string, body: ChargeOccurrenceRequest) => api.post<OccurrenceDto>(`/occurrences/${id}/charge`, body),
  archive: (id: string) => api.delete<void>(`/occurrences/${id}`),
};

export const documentsApi = {
  list: (q: ListDocumentsQuery = {}) => api.get<Page<DocumentDto>>(`/documents${qs(q)}`),
  expiring: () => api.get<ExpiringItemDto[]>('/documents/expiring'),
  upload: (body: UploadDocumentRequest) => api.post<DocumentDto>('/documents', body),
  update: (id: string, body: UpdateDocumentRequest) => api.patch<DocumentDto>(`/documents/${id}`, body),
  archive: (id: string) => api.delete<void>(`/documents/${id}`),
  filePath: (id: string) => `/documents/${id}/file`,
};

export const financeApi = {
  summary: (from: Ymd, to: Ymd) => api.get<FinanceSummaryDto>(`/finance/summary${qs({ from, to })}`),
  entries: (q: ListFinancialEntriesQuery = {}) => api.get<Page<FinancialEntryDto>>(`/finance/entries${qs(q)}`),
  create: (body: CreateFinancialEntryRequest) => api.post<FinancialEntryDto>('/finance/entries', body),
  update: (id: string, body: UpdateFinancialEntryRequest) => api.patch<FinancialEntryDto>(`/finance/entries/${id}`, body),
  archive: (id: string) => api.delete<void>(`/finance/entries/${id}`),
};

export const reportsApi = {
  get: (key: ReportKey, from?: Ymd, to?: Ymd) => api.get<ReportTableDto>(`/reports/${key}${qs({ from, to })}`),
  pdfPath: (key: ReportKey, from?: Ymd, to?: Ymd) => `/reports/${key}/pdf${qs({ from, to })}`,
  xlsxPath: (key: ReportKey, from?: Ymd, to?: Ymd) => `/reports/${key}/xlsx${qs({ from, to })}`,
};

export const notificationsApi = {
  list: (q: ListNotificationsQuery = {}) => api.get<Page<NotificationDto>>(`/notifications${qs(q)}`),
  unread: () => api.get<UnreadCountDto>('/notifications/unread-count'),
  read: (ids?: string[]) => api.post<void>('/notifications/read', { ids }),
};

export const communicationApi = {
  announcements: (page = 1) => api.get<Page<AnnouncementDto>>(`/announcements${qs({ page })}`),
  announce: (body: CreateAnnouncementRequest) => api.post<{ recipients: number }>('/announcements', body),
  support: (q: { status?: string; page?: number } = {}) => api.get<Page<SupportMessageDto>>(`/support${qs(q)}`),
  answer: (id: string, body: AnswerSupportMessageRequest) => api.post<SupportMessageDto>(`/support/${id}/answer`, body),
  close: (id: string) => api.post<SupportMessageDto>(`/support/${id}/close`),
};

export const auditApi = {
  list: (q: ListAuditQuery = {}) => api.get<Page<AuditLogDto>>(`/audit${qs(q)}`),
  timeline: (entityType: string, entityId: string, page = 1) =>
    api.get<Page<AuditLogDto>>(`/audit/timeline/${entityType}/${entityId}${qs({ page })}`),
};

export const trackingApi = {
  list: () => api.get<TrackerStatusDto[]>('/tracking'),
  get: (motorcycleId: string) => api.get<TrackerStatusDto & { commands: TrackerCommandDto[] }>(`/tracking/${motorcycleId}`),
  command: (motorcycleId: string, body: TrackerCommandRequest) => api.post<TrackerCommandDto>(`/tracking/${motorcycleId}/commands`, body),
};

export const settingsApi = {
  company: () => api.get<CompanySettingsDto>('/settings/company'),
  updateCompany: (body: UpdateCompanySettingsRequest) => api.patch<CompanySettingsDto>('/settings/company', body),
  placeholders: () => api.get<{ key: string; description: string }[]>('/settings/contract-template/placeholders'),
  restoreTemplate: () => api.post<CompanySettingsDto>('/settings/contract-template/restore'),
  parameters: () => api.get<ParameterDto[]>('/settings/parameters'),
  updateParameter: (key: string, value: string) => api.put<ParameterDto>(`/settings/parameters/${encodeURIComponent(key)}`, { value }),
  catalog: (group: CatalogGroup, all = false) => api.get<CatalogItemDto[]>(`/settings/catalog/${group}${qs({ all: all || undefined })}`),
  createCatalog: (body: CreateCatalogItemRequest, fromForm = false) =>
    api.post<CatalogItemDto>(`/settings/catalog${qs({ from: fromForm ? 'form' : undefined })}`, body),
  updateCatalog: (id: string, body: UpdateCatalogItemRequest) => api.patch<CatalogItemDto>(`/settings/catalog/${id}`, body),
  maintenanceTypes: (all = false) => api.get<MaintenanceTypeDto[]>(`/settings/maintenance-types${qs({ all: all || undefined })}`),
  createMaintenanceType: (body: UpsertMaintenanceTypeRequest) => api.post<MaintenanceTypeDto>('/settings/maintenance-types', body),
  updateMaintenanceType: (id: string, body: Partial<UpsertMaintenanceTypeRequest>) => api.patch<MaintenanceTypeDto>(`/settings/maintenance-types/${id}`, body),
  integrations: () => api.get<IntegrationStatusDto[]>('/settings/integrations'),
  jobRuns: () => api.get<JobRunDto[]>('/jobs/runs'),
  runJobs: () => api.post<JobRunDto>('/jobs/run-now'),
};

export const usersApi = {
  list: () => api.get<UserDto[]>('/users'),
  options: () => api.get<{ id: string; name: string }[]>('/users/options'),
  create: (body: CreateUserRequest) => api.post<UserDto>('/users', body),
  update: (id: string, body: UpdateUserRequest) => api.patch<UserDto>(`/users/${id}`, body),
  setPassword: (id: string, password: string) => api.post<void>(`/users/${id}/password`, { password }),
  endSessions: (id: string) => api.post<void>(`/users/${id}/end-sessions`),
  archive: (id: string) => api.delete<void>(`/users/${id}`),
  permissionsCatalog: () => api.get<PermissionMeta[]>('/permissions/catalog'),
  permissions: () => api.get<RolePermissionsDto[]>('/permissions'),
  setPermissions: (role: StaffRole, permissions: string[]) => api.put<RolePermissionsDto>(`/permissions/${role}`, { permissions }),
  updateProfile: (body: UpdateProfileRequest) => api.patch<UserDto>('/me', body),
  endMySessions: () => api.post<void>('/me/end-sessions'),
};
