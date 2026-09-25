import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import {
  addDays,
  currentReminderOffset,
  customerMaintenanceMessage,
  diffDays,
  firstName,
  formatBRL,
  formatPlate,
  formatYmd,
  ParameterKey,
  Permission,
  reminderMessage,
  type JobRunDto,
} from '@locamania/shared';

import type { AppConfig } from '../../../shared/config/configuration';
import { ParametersService } from '../../../shared/parameters/parameters.service';
import { ClockService } from '../../../shared/time/clock.service';
import { ChargesService } from '../../charges/application/charges.service';
import { CHARGES_REPOSITORY, type ChargesRepository } from '../../charges/domain/charges.ports';
import { CONTRACTS_REPOSITORY, type ContractsRepository } from '../../contracts/domain/contracts.ports';
import { CustomerStatusService } from '../../customers/application/customer-status.service';
import { CUSTOMERS_REPOSITORY, type CustomersRepository } from '../../customers/domain/customers.ports';
import { DocumentsService } from '../../documents/application/documents.service';
import { MaintenanceService } from '../../maintenance/application/maintenance.service';
import { MotorcyclesService } from '../../motorcycles/application/motorcycles.service';
import { NotificationsService } from '../../notifications/application/notifications.service';

export const JOB_RUNS = Symbol('JobRuns');

export interface JobRuns {
  running(name: string, since: Date): Promise<boolean>;
  start(name: string, trigger: string): Promise<string>;
  finish(id: string, status: 'SUCCESS' | 'FAILED', summary: Record<string, unknown>): Promise<void>;
  recent(take: number): Promise<JobRunDto[]>;
}

/**
 * Rotina diária (§14, §18, §40, §41). Cada passo é idempotente: a chave de
 * deduplicação de cada aviso impede repetir se a rotina rodar duas vezes no
 * dia (cron interno + GitHub Actions + botão "rodar agora").
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @Inject(JOB_RUNS) private readonly runs: JobRuns,
    @Inject(CHARGES_REPOSITORY) private readonly chargesRepo: ChargesRepository,
    @Inject(CUSTOMERS_REPOSITORY) private readonly customersRepo: CustomersRepository,
    @Inject(CONTRACTS_REPOSITORY) private readonly contractsRepo: ContractsRepository,
    private readonly charges: ChargesService,
    private readonly customerStatus: CustomerStatusService,
    private readonly notifications: NotificationsService,
    private readonly maintenance: MaintenanceService,
    private readonly documents: DocumentsService,
    private readonly motorcycles: MotorcyclesService,
    private readonly params: ParametersService,
    private readonly clock: ClockService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** 08:00 em São Paulo. Com o Render dormindo, o GitHub Actions cobre (POST /jobs/run). */
  @Cron('0 8 * * *', { timeZone: 'America/Sao_Paulo', name: 'daily' })
  async cron(): Promise<void> {
    if (!this.config.get('jobs', { infer: true }).cronEnabled) return;
    await this.runDaily('cron');
  }

  async runDaily(trigger: string): Promise<JobRunDto | { skipped: true; reason: string }> {
    if (await this.runs.running('daily', new Date(Date.now() - 10 * 60_000))) {
      return { skipped: true, reason: 'Já existe uma execução em andamento.' };
    }
    const id = await this.runs.start('daily', trigger);
    const summary: Record<string, unknown> = {};
    try {
      summary.overdueMarked = await this.markOverdue();
      summary.remindersSent = await this.paymentReminders();
      Object.assign(summary, await this.delinquencyEscalation());
      summary.maintenanceAlerts = await this.maintenanceAlerts();
      summary.documentAlerts = await this.documentAlerts();
      summary.contractAlerts = await this.contractEndingAlerts();
      summary.idleAlerts = await this.idleMotorcycles();
      await this.runs.finish(id, 'SUCCESS', summary);
      this.logger.log(`Rotina diária concluída: ${JSON.stringify(summary)}`);
    } catch (err) {
      summary.error = err instanceof Error ? err.message : String(err);
      await this.runs.finish(id, 'FAILED', summary);
      this.logger.error(`Rotina diária falhou: ${summary.error as string}`);
    }
    return (await this.runs.recent(1))[0]!;
  }

  recent(): Promise<JobRunDto[]> {
    return this.runs.recent(15);
  }

  /** Pendente que passou da tolerância → "Em atraso" + aviso ao cliente e à equipe (§14). */
  private async markOverdue(): Promise<number> {
    const rules = await this.params.chargeRules();
    const marked = await this.chargesRepo.markOverdue(this.clock.today(), rules.graceDays);
    for (const c of marked) {
      await this.notifications.notifyStaff(
        {
          type: 'PAYMENT_OVERDUE',
          title: `Pagamento atrasado — ${(await this.customersRepo.findById(c.customerId))?.name ?? 'cliente'}`,
          body: `${c.description} · ${formatBRL(c.amount)} · venceu em ${formatYmd(c.dueDate)}`,
          severity: 'DANGER',
          link: `/admin/customers/${c.customerId}?tab=payments`,
          entityType: 'Customer',
          entityId: c.customerId,
          dedupeKey: `charge:${c.id}:overdue`,
        },
        Permission.PAYMENTS_VIEW,
      );
    }
    await this.customerStatus.recomputeMany(marked.map((c) => c.customerId));
    return marked.length;
  }

  /** Lembretes nos marcos configurados (7, 3, 1, 0, -1, -3 dias...) — §12. */
  private async paymentReminders(): Promise<number> {
    const offsets = await this.params.reminderOffsets();
    if (!offsets.length) return 0;
    const today = this.clock.today();
    const maxBefore = Math.max(0, ...offsets);
    const maxAfter = Math.min(0, ...offsets);
    const open = await this.chargesRepo.openForReminders(addDays(today, maxAfter - 30), addDays(today, maxBefore));
    let sent = 0;
    for (const c of open) {
      const offset = currentReminderOffset(c.dueDate, today, offsets);
      if (offset === null) continue;
      const daysUntil = diffDays(today, c.dueDate);
      const text = reminderMessage(daysUntil);
      const body = `${text} ${c.description} — ${formatBRL(c.amount)}${daysUntil >= 0 ? `, vencimento ${formatYmd(c.dueDate)}` : ''}. Pague pelo PIX no app.`;
      const created = await this.notifications.notifyCustomer(
        c.customerId,
        {
          type: offset > 0 ? 'PAYMENT_REMINDER' : offset === 0 ? 'PAYMENT_DUE_TODAY' : 'PAYMENT_OVERDUE',
          title: text,
          body,
          severity: offset > 1 ? 'INFO' : offset >= 0 ? 'WARNING' : 'DANGER',
          link: '/app/payments',
          entityType: 'Charge',
          entityId: c.id,
          dedupeKey: `charge:${c.id}:remind:${offset}`,
        },
        {
          email: { subject: `${text} — Locamania`, paragraphs: [body], button: { label: 'Pagar pelo app', path: '/app/payments' } },
          whatsappText: body,
        },
      );
      if (created) sent += 1;
    }
    return sent;
  }

  /** Bloqueio administrativo e encaminhamento para cobrança após N dias (§14). */
  private async delinquencyEscalation(): Promise<{ autoBlocked: number; blockSuggested: number; sentToCollection: number }> {
    const [autoBlock, blockDays, collectionDays] = await Promise.all([
      this.params.bool(ParameterKey.AUTO_BLOCK_ENABLED),
      this.params.number(ParameterKey.BLOCK_AFTER_DAYS),
      this.params.number(ParameterKey.COLLECTION_AFTER_DAYS),
    ]);
    const result = { autoBlocked: 0, blockSuggested: 0, sentToCollection: 0 };
    for (const d of await this.charges.delinquents()) {
      const customer = await this.customersRepo.findById(d.customer.id);
      if (!customer) continue;
      if (d.daysLate >= blockDays && customer.manualStatus !== 'BLOCKED') {
        if (autoBlock) {
          await this.customersRepo.update(customer.id, {
            manualStatus: 'BLOCKED',
            blockedReason: `Bloqueio automático: ${d.daysLate} dias de atraso`,
          });
          await this.customerStatus.recompute(customer.id);
          result.autoBlocked += 1;
        }
        const created = await this.notifications.notifyStaff(
          {
            type: 'CUSTOMER_DELINQUENT',
            title: autoBlock ? `Cliente bloqueado por atraso — ${customer.name}` : `Sugestão de bloqueio — ${customer.name}`,
            body: `${d.daysLate} dias de atraso · ${formatBRL(d.totalWithFees)} com encargos${d.motorcycle ? ` · moto ${formatPlate(d.motorcycle.plate)}` : ''}`,
            severity: 'DANGER',
            link: `/admin/customers/${customer.id}`,
            entityType: 'Customer',
            entityId: customer.id,
            dedupeKey: `customer:${customer.id}:block:${d.oldestDueDate}`,
          },
          Permission.CUSTOMERS_MANAGE,
        );
        if (created && !autoBlock) result.blockSuggested += 1;
      }
      if (d.daysLate >= collectionDays && !customer.inCollection) {
        await this.customersRepo.update(customer.id, { inCollection: true, collectionSince: this.clock.today() });
        await this.notifications.notifyStaff(
          {
            type: 'CUSTOMER_DELINQUENT',
            title: `Encaminhado para cobrança — ${customer.name}`,
            body: `${d.daysLate} dias de atraso · ${formatBRL(d.totalWithFees)} com encargos`,
            severity: 'DANGER',
            link: '/admin/delinquency',
            entityType: 'Customer',
            entityId: customer.id,
            dedupeKey: `customer:${customer.id}:collection:${d.oldestDueDate}`,
          },
          Permission.PAYMENTS_VIEW,
        );
        result.sentToCollection += 1;
      }
    }
    return result;
  }

  /** Manutenção próxima/vencida: aviso à equipe e ao cliente que está com a moto (§8, §41). */
  private async maintenanceAlerts(): Promise<number> {
    let count = 0;
    for (const p of await this.maintenance.allPlanStatuses()) {
      if (p.due.status === 'OK') continue;
      const overdue = p.due.status === 'OVERDUE';
      const key = `plan:${p.id}:${p.due.status}:${p.nextDueKm ?? ''}:${p.nextDueDate ?? ''}`;
      const detail =
        p.due.trigger === 'KM' && p.due.kmRemaining !== null
          ? overdue
            ? `passou ${Math.abs(p.due.kmRemaining).toLocaleString('pt-BR')} km do limite`
            : `faltam ${p.due.kmRemaining.toLocaleString('pt-BR')} km`
          : p.nextDueDate
            ? `${overdue ? 'vencida desde' : 'prevista para'} ${formatYmd(p.nextDueDate)}`
            : '';
      const created = await this.notifications.notifyStaff(
        {
          type: overdue ? 'MAINTENANCE_OVERDUE' : 'MAINTENANCE_DUE_SOON',
          title: `${overdue ? 'Manutenção vencida' : 'Manutenção próxima'} — ${formatPlate(p.motorcycle.plate)}`,
          body: `${p.motorcycle.label} · ${p.type.name}: ${detail}`,
          severity: overdue ? 'DANGER' : 'WARNING',
          link: `/admin/motorcycles/${p.motorcycle.id}?tab=maintenance`,
          entityType: 'Motorcycle',
          entityId: p.motorcycle.id,
          dedupeKey: key,
        },
        Permission.MAINTENANCE_VIEW,
      );
      if (created) count += 1;
      if (p.renter) {
        const message = customerMaintenanceMessage(p.due, p.nextDueDate);
        await this.notifications.notifyCustomer(
          p.renter.id,
          {
            type: overdue ? 'MAINTENANCE_OVERDUE' : 'MAINTENANCE_DUE_SOON',
            title: overdue ? 'Sua moto precisa de manutenção' : 'Manutenção se aproximando',
            body: message,
            severity: overdue ? 'DANGER' : 'WARNING',
            link: '/app/maintenance',
            entityType: 'Motorcycle',
            entityId: p.motorcycle.id,
            dedupeKey: key,
          },
          {
            email: {
              subject: overdue ? 'Sua moto precisa de manutenção — Locamania' : 'Manutenção da sua moto — Locamania',
              paragraphs: [message, 'Fale com a Locamania para combinar o melhor horário.'],
              button: { label: 'Ver no app', path: '/app/maintenance' },
            },
            whatsappText: `Olá, ${firstName(p.renter.name)}! ${message}`,
          },
        );
      }
    }
    return count;
  }

  private async documentAlerts(): Promise<number> {
    let count = 0;
    for (const e of await this.documents.expiring()) {
      const expired = e.state === 'EXPIRED';
      const created = await this.notifications.notifyStaff(
        {
          type: expired ? 'DOCUMENT_EXPIRED' : 'DOCUMENT_EXPIRING',
          title: `${e.title} ${expired ? 'vencido' : 'vencendo'} — ${e.owner.label}`,
          body: `${expired ? 'Venceu em' : 'Vence em'} ${formatYmd(e.expiresAt)}${expired ? '' : ` (${e.daysRemaining} dias)`}.`,
          severity: expired ? 'DANGER' : 'WARNING',
          link: e.owner.type === 'CUSTOMER' ? `/admin/customers/${e.owner.id}?tab=documents` : e.owner.type === 'MOTORCYCLE' ? `/admin/motorcycles/${e.owner.id}?tab=documents` : '/admin/documents',
          entityType: e.owner.type === 'CUSTOMER' ? 'Customer' : e.owner.type === 'MOTORCYCLE' ? 'Motorcycle' : null,
          entityId: e.owner.id,
          dedupeKey: `doc:${e.id}:${e.state}:${e.expiresAt}`,
        },
        Permission.DOCUMENTS_VIEW,
      );
      if (created) count += 1;
    }
    return count;
  }

  private async contractEndingAlerts(): Promise<number> {
    const days = await this.params.number(ParameterKey.CONTRACT_ENDING_WARN_DAYS);
    const today = this.clock.today();
    const { items } = await this.contractsRepo.list({ skip: 0, take: 200, endingBefore: addDays(today, days) });
    let count = 0;
    for (const c of items) {
      const created = await this.notifications.notifyStaff(
        {
          type: 'CONTRACT_ENDING',
          title: `Contrato terminando — ${c.customer.name}`,
          body: `${c.number} · ${formatPlate(c.motorcycle.plate)} · término em ${formatYmd(c.endDate)}. Prorrogar ou agendar a devolução.`,
          severity: 'WARNING',
          link: `/admin/contracts/${c.id}`,
          entityType: 'Contract',
          entityId: c.id,
          dedupeKey: `contract:${c.id}:ending:${c.endDate}`,
        },
        Permission.CONTRACTS_VIEW,
      );
      await this.notifications.notifyCustomer(c.customer.id, {
        type: 'CONTRACT_ENDING',
        title: 'Seu contrato está perto do fim',
        body: `O aluguel da moto ${formatPlate(c.motorcycle.plate)} termina em ${formatYmd(c.endDate)}. Fale com a Locamania para renovar.`,
        severity: 'INFO',
        link: '/app/contract',
        entityType: 'Contract',
        entityId: c.id,
        dedupeKey: `contract:${c.id}:ending:${c.endDate}`,
      });
      if (created) count += 1;
    }
    return count;
  }

  private async idleMotorcycles(): Promise<number> {
    const idleDays = await this.params.number(ParameterKey.IDLE_MOTORCYCLE_DAYS);
    const { data } = await this.motorcycles.list({ status: 'AVAILABLE', pageSize: 100 });
    let count = 0;
    for (const m of data.filter((x) => (x.idleDays ?? 0) >= idleDays)) {
      const created = await this.notifications.notifyStaff(
        {
          type: 'MOTORCYCLE_IDLE',
          title: `Moto parada — ${formatPlate(m.plate)}`,
          body: `${m.label} disponível há ${m.idleDays} dias sem aluguel.`,
          severity: 'INFO',
          link: `/admin/motorcycles/${m.id}`,
          entityType: 'Motorcycle',
          entityId: m.id,
          dedupeKey: `moto:${m.id}:idle:${Math.floor((m.idleDays ?? 0) / idleDays)}`,
        },
        Permission.MOTORCYCLES_VIEW,
      );
      if (created) count += 1;
    }
    return count;
  }
}
