import { Injectable } from '@nestjs/common';
import {
  CONTRACT_STATUS_LABELS,
  CUSTOMER_STATUS_LABELS,
  addDays,
  diffDays,
  formatBRL,
  formatCpf,
  formatDateTime,
  formatKm,
  formatPhone,
  formatPlate,
  formatYmd,
  instantToYmd,
  MAINTENANCE_DUE_LABELS,
  maxYmd,
  minYmd,
  MOTORCYCLE_STATUS_LABELS,
  PERIODICITY_LABELS,
  Permission,
  startOfMonth,
  type CustomerListItemDto,
  type ReportKey,
  type ReportTableDto,
  type Ymd,
} from '@locamania/shared';
import ExcelJS from 'exceljs';

import { hasPermission, type StaffPrincipal } from '../../../shared/auth/principal';
import { ValidationError } from '../../../shared/errors/domain-errors';
import { PdfService } from '../../../shared/pdf/pdf.service';
import { ClockService } from '../../../shared/time/clock.service';
import { AuditService } from '../../audit/application/audit.service';
import { ChargesService } from '../../charges/application/charges.service';
import { ContractsService } from '../../contracts/application/contracts.service';
import { CustomersService } from '../../customers/application/customers.service';
import { FinanceService } from '../../finance/application/finance.service';
import { MaintenanceService } from '../../maintenance/application/maintenance.service';
import { MotorcyclesService } from '../../motorcycles/application/motorcycles.service';
import { SettingsService } from '../../settings/application/settings.service';

const TITLES: Record<ReportKey, string> = {
  fleet: 'Relatório da frota',
  customers: 'Relatório de clientes',
  finance: 'Relatório financeiro',
  maintenance: 'Relatório de manutenção',
  rentals: 'Relatório de aluguéis',
};

/**
 * Relatórios (§26). Cada um vira uma tabela única (ReportTableDto) que a tela
 * mostra e que sai igual em PDF e em Excel. Exportar fica no histórico (EXPORT).
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly clock: ClockService,
    private readonly motorcycles: MotorcyclesService,
    private readonly customers: CustomersService,
    private readonly contracts: ContractsService,
    private readonly charges: ChargesService,
    private readonly maintenance: MaintenanceService,
    private readonly finance: FinanceService,
    private readonly settings: SettingsService,
    private readonly pdf: PdfService,
    private readonly audit: AuditService,
  ) {}

  private assertAccess(key: ReportKey, actor: StaffPrincipal): void {
    if (key === 'finance' && !hasPermission(actor, Permission.FINANCE_VIEW)) {
      throw new ValidationError('Seu perfil não vê o relatório financeiro.');
    }
  }

  private period(from?: Ymd, to?: Ymd): { from: Ymd; to: Ymd } {
    const today = this.clock.today();
    const f = from ?? startOfMonth(today);
    const t = to ?? today;
    if (t < f) throw new ValidationError('O fim do período precisa ser depois do início.');
    return { from: f, to: t };
  }

  async build(key: ReportKey, actor: StaffPrincipal, from?: Ymd, to?: Ymd): Promise<ReportTableDto> {
    this.assertAccess(key, actor);
    const p = this.period(from, to);
    const base = { key, title: TITLES[key], generatedAt: new Date().toISOString() };
    const money = (v: string | null) => (hasPermission(actor, Permission.PAYMENTS_VIEW) ? formatBRL(v) : '—');

    if (key === 'fleet') {
      const { data } = await this.motorcycles.list({ pageSize: 100 });
      const byStatus = new Map<string, number>();
      for (const m of data) byStatus.set(m.status, (byStatus.get(m.status) ?? 0) + 1);
      return {
        ...base,
        subtitle: `Situação da frota em ${formatYmd(this.clock.today())}`,
        summary: [
          { label: 'Total de motos', value: String(data.length) },
          ...[...byStatus.entries()].map(([s, n]) => ({ label: MOTORCYCLE_STATUS_LABELS[s as keyof typeof MOTORCYCLE_STATUS_LABELS], value: String(n) })),
        ],
        sections: [
          {
            title: 'Motos',
            columns: [
              { key: 'plate', label: 'Placa' },
              { key: 'model', label: 'Modelo' },
              { key: 'year', label: 'Ano' },
              { key: 'status', label: 'Situação' },
              { key: 'km', label: 'Km', align: 'right' },
              { key: 'renter', label: 'Com o cliente' },
              { key: 'maintenance', label: 'Manutenção' },
            ],
            rows: data.map((m) => ({
              plate: formatPlate(m.plate),
              model: m.label,
              year: m.manufactureYear,
              status: MOTORCYCLE_STATUS_LABELS[m.status],
              km: formatKm(m.currentKm),
              renter: m.currentRental?.customerName ?? '—',
              maintenance: `${MAINTENANCE_DUE_LABELS[m.maintenanceDue]}${m.nextMaintenance ? ` · ${m.nextMaintenance.typeName}` : ''}`,
            })),
          },
        ],
      };
    }

    if (key === 'customers') {
      const all: CustomerListItemDto[] = [];
      for (let page = 1; page <= 20; page++) {
        const r = await this.customers.list({ page, pageSize: 100 }, actor);
        all.push(...r.data);
        if (page >= r.totalPages) break;
      }
      const count = (s: string) => all.filter((c) => c.status === s).length;
      return {
        ...base,
        subtitle: `Clientes em ${formatYmd(this.clock.today())}`,
        summary: [
          { label: 'Clientes', value: String(all.length) },
          { label: 'Com aluguel ativo', value: String(all.filter((c) => c.activeContractId).length) },
          { label: 'Inadimplentes', value: String(count('OVERDUE')) },
          { label: 'Bloqueados', value: String(count('BLOCKED')) },
          { label: 'Inativos', value: String(count('INACTIVE') + count('CONTRACT_ENDED')) },
        ],
        sections: [
          {
            title: 'Clientes',
            columns: [
              { key: 'name', label: 'Nome' },
              { key: 'cpf', label: 'CPF' },
              { key: 'phone', label: 'Telefone' },
              { key: 'status', label: 'Situação' },
              { key: 'moto', label: 'Moto' },
              { key: 'overdue', label: 'Em atraso', align: 'right' },
            ],
            rows: all.map((c) => ({
              name: c.name,
              cpf: formatCpf(c.cpf),
              phone: formatPhone(c.whatsapp ?? c.phone),
              status: CUSTOMER_STATUS_LABELS[c.status],
              moto: c.currentMotorcycle ? formatPlate(c.currentMotorcycle.plate) : '—',
              overdue: c.overdueCount ? money(c.overdueAmount) : '—',
            })),
          },
        ],
      };
    }

    if (key === 'finance') {
      const s = await this.finance.summary(p.from, p.to);
      const overdue = await this.charges.list({ status: 'OVERDUE', pageSize: 100 });
      return {
        ...base,
        subtitle: `${formatYmd(p.from)} a ${formatYmd(p.to)}`,
        summary: [
          { label: 'Recebido', value: formatBRL(s.received) },
          { label: 'A receber', value: formatBRL(s.pending) },
          { label: 'Em atraso (total)', value: formatBRL(s.overdue) },
          { label: 'Manutenção', value: formatBRL(s.maintenanceExpenses) },
          { label: 'Outras despesas', value: formatBRL(s.otherExpenses) },
          { label: 'Outras receitas', value: formatBRL(s.otherIncome) },
          { label: 'Resultado', value: formatBRL(s.result) },
        ],
        sections: [
          {
            title: 'Receitas e despesas no período',
            columns: [{ key: 'label', label: 'Período' }, { key: 'income', label: 'Receitas', align: 'right' }, { key: 'expense', label: 'Despesas', align: 'right' }],
            rows: s.series.map((x) => ({ label: x.label, income: formatBRL(x.income), expense: formatBRL(x.expense) })),
          },
          {
            title: 'Despesas por categoria',
            columns: [{ key: 'label', label: 'Categoria' }, { key: 'amount', label: 'Valor', align: 'right' }],
            rows: s.expensesByCategory.map((x) => ({ label: x.label, amount: formatBRL(x.amount) })),
          },
          {
            title: 'Receita por moto',
            columns: [{ key: 'plate', label: 'Placa' }, { key: 'label', label: 'Modelo' }, { key: 'income', label: 'Receita', align: 'right' }, { key: 'expense', label: 'Custo', align: 'right' }, { key: 'result', label: 'Resultado', align: 'right' }],
            rows: s.byMotorcycle.map((x) => ({ plate: formatPlate(x.plate), label: x.label, income: formatBRL(x.income), expense: formatBRL(x.expense), result: formatBRL(x.result) })),
          },
          {
            title: 'Pagamentos em atraso',
            columns: [{ key: 'number', label: 'Cobrança' }, { key: 'customer', label: 'Cliente' }, { key: 'due', label: 'Vencimento' }, { key: 'days', label: 'Dias', align: 'right' }, { key: 'amount', label: 'Valor', align: 'right' }, { key: 'total', label: 'Com encargos', align: 'right' }],
            rows: overdue.data.map((c) => ({
              number: c.number,
              customer: c.customer.label,
              due: formatYmd(c.dueDate),
              days: diffDays(c.dueDate, this.clock.today()),
              amount: formatBRL(c.amount),
              total: formatBRL(c.lateFees?.total ?? c.amount),
            })),
          },
        ],
      };
    }

    if (key === 'maintenance') {
      const done = await this.maintenance.records('done', { from: p.from, to: p.to, pageSize: 100 }, actor);
      const plans = (await this.maintenance.allPlanStatuses()).filter((x) => x.due.status !== 'OK');
      const cost = done.data.reduce((a, r) => a + Number(r.cost ?? 0), 0);
      return {
        ...base,
        subtitle: `${formatYmd(p.from)} a ${formatYmd(p.to)}`,
        summary: [
          { label: 'Realizadas', value: String(done.total) },
          { label: 'Gasto', value: hasPermission(actor, Permission.FINANCE_VIEW) ? formatBRL(cost) : '—' },
          { label: 'Próximas', value: String(plans.filter((x) => x.due.status === 'DUE_SOON').length) },
          { label: 'Vencidas', value: String(plans.filter((x) => x.due.status === 'OVERDUE').length) },
        ],
        sections: [
          {
            title: 'Manutenções realizadas',
            columns: [{ key: 'date', label: 'Data' }, { key: 'plate', label: 'Moto' }, { key: 'types', label: 'Serviços' }, { key: 'km', label: 'Km', align: 'right' }, { key: 'workshop', label: 'Oficina' }, { key: 'cost', label: 'Custo', align: 'right' }],
            rows: done.data.map((r) => ({
              date: formatYmd(r.completedAt),
              plate: formatPlate(r.motorcycle.plate),
              types: r.types.map((t) => t.name).join(', '),
              km: formatKm(r.km),
              workshop: r.workshop ?? '—',
              cost: r.cost ? formatBRL(r.cost) : '—',
            })),
          },
          {
            title: 'Manutenções futuras e vencidas',
            columns: [{ key: 'plate', label: 'Moto' }, { key: 'type', label: 'Serviço' }, { key: 'status', label: 'Situação' }, { key: 'next', label: 'Previsão' }],
            rows: plans.map((x) => ({
              plate: formatPlate(x.motorcycle.plate),
              type: x.type.name,
              status: MAINTENANCE_DUE_LABELS[x.due.status],
              next: [x.nextDueKm ? formatKm(x.nextDueKm) : null, x.nextDueDate ? formatYmd(x.nextDueDate) : null].filter(Boolean).join(' ou ') || '—',
            })),
          },
        ],
      };
    }

    // rentals
    const active = await this.contracts.list({ status: 'ACTIVE', pageSize: 100 }, actor);
    const ended = await this.contracts.list({ status: 'ENDED', pageSize: 100 }, actor);
    // Contrato encerrado termina na devolução (endedAt), não no término previsto:
    // quem devolveu antes contaria dias de aluguel que não houve (ocupação > 100%).
    // Só busca o detalhe de quem pode ter terminado dentro do período (folga de 60 dias para devolução atrasada).
    const actualEnd = new Map<string, Ymd>();
    await Promise.all(
      ended.data
        .filter((c) => c.startDate <= p.to && c.endDate >= addDays(p.from, -60))
        .map(async (c) => {
          const d = await this.contracts.get(c.id, actor);
          actualEnd.set(c.id, d.endedAt ? instantToYmd(d.endedAt, this.clock.timezone) : c.endDate);
        }),
    );
    const endOf = (c: { id: string; endDate: Ymd }): Ymd => actualEnd.get(c.id) ?? minYmd(c.endDate, addDays(p.from, -1));
    const endedInPeriod = ended.data.filter((c) => endOf(c) >= p.from && endOf(c) <= p.to);
    const usage = new Map<string, { plate: string; label: string; days: number; contracts: number }>();
    for (const c of [...active.data, ...ended.data]) {
      const start = maxYmd(c.startDate, p.from);
      const end = minYmd(c.status === 'ACTIVE' ? this.clock.today() : endOf(c), p.to);
      if (end < start) continue;
      const u = usage.get(c.motorcycle.id) ?? { plate: c.motorcycle.plate, label: c.motorcycle.label, days: 0, contracts: 0 };
      u.days += diffDays(start, end) + 1;
      u.contracts += 1;
      usage.set(c.motorcycle.id, u);
    }
    const periodDays = diffDays(p.from, p.to) + 1;
    return {
      ...base,
      subtitle: `${formatYmd(p.from)} a ${formatYmd(p.to)}`,
      summary: [
        { label: 'Contratos ativos', value: String(active.total) },
        { label: 'Encerrados no período', value: String(endedInPeriod.length) },
        { label: 'Iniciados no período', value: String([...active.data, ...ended.data].filter((c) => c.startDate >= p.from && c.startDate <= p.to).length) },
      ],
      sections: [
        {
          title: 'Contratos ativos',
          columns: [{ key: 'number', label: 'Contrato' }, { key: 'customer', label: 'Cliente' }, { key: 'plate', label: 'Moto' }, { key: 'start', label: 'Início' }, { key: 'end', label: 'Término' }, { key: 'rent', label: 'Aluguel', align: 'right' }],
          rows: active.data.map((c) => ({
            number: c.number,
            customer: c.customer.label,
            plate: formatPlate(c.motorcycle.plate),
            start: formatYmd(c.startDate),
            end: formatYmd(c.endDate),
            rent: c.rentAmount ? `${formatBRL(c.rentAmount)} ${PERIODICITY_LABELS[c.periodicity].toLowerCase()}` : '—',
          })),
        },
        {
          title: 'Contratos encerrados no período',
          columns: [{ key: 'number', label: 'Contrato' }, { key: 'customer', label: 'Cliente' }, { key: 'plate', label: 'Moto' }, { key: 'end', label: 'Término' }, { key: 'status', label: 'Situação' }],
          rows: endedInPeriod.map((c) => ({ number: c.number, customer: c.customer.label, plate: formatPlate(c.motorcycle.plate), end: formatYmd(endOf(c)), status: CONTRACT_STATUS_LABELS[c.status] })),
        },
        {
          title: 'Motos mais utilizadas',
          columns: [{ key: 'plate', label: 'Placa' }, { key: 'label', label: 'Modelo' }, { key: 'days', label: 'Dias alugada', align: 'right' }, { key: 'rate', label: 'Ocupação', align: 'right' }, { key: 'contracts', label: 'Contratos', align: 'right' }],
          rows: [...usage.values()]
            .sort((a, b) => b.days - a.days)
            .map((u) => ({ plate: formatPlate(u.plate), label: u.label, days: u.days, rate: `${Math.round((u.days / periodDays) * 100)}%`, contracts: u.contracts })),
        },
      ],
    };
  }

  async exportPdf(key: ReportKey, actor: StaffPrincipal, from?: Ymd, to?: Ymd): Promise<{ buffer: Buffer; fileName: string }> {
    const report = await this.build(key, actor, from, to);
    const company = await this.settings.company();
    const doc = this.pdf.create({ landscape: true });
    doc.header({ companyName: company.tradeName, companyLine: `Gerado em ${formatDateTime(report.generatedAt)} por ${actor.name}`, title: report.title, subtitle: report.subtitle });
    doc.keyValues(report.summary.map((s) => [s.label, s.value] as [string, string]), 4);
    for (const section of report.sections) {
      doc.heading(section.title);
      if (!section.rows.length) {
        doc.paragraph('Nenhum registro.', { muted: true });
        continue;
      }
      doc.table(section.columns.map((c) => ({ key: c.key, label: c.label, width: c.align === 'right' ? 70 : 110, align: c.align })), section.rows);
    }
    await this.audit.record({ action: 'EXPORT', entityType: 'Report', entityId: key, changes: { format: 'PDF', from, to } });
    return { buffer: await doc.finish(`${company.tradeName} · ${report.title}`), fileName: `${key}-${this.clock.today()}.pdf` };
  }

  async exportExcel(key: ReportKey, actor: StaffPrincipal, from?: Ymd, to?: Ymd): Promise<{ buffer: Buffer; fileName: string }> {
    const report = await this.build(key, actor, from, to);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Locamania';
    const summary = wb.addWorksheet('Resumo');
    summary.addRow([report.title]).font = { bold: true, size: 14 };
    summary.addRow([report.subtitle]);
    summary.addRow([]);
    for (const s of report.summary) summary.addRow([s.label, s.value]);
    summary.getColumn(1).width = 28;
    summary.getColumn(2).width = 22;
    for (const section of report.sections) {
      const ws = wb.addWorksheet(section.title.slice(0, 31).replace(/[\\/?*[\]:]/g, ''));
      ws.addRow(section.columns.map((c) => c.label)).font = { bold: true };
      for (const row of section.rows) ws.addRow(section.columns.map((c) => row[c.key] ?? ''));
      section.columns.forEach((c, i) => {
        ws.getColumn(i + 1).width = c.align === 'right' ? 16 : 26;
        if (c.align === 'right') ws.getColumn(i + 1).alignment = { horizontal: 'right' };
      });
      ws.views = [{ state: 'frozen', ySplit: 1 }];
    }
    await this.audit.record({ action: 'EXPORT', entityType: 'Report', entityId: key, changes: { format: 'XLSX', from, to } });
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return { buffer, fileName: `${key}-${this.clock.today()}.xlsx` };
  }

}
