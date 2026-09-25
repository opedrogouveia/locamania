'use client';

/**
 * Hooks de dados (TanStack Query) de todos os recursos. Listas aceitam
 * `enabled` (a tela espera ler os filtros da URL antes de buscar). Mutação invalida o que
 * ela muda — pagamento mexe em cobranças, cliente, contrato, dashboard e
 * financeiro (§34: "tudo deverá atualizar automaticamente").
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type {
  CatalogGroup,
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
  ReportKey,
  Ymd,
} from '@locamania/shared';

import {
  auditApi,
  chargesApi,
  communicationApi,
  contractsApi,
  customersApi,
  dashboardApi,
  documentsApi,
  financeApi,
  maintenanceApi,
  motorcyclesApi,
  notificationsApi,
  occurrencesApi,
  reportsApi,
  settingsApi,
  trackingApi,
  usersApi,
} from '../api/resources';

export const K = {
  dashboard: ['dashboard'] as const,
  customers: ['customers'] as const,
  motorcycles: ['motorcycles'] as const,
  contracts: ['contracts'] as const,
  charges: ['charges'] as const,
  maintenance: ['maintenance'] as const,
  occurrences: ['occurrences'] as const,
  documents: ['documents'] as const,
  finance: ['finance'] as const,
  reports: ['reports'] as const,
  notifications: ['notifications'] as const,
  audit: ['audit'] as const,
  settings: ['settings'] as const,
  users: ['users'] as const,
  tracking: ['tracking'] as const,
  communication: ['communication'] as const,
};

/** Invalida várias áreas de uma vez. */
export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: QueryKey[]) => Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

/** Mutação que invalida as áreas informadas ao dar certo. */
function useAction<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, keys: QueryKey[]) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidate(...keys) });
}

const MONEY_KEYS: QueryKey[] = [K.charges, K.customers, K.contracts, K.dashboard, K.finance, K.notifications];

// ───────────── Dashboard ─────────────
export const useDashboard = () => useQuery({ queryKey: K.dashboard, queryFn: dashboardApi.get, refetchInterval: 120_000 });

// ───────────── Clientes ─────────────
export const useCustomers = (q: ListCustomersQuery, enabled = true) =>
  useQuery({ queryKey: [...K.customers, 'list', q], queryFn: () => customersApi.list(q), placeholderData: keepPreviousData, enabled });
export const useCustomer = (id: string | undefined) =>
  useQuery({ queryKey: [...K.customers, 'detail', id], queryFn: () => customersApi.get(id!), enabled: !!id });
export const useCreateCustomer = () => useAction(customersApi.create, [K.customers, K.dashboard]);
export const useUpdateCustomer = (id: string) => useAction((b: Parameters<typeof customersApi.update>[1]) => customersApi.update(id, b), [K.customers]);
export const useCustomerStatus = (id: string) =>
  useAction((b: Parameters<typeof customersApi.setStatus>[1]) => customersApi.setStatus(id, b), [K.customers, K.dashboard]);
export const useCustomerCollection = (id: string) => useAction((v: boolean) => customersApi.setCollection(id, v), [K.customers, K.charges]);
export const useInviteCustomer = (id: string) => useAction(() => customersApi.invite(id), [K.customers]);
export const useDisablePortal = (id: string) => useAction(() => customersApi.disablePortal(id), [K.customers]);
// Arquivar: só listas (a ficha aberta sairia com 404 ao recarregar o que acabou de ser arquivado).
export const useArchiveCustomer = () => useAction(customersApi.archive, [[...K.customers, 'list'], ['customers', 'lookup'], K.dashboard]);

// ───────────── Motos ─────────────
export const useMotorcycles = (q: ListMotorcyclesQuery, enabled = true) =>
  useQuery({ queryKey: [...K.motorcycles, 'list', q], queryFn: () => motorcyclesApi.list(q), placeholderData: keepPreviousData, enabled });
export const useMotorcycle = (id: string | undefined) =>
  useQuery({ queryKey: [...K.motorcycles, 'detail', id], queryFn: () => motorcyclesApi.get(id!), enabled: !!id });
export const useMotorcycleOdometer = (id: string) => useQuery({ queryKey: [...K.motorcycles, 'odometer', id], queryFn: () => motorcyclesApi.odometer(id) });
export const useMotorcycleHistory = (id: string) => useQuery({ queryKey: [...K.motorcycles, 'history', id], queryFn: () => motorcyclesApi.history(id) });
export const useMotorcyclePlans = (id: string) => useQuery({ queryKey: [...K.maintenance, 'plans', id], queryFn: () => motorcyclesApi.plans(id) });
export const useCreateMotorcycle = () => useAction(motorcyclesApi.create, [K.motorcycles, K.dashboard]);
export const useUpdateMotorcycle = (id: string) => useAction((b: Parameters<typeof motorcyclesApi.update>[1]) => motorcyclesApi.update(id, b), [K.motorcycles]);
export const useMotorcycleStatus = (id: string) =>
  useAction((b: Parameters<typeof motorcyclesApi.setStatus>[1]) => motorcyclesApi.setStatus(id, b), [K.motorcycles, K.dashboard]);
export const useAddOdometer = (id: string) =>
  useAction((b: { km: number; notes?: string | null }) => motorcyclesApi.addOdometer(id, b.km, b.notes), [K.motorcycles, K.maintenance, K.dashboard]);
export const useUpsertPlan = (id: string) =>
  useAction((b: Parameters<typeof motorcyclesApi.upsertPlan>[1]) => motorcyclesApi.upsertPlan(id, b), [K.maintenance, K.motorcycles, K.dashboard]);
export const useArchiveMotorcycle = () => useAction(motorcyclesApi.archive, [[...K.motorcycles, 'list'], ['motorcycles', 'lookup'], K.dashboard]);

// ───────────── Contratos ─────────────
export const useContracts = (q: ListContractsQuery, enabled = true) =>
  useQuery({ queryKey: [...K.contracts, 'list', q], queryFn: () => contractsApi.list(q), placeholderData: keepPreviousData, enabled });
export const useContract = (id: string | undefined) =>
  useQuery({ queryKey: [...K.contracts, 'detail', id], queryFn: () => contractsApi.get(id!), enabled: !!id });
export const useContractText = (id: string, enabled: boolean) =>
  useQuery({ queryKey: [...K.contracts, 'text', id], queryFn: () => contractsApi.text(id), enabled });
const CONTRACT_KEYS: QueryKey[] = [K.contracts, K.motorcycles, K.customers, K.charges, K.dashboard];
export const useCreateContract = () => useAction(contractsApi.create, CONTRACT_KEYS);
export const useUpdateContract = (id: string) => useAction((b: Parameters<typeof contractsApi.update>[1]) => contractsApi.update(id, b), CONTRACT_KEYS);
export const useCancelContract = (id: string) => useAction((reason: string) => contractsApi.cancel(id, reason), CONTRACT_KEYS);
export const useSignContract = (id: string) => useAction((documentId?: string | null) => contractsApi.signature(id, documentId), CONTRACT_KEYS);
export const useSendContract = (id: string) => useAction(() => contractsApi.send(id), [K.contracts]);
export const useDeliverContract = (id: string) => useAction((b: Parameters<typeof contractsApi.deliver>[1]) => contractsApi.deliver(id, b), CONTRACT_KEYS);
export const useAdjustContract = (id: string) => useAction((b: Parameters<typeof contractsApi.adjust>[1]) => contractsApi.adjust(id, b), CONTRACT_KEYS);
export const useExtendContract = (id: string) => useAction((endDate: Ymd) => contractsApi.extend(id, endDate), CONTRACT_KEYS);
export const useReturnContract = (id: string) =>
  useAction((b: Parameters<typeof contractsApi.returnContract>[1]) => contractsApi.returnContract(id, b), [...CONTRACT_KEYS, K.finance, K.maintenance]);

// ───────────── Cobranças ─────────────
export const useCharges = (q: ListChargesQuery, enabled = true) =>
  useQuery({ queryKey: [...K.charges, 'list', q], queryFn: () => chargesApi.list(q), placeholderData: keepPreviousData, enabled });
export const useChargesSummary = (q: Omit<ListChargesQuery, 'status'>, enabled = true) =>
  useQuery({ queryKey: [...K.charges, 'summary', q], queryFn: () => chargesApi.summary(q), enabled });
export const useDelinquents = () => useQuery({ queryKey: [...K.charges, 'delinquents'], queryFn: chargesApi.delinquents });
export const useCharge = (id: string | undefined) => useQuery({ queryKey: [...K.charges, 'detail', id], queryFn: () => chargesApi.get(id!), enabled: !!id });
export const useCreateCharge = () => useAction(chargesApi.create, MONEY_KEYS);
export const usePayCharge = () =>
  useAction(({ id, ...b }: Parameters<typeof chargesApi.pay>[1] & { id: string }) => chargesApi.pay(id, b), MONEY_KEYS);
export const useReverseCharge = () => useAction(({ id, reason }: { id: string; reason: string }) => chargesApi.reverse(id, reason), MONEY_KEYS);
export const useCancelCharge = () => useAction(({ id, reason }: { id: string; reason: string }) => chargesApi.cancel(id, reason), MONEY_KEYS);
export const useSimulatePix = () => useAction((id: string) => chargesApi.simulatePix(id), MONEY_KEYS);

// ───────────── Manutenção ─────────────
export const useMaintenanceOverview = () => useQuery({ queryKey: [...K.maintenance, 'overview'], queryFn: maintenanceApi.overview });
export const useMaintenanceDue = (tab: 'upcoming' | 'overdue', q: ListMaintenanceQuery, enabled = true) =>
  useQuery({ queryKey: [...K.maintenance, 'due', tab, q], queryFn: () => maintenanceApi.due(tab, q), enabled, placeholderData: keepPreviousData });
export const useMaintenanceRecords = (status: 'in_progress' | 'done' | 'scheduled', q: ListMaintenanceQuery, enabled = true) =>
  useQuery({ queryKey: [...K.maintenance, 'records', status, q], queryFn: () => maintenanceApi.records(status, q), enabled, placeholderData: keepPreviousData });
const MAINT_KEYS: QueryKey[] = [K.maintenance, K.motorcycles, K.dashboard, K.finance];
export const useCreateMaintenance = () => useAction(maintenanceApi.create, MAINT_KEYS);
export const useUpdateMaintenance = () =>
  useAction(({ id, ...b }: Parameters<typeof maintenanceApi.update>[1] & { id: string }) => maintenanceApi.update(id, b), MAINT_KEYS);
export const useCompleteMaintenance = () =>
  useAction(({ id, ...b }: Parameters<typeof maintenanceApi.complete>[1] & { id: string }) => maintenanceApi.complete(id, b), MAINT_KEYS);

// ───────────── Ocorrências ─────────────
export const useOccurrences = (q: ListOccurrencesQuery, enabled = true) =>
  useQuery({ queryKey: [...K.occurrences, 'list', q], queryFn: () => occurrencesApi.list(q), placeholderData: keepPreviousData, enabled });
export const useOccurrence = (id: string | undefined) =>
  useQuery({ queryKey: [...K.occurrences, 'detail', id], queryFn: () => occurrencesApi.get(id!), enabled: !!id });
export const useCreateOccurrence = () => useAction(occurrencesApi.create, [K.occurrences, K.dashboard, K.motorcycles]);
export const useUpdateOccurrence = (id: string) => useAction((b: Parameters<typeof occurrencesApi.update>[1]) => occurrencesApi.update(id, b), [K.occurrences]);
export const useChargeOccurrence = (id: string) =>
  useAction((b: Parameters<typeof occurrencesApi.charge>[1]) => occurrencesApi.charge(id, b), [K.occurrences, ...MONEY_KEYS]);
export const useArchiveOccurrence = () => useAction(occurrencesApi.archive, [[...K.occurrences, 'list'], K.dashboard]);

// ───────────── Documentos ─────────────
export const useDocuments = (q: ListDocumentsQuery, enabled = true) =>
  useQuery({ queryKey: [...K.documents, 'list', q], queryFn: () => documentsApi.list(q), enabled });
export const useExpiring = () => useQuery({ queryKey: [...K.documents, 'expiring'], queryFn: documentsApi.expiring });
export const useUploadDocument = () => useAction(documentsApi.upload, [K.documents, K.customers, K.dashboard, K.maintenance, K.occurrences]);
export const useUpdateDocument = () =>
  useAction(({ id, ...b }: Parameters<typeof documentsApi.update>[1] & { id: string }) => documentsApi.update(id, b), [K.documents, K.customers, K.dashboard]);
export const useArchiveDocument = () => useAction(documentsApi.archive, [K.documents, K.customers, K.dashboard]);

// ───────────── Financeiro e relatórios ─────────────
export const useFinanceSummary = (from: Ymd, to: Ymd, enabled = true) =>
  useQuery({ queryKey: [...K.finance, 'summary', from, to], queryFn: () => financeApi.summary(from, to), placeholderData: keepPreviousData, enabled });
export const useFinanceEntries = (q: ListFinancialEntriesQuery, enabled = true) =>
  useQuery({ queryKey: [...K.finance, 'entries', q], queryFn: () => financeApi.entries(q), placeholderData: keepPreviousData, enabled });
export const useCreateEntry = () => useAction(financeApi.create, [K.finance, K.dashboard]);
export const useUpdateEntry = () => useAction(({ id, ...b }: Parameters<typeof financeApi.update>[1] & { id: string }) => financeApi.update(id, b), [K.finance]);
export const useArchiveEntry = () => useAction(financeApi.archive, [K.finance, K.dashboard]);
export const useReport = (key: ReportKey, from?: Ymd, to?: Ymd, enabled = true) =>
  useQuery({ queryKey: [...K.reports, key, from, to], queryFn: () => reportsApi.get(key, from, to), placeholderData: keepPreviousData, enabled });

// ───────────── Comunicação ─────────────
export const useNotifications = (q: ListNotificationsQuery, enabled = true) =>
  useQuery({ queryKey: [...K.notifications, 'list', q], queryFn: () => notificationsApi.list(q), placeholderData: keepPreviousData, refetchInterval: 60_000, enabled });
export const useMarkRead = () => useAction((ids?: string[]) => notificationsApi.read(ids), [K.notifications]);
export const useAnnouncements = (page = 1) => useQuery({ queryKey: [...K.communication, 'announcements', page], queryFn: () => communicationApi.announcements(page) });
export const useAnnounce = () => useAction(communicationApi.announce, [K.communication]);
export const useSupport = (q: { status?: string; page?: number }, enabled = true) =>
  useQuery({ queryKey: [...K.communication, 'support', q], queryFn: () => communicationApi.support(q), placeholderData: keepPreviousData, enabled });
export const useAnswerSupport = () =>
  useAction(({ id, ...b }: Parameters<typeof communicationApi.answer>[1] & { id: string }) => communicationApi.answer(id, b), [K.communication, K.notifications]);
export const useCloseSupport = () => useAction(communicationApi.close, [K.communication]);

// ───────────── Histórico ─────────────
export const useAudit = (q: ListAuditQuery, enabled = true) =>
  useQuery({ queryKey: [...K.audit, 'list', q], queryFn: () => auditApi.list(q), placeholderData: keepPreviousData, enabled });
export const useTimeline = (entityType: string, entityId: string, page = 1) =>
  useQuery({ queryKey: [...K.audit, 'timeline', entityType, entityId, page], queryFn: () => auditApi.timeline(entityType, entityId, page) });

// ───────────── Rastreamento ─────────────
export const useTrackingList = () => useQuery({ queryKey: [...K.tracking, 'list'], queryFn: trackingApi.list, refetchInterval: 60_000 });
export const useTracking = (motorcycleId: string, enabled = true) =>
  useQuery({ queryKey: [...K.tracking, 'detail', motorcycleId], queryFn: () => trackingApi.get(motorcycleId), enabled, refetchInterval: 60_000 });
export const useTrackerCommand = (motorcycleId: string) =>
  useAction((b: Parameters<typeof trackingApi.command>[1]) => trackingApi.command(motorcycleId, b), [K.tracking, K.audit]);

// ───────────── Configurações e usuários ─────────────
export const useCompany = () => useQuery({ queryKey: [...K.settings, 'company'], queryFn: settingsApi.company, staleTime: 5 * 60_000 });
export const useUpdateCompany = () => useAction(settingsApi.updateCompany, [K.settings]);
export const usePlaceholders = () => useQuery({ queryKey: [...K.settings, 'placeholders'], queryFn: settingsApi.placeholders, staleTime: Infinity });
export const useRestoreTemplate = () => useAction(() => settingsApi.restoreTemplate(), [K.settings]);
export const useParameters = () => useQuery({ queryKey: [...K.settings, 'parameters'], queryFn: settingsApi.parameters });
export const useUpdateParameter = () =>
  useAction(({ key, value }: { key: string; value: string }) => settingsApi.updateParameter(key, value), [K.settings, K.dashboard, K.charges, K.maintenance]);
export const useCatalog = (group: CatalogGroup, all = false) =>
  useQuery({ queryKey: [...K.settings, 'catalog', group, all], queryFn: () => settingsApi.catalog(group, all), staleTime: 5 * 60_000 });
export const useCreateCatalog = () =>
  useAction(({ fromForm, ...b }: Parameters<typeof settingsApi.createCatalog>[0] & { fromForm?: boolean }) => settingsApi.createCatalog(b, fromForm), [K.settings]);
export const useUpdateCatalog = () =>
  useAction(({ id, ...b }: Parameters<typeof settingsApi.updateCatalog>[1] & { id: string }) => settingsApi.updateCatalog(id, b), [K.settings]);
export const useMaintenanceTypes = (all = false) =>
  useQuery({ queryKey: [...K.settings, 'maintenance-types', all], queryFn: () => settingsApi.maintenanceTypes(all), staleTime: 5 * 60_000 });
export const useCreateMaintenanceType = () => useAction(settingsApi.createMaintenanceType, [K.settings]);
export const useUpdateMaintenanceType = () =>
  useAction(({ id, ...b }: Parameters<typeof settingsApi.updateMaintenanceType>[1] & { id: string }) => settingsApi.updateMaintenanceType(id, b), [K.settings]);
export const useIntegrations = () => useQuery({ queryKey: [...K.settings, 'integrations'], queryFn: settingsApi.integrations });
export const useJobRuns = () => useQuery({ queryKey: [...K.settings, 'jobs'], queryFn: settingsApi.jobRuns });
export const useRunJobs = () => useAction(() => settingsApi.runJobs(), [K.settings, K.dashboard, K.notifications, K.charges, K.customers]);

export const useUsers = () => useQuery({ queryKey: [...K.users, 'list'], queryFn: usersApi.list });
export const useUserOptions = () => useQuery({ queryKey: [...K.users, 'options'], queryFn: usersApi.options, staleTime: 5 * 60_000 });
export const useCreateUser = () => useAction(usersApi.create, [K.users]);
export const useUpdateUser = () => useAction(({ id, ...b }: Parameters<typeof usersApi.update>[1] & { id: string }) => usersApi.update(id, b), [K.users]);
export const useSetUserPassword = () => useAction(({ id, password }: { id: string; password: string }) => usersApi.setPassword(id, password), [K.users]);
export const useEndUserSessions = () => useAction((id: string) => usersApi.endSessions(id), [K.users]);
export const useArchiveUser = () => useAction(usersApi.archive, [K.users]);
export const usePermissionsCatalog = () => useQuery({ queryKey: [...K.users, 'perm-catalog'], queryFn: usersApi.permissionsCatalog, staleTime: Infinity });
export const usePermissions = () => useQuery({ queryKey: [...K.users, 'permissions'], queryFn: usersApi.permissions });
export const useSetPermissions = () =>
  useAction(({ role, permissions }: { role: Parameters<typeof usersApi.setPermissions>[0]; permissions: string[] }) => usersApi.setPermissions(role, permissions), [K.users, ['me']]);
export const useUpdateProfile = () => useAction(usersApi.updateProfile, [['me'], K.users]);
