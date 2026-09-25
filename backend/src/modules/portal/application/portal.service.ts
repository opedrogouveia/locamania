import { Inject, Injectable } from '@nestjs/common';
import {
  chargeDisplayStatus,
  computeLateFees,
  customerMaintenanceMessage,
  firstName,
  formatCep,
  maskCpf,
  PERIODICITY_UNIT,
  Permission,
  whatsappLink,
  type ChargeRules,
  type ContractStatus,
  type CreateSupportMessageRequest,
  type PaginatedResponse,
  type PaymentPeriodicity,
  type PixPaymentDto,
  type PortalChargeDto,
  type PortalContractDto,
  type PortalDocumentDto,
  type PortalHomeDto,
  type PortalMaintenanceDto,
  type PortalMotorcycleDto,
  type PortalProfileDto,
  type PortalSupportInfoDto,
  type SignatureStatus,
  type SupportMessageDto,
  type Ymd,
  fromCents,
  toCents,
} from '@locamania/shared';

import { CatalogLabelsService } from '../../../shared/catalog/catalog-labels.service';
import type { CustomerPrincipal } from '../../../shared/auth/principal';
import { NotFoundError, ValidationError } from '../../../shared/errors/domain-errors';
import { iso } from '../../../shared/http/mappers';
import { ParametersService } from '../../../shared/parameters/parameters.service';
import { PASSWORD_HASHER, type PasswordHasher } from '../../../shared/security/password-hasher.port';
import { ClockService } from '../../../shared/time/clock.service';
import { AUTH_ACCOUNTS, type AuthAccounts } from '../../auth/domain/auth.ports';
import { ChargesService } from '../../charges/application/charges.service';
import { CommunicationService } from '../../communication/application/communication.service';
import { ContractsService } from '../../contracts/application/contracts.service';
import { DocumentsService } from '../../documents/application/documents.service';
import { MaintenanceService } from '../../maintenance/application/maintenance.service';
import { assertOdometerForward } from '../../motorcycles/domain/motorcycle-rules';
import { MOTORCYCLES_REPOSITORY, type MotorcyclesRepository } from '../../motorcycles/domain/motorcycles.ports';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { SettingsService } from '../../settings/application/settings.service';

export const PORTAL_QUERY = Symbol('PortalQuery');

export interface PortalContractRow {
  id: string;
  number: string;
  status: ContractStatus;
  signatureStatus: SignatureStatus;
  signedAt: Date | null;
  startDate: Ymd;
  endDate: Ymd;
  periodicity: PaymentPeriodicity;
  rentAmount: string;
  depositAmount: string | null;
  motorcycle: { id: string; plate: string; brandCode: string; modelCode: string; color: string | null; manufactureYear: number | null; currentKm: number; lastKmAt: Date | null };
}

export interface PortalChargeRow {
  id: string;
  number: string;
  kind: PortalChargeDto['kind'];
  description: string;
  dueDate: Ymd;
  amount: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paidAt: Date | null;
  paidAmount: string | null;
  method: PortalChargeDto['method'];
}

export interface PortalQuery {
  currentContract(customerId: string): Promise<PortalContractRow | null>;
  charges(customerId: string): Promise<PortalChargeRow[]>;
  charge(customerId: string, chargeId: string): Promise<PortalChargeRow | null>;
  profile(customerId: string): Promise<{ name: string; cpf: string; email: string | null; phone: string | null; whatsapp: string | null; street: string | null; streetNumber: string | null; complement: string | null; district: string | null; city: string | null; state: string | null; postalCode: string | null; cnhExpiresAt: Ymd | null; status: PortalHomeDto['status'] } | null>;
  doneMaintenance(motorcycleId: string, since: Date): Promise<{ date: Ymd; types: string[] }[]>;
}

/**
 * App do cliente (§15–§17). Tudo parte do id do token: não existe rota que
 * aceite id de cliente vindo de fora (§46). As respostas são projeções
 * estreitas — sem custo interno, nota da equipe ou dado de outro cliente (§9).
 */
@Injectable()
export class PortalService {
  constructor(
    @Inject(PORTAL_QUERY) private readonly query: PortalQuery,
    @Inject(MOTORCYCLES_REPOSITORY) private readonly motorcycles: MotorcyclesRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(AUTH_ACCOUNTS) private readonly accounts: AuthAccounts,
    private readonly params: ParametersService,
    private readonly clock: ClockService,
    private readonly catalog: CatalogLabelsService,
    private readonly charges: ChargesService,
    private readonly contracts: ContractsService,
    private readonly maintenance: MaintenanceService,
    private readonly documents: DocumentsService,
    private readonly notifications: NotificationsService,
    private readonly communication: CommunicationService,
    private readonly settings: SettingsService,
  ) {}

  private async motorcycleDto(c: PortalContractRow): Promise<PortalMotorcycleDto> {
    const label = await this.catalog.resolver();
    const brand = label('MOTORCYCLE_BRAND', c.motorcycle.brandCode);
    const model = label('MOTORCYCLE_MODEL', c.motorcycle.modelCode);
    return {
      label: `${brand} ${model}`,
      brand,
      model,
      plate: c.motorcycle.plate,
      color: c.motorcycle.color,
      year: c.motorcycle.manufactureYear,
      lastKm: c.motorcycle.currentKm,
      lastKmAt: iso(c.motorcycle.lastKmAt),
    };
  }

  private chargeDto(c: PortalChargeRow, rules: ChargeRules): PortalChargeDto {
    const today = this.clock.today();
    const open = c.status === 'PENDING' || c.status === 'OVERDUE';
    return {
      id: c.id,
      number: c.number,
      kind: c.kind,
      description: c.description,
      dueDate: c.dueDate,
      amount: c.amount,
      amountDue: open ? computeLateFees({ amount: c.amount, dueDate: c.dueDate, today, rules }).total : c.amount,
      displayStatus: chargeDisplayStatus(c, today, rules),
      paidAt: iso(c.paidAt),
      paidAmount: c.paidAmount,
      method: c.method,
      hasReceipt: c.status === 'PAID',
      canPayOnline: open,
    };
  }

  private async maintenanceOf(motorcycleId: string): Promise<PortalMaintenanceDto | null> {
    const plans = (await this.maintenance.plansOf(motorcycleId)).filter((p) => p.active);
    if (!plans.length) return null;
    const rank = { OVERDUE: 0, DUE_SOON: 1, OK: 2 } as const;
    const next = [...plans].sort(
      (a, b) =>
        rank[a.due.status] - rank[b.due.status] ||
        Math.min(a.due.kmRemaining ?? 1e9, (a.due.daysRemaining ?? 1e9) * 150) - Math.min(b.due.kmRemaining ?? 1e9, (b.due.daysRemaining ?? 1e9) * 150),
    )[0]!;
    return {
      status: next.due.status,
      message: customerMaintenanceMessage(next.due, next.nextDueDate),
      nextDate: next.nextDueDate,
      kmRemaining: next.due.kmRemaining,
      typeName: next.type.name,
    };
  }

  async home(me: CustomerPrincipal): Promise<PortalHomeDto> {
    const [profile, contract, charges, rules, unread] = await Promise.all([
      this.query.profile(me.id),
      this.query.currentContract(me.id),
      this.query.charges(me.id),
      this.params.chargeRules(),
      this.notifications.unread('CUSTOMER', me.id),
    ]);
    if (!profile) throw new NotFoundError('Cadastro não encontrado.');
    const dtos = charges.map((c) => this.chargeDto(c, rules));
    const open = dtos.filter((c) => c.canPayOnline).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const overdue = open.filter((c) => c.displayStatus === 'OVERDUE');
    const active = contract && contract.status === 'ACTIVE' ? contract : null;
    const situation: Pick<PortalHomeDto, 'situationLabel' | 'situationTone'> = overdue.length
      ? { situationLabel: overdue.length === 1 ? 'Pagamento em atraso' : `${overdue.length} pagamentos em atraso`, situationTone: 'danger' }
      : active
        ? { situationLabel: 'Aluguel em dia', situationTone: 'success' }
        : contract?.status === 'DRAFT'
          ? { situationLabel: 'Contrato aguardando entrega', situationTone: 'warning' }
          : { situationLabel: 'Sem aluguel ativo', situationTone: 'muted' };
    return {
      firstName: firstName(profile.name),
      status: profile.status,
      ...situation,
      motorcycle: active ? await this.motorcycleDto(active) : null,
      rent: active
        ? { amount: active.rentAmount, periodicity: active.periodicity, unit: PERIODICITY_UNIT[active.periodicity], endDate: active.endDate }
        : null,
      nextCharge: open[0] ?? null,
      overdue: overdue.length ? { count: overdue.length, amount: fromCents(overdue.reduce((a, c) => a + toCents(c.amountDue), 0)) } : null,
      maintenance: active ? await this.maintenanceOf(active.motorcycle.id) : null,
      unreadNotifications: unread.unread,
      pendingSignature: !!contract && contract.signatureStatus === 'PENDING' && (contract.status === 'DRAFT' || contract.status === 'ACTIVE'),
    };
  }

  async chargesList(me: CustomerPrincipal): Promise<PortalChargeDto[]> {
    const rules = await this.params.chargeRules();
    return (await this.query.charges(me.id)).filter((c) => c.status !== 'CANCELLED').map((c) => this.chargeDto(c, rules));
  }

  async charge(me: CustomerPrincipal, id: string): Promise<PortalChargeDto> {
    const c = await this.query.charge(me.id, id);
    if (!c) throw new NotFoundError('Cobrança não encontrada.');
    return this.chargeDto(c, await this.params.chargeRules());
  }

  pix(me: CustomerPrincipal, id: string): Promise<PixPaymentDto> {
    return this.charges.createPix(id, me.id);
  }

  async simulatePix(me: CustomerPrincipal, id: string): Promise<PortalChargeDto> {
    await this.charges.simulatePixPayment(id, me.id);
    return this.charge(me, id);
  }

  receipt(me: CustomerPrincipal, id: string) {
    return this.charges.receiptPdf(id, me);
  }

  async motorcycle(me: CustomerPrincipal): Promise<{ motorcycle: PortalMotorcycleDto; maintenance: PortalMaintenanceDto | null; documents: PortalDocumentDto[] } | null> {
    const c = await this.query.currentContract(me.id);
    if (!c || c.status !== 'ACTIVE') return null;
    const docs = await this.documents.visibleToCustomer('MOTORCYCLE', c.motorcycle.id);
    return {
      motorcycle: await this.motorcycleDto(c),
      maintenance: await this.maintenanceOf(c.motorcycle.id),
      documents: docs.map((d) => ({ id: d.id, title: d.title, typeLabel: d.typeLabel, fileName: d.fileName, mimeType: d.mimeType, createdAt: d.createdAt })),
    };
  }

  /** Cliente informa o km (§9) — ajuda o cálculo da manutenção entre as visitas. */
  async reportOdometer(me: CustomerPrincipal, km: number): Promise<PortalMotorcycleDto> {
    const c = await this.query.currentContract(me.id);
    if (!c || c.status !== 'ACTIVE') throw new ValidationError('Você não tem moto alugada no momento.');
    assertOdometerForward(km, c.motorcycle.currentKm);
    await this.motorcycles.addOdometer(c.motorcycle.id, km, 'CUSTOMER', null, { customerId: me.id, contractId: c.id });
    await this.notifications.notifyStaff(
      {
        type: 'ODOMETER_REPORTED',
        title: `Quilometragem informada — ${c.motorcycle.plate}`,
        body: `${me.name} informou ${km.toLocaleString('pt-BR')} km.`,
        severity: 'INFO',
        link: `/admin/motorcycles/${c.motorcycle.id}?tab=odometer`,
        entityType: 'Motorcycle',
        entityId: c.motorcycle.id,
        dedupeKey: `odometer:${c.motorcycle.id}:${km}`,
      },
      Permission.MOTORCYCLES_VIEW,
    );
    const fresh = (await this.query.currentContract(me.id))!;
    return this.motorcycleDto(fresh);
  }

  async maintenanceView(me: CustomerPrincipal): Promise<{ next: PortalMaintenanceDto | null; history: { date: Ymd; types: string[] }[] }> {
    const c = await this.query.currentContract(me.id);
    if (!c || c.status !== 'ACTIVE') return { next: null, history: [] };
    return {
      next: await this.maintenanceOf(c.motorcycle.id),
      // Só o que foi feito durante o aluguel dele, sem custo nem oficina (§9).
      history: await this.query.doneMaintenance(c.motorcycle.id, new Date(`${c.startDate}T00:00:00-03:00`)),
    };
  }

  async contract(me: CustomerPrincipal): Promise<PortalContractDto | null> {
    const c = await this.query.currentContract(me.id);
    if (!c) return null;
    return {
      id: c.id,
      number: c.number,
      status: c.status,
      signatureStatus: c.signatureStatus,
      signedAt: iso(c.signedAt),
      startDate: c.startDate,
      endDate: c.endDate,
      periodicity: c.periodicity,
      rentAmount: c.rentAmount,
      depositAmount: c.depositAmount,
      motorcycle: await this.motorcycleDto(c),
      canAccept: c.signatureStatus === 'PENDING' && (c.status === 'DRAFT' || c.status === 'ACTIVE'),
    };
  }

  async contractPdf(me: CustomerPrincipal) {
    const c = await this.query.currentContract(me.id);
    if (!c) throw new NotFoundError('Você não tem contrato.');
    return this.contracts.pdf(c.id);
  }

  async contractText(me: CustomerPrincipal) {
    const c = await this.query.currentContract(me.id);
    if (!c) throw new NotFoundError('Você não tem contrato.');
    return this.contracts.text(c.id);
  }

  /** Aceite eletrônico (§10): senha conferida + data, IP, dispositivo e hash. */
  async acceptContract(me: CustomerPrincipal, password: string, ip: string | null, userAgent: string | null): Promise<PortalContractDto | null> {
    const account = await this.accounts.customerById(me.id);
    if (!account?.passwordHash || !(await this.hasher.verify(account.passwordHash, password))) {
      throw new ValidationError('Senha incorreta.');
    }
    const c = await this.query.currentContract(me.id);
    if (!c) throw new NotFoundError('Você não tem contrato para aceitar.');
    await this.contracts.acceptElectronically(c.id, me.id, ip, userAgent);
    return this.contract(me);
  }

  async profile(me: CustomerPrincipal): Promise<PortalProfileDto> {
    const p = await this.query.profile(me.id);
    if (!p) throw new NotFoundError('Cadastro não encontrado.');
    const address = [
      p.street && `${p.street}${p.streetNumber ? `, ${p.streetNumber}` : ''}`,
      p.complement,
      p.district,
      p.city && `${p.city}/${p.state ?? ''}`,
      p.postalCode && `CEP ${formatCep(p.postalCode)}`,
    ]
      .filter(Boolean)
      .join(' · ');
    return { name: p.name, cpfMasked: maskCpf(p.cpf), email: p.email, phone: p.phone, whatsapp: p.whatsapp, address: address || null, cnhExpiresAt: p.cnhExpiresAt };
  }

  async supportInfo(me: CustomerPrincipal): Promise<PortalSupportInfoDto> {
    const c = await this.settings.company();
    return {
      companyName: c.tradeName,
      phone: c.phone,
      whatsapp: c.whatsapp,
      whatsappLink: whatsappLink(c.whatsapp, `Olá! Sou ${me.name}, cliente da Locamania.`),
      email: c.email,
      supportHours: c.supportHours,
      address: [c.street && `${c.street}${c.streetNumber ? `, ${c.streetNumber}` : ''}`, c.district, c.city && `${c.city}/${c.state ?? ''}`].filter(Boolean).join(' · ') || null,
    };
  }

  supportMessages(me: CustomerPrincipal): Promise<PaginatedResponse<SupportMessageDto>> {
    return this.communication.support({ customerId: me.id, pageSize: 50 });
  }

  sendSupport(me: CustomerPrincipal, input: CreateSupportMessageRequest): Promise<SupportMessageDto> {
    return this.communication.sendSupport(me.id, input);
  }

  async documentsList(me: CustomerPrincipal): Promise<PortalDocumentDto[]> {
    const c = await this.query.currentContract(me.id);
    const lists = await Promise.all([
      this.documents.visibleToCustomer('CUSTOMER', me.id),
      c ? this.documents.visibleToCustomer('CONTRACT', c.id) : Promise.resolve([]),
      c && c.status === 'ACTIVE' ? this.documents.visibleToCustomer('MOTORCYCLE', c.motorcycle.id) : Promise.resolve([]),
    ]);
    return lists.flat().map((d) => ({ id: d.id, title: d.title, typeLabel: d.typeLabel, fileName: d.fileName, mimeType: d.mimeType, createdAt: d.createdAt }));
  }

  documentFile(me: CustomerPrincipal, id: string) {
    return this.documents.fileForCustomer(id, me.id);
  }
}
