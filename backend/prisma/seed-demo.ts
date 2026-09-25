import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_CHARGE_RULES,
  diffDays,
  formatBRL,
  formatCpf,
  isValidCpf,
  isValidPlate,
  MOTORCYCLE_STATUS_LABELS,
  CUSTOMER_STATUS_LABELS,
} from '@locamania/shared';
import * as argon2 from 'argon2';

import { buildAudit, buildJobsAndGateway } from './demo/audit';
import { buildCharges, numberCharges } from './demo/billing';
import { DESKTOP_USER_AGENTS } from './demo/catalog';
import { buildInspections, buildReadings, detailContracts } from './demo/contracts';
import { assignCustomers, DEMO_CUSTOMER_CPF, finalizeCustomerStatuses, flagCustomers } from './demo/customers';
import { buildDocuments, makePdfs } from './demo/documents';
import { buildAnnouncements, buildNotifications, buildSupport, buildTracking } from './demo/engagement';
import { buildFinance } from './demo/finance';
import { addCancelledContracts, buildFleet, buildTimelines, simulateKm } from './demo/fleet';
import { buildMaintenance, planStatuses } from './demo/maintenance';
import { buildOccurrences } from './demo/occurrences';
import { persist, wipeBusinessData } from './demo/persist';
import { World } from './demo/world';
import { seedReferenceData } from './reference-data';

/**
 * Seed de DEMONSTRAÇÃO — APAGA os dados de negócio e recria ~12 meses de
 * operação de uma locadora de motos para entregadores em São Paulo: frota,
 * clientes, contratos, cobranças, manutenção, ocorrências, financeiro,
 * documentos, rastreamento, notificações e histórico de auditoria.
 *
 * - Determinística (PRNG com semente fixa): rodar de novo gera os mesmos dados;
 *   as datas são relativas a "hoje" (America/Sao_Paulo), então a demo parece atual.
 * - As regras vêm do `@locamania/shared` (cronograma, multa/juros, manutenção,
 *   situação do cliente) — os números batem com o que o sistema calcula.
 * - Tudo é montado em memória e gravado com `createMany` (rápido também contra
 *   um banco remoto). NUNCA rodar em produção depois do go-live.
 *
 *   pnpm --filter @locamania/backend db:seed:demo
 */

const SEED = 20260924;
const prisma = new PrismaClient();

const STAFF = [
  { name: 'Marina Costa', email: 'proprietaria@locamania.local', role: 'OWNER', phone: '11991230001', ip: '177.92.14.23' },
  { name: 'Rafael Souza', email: 'admin@locamania.local', role: 'ADMIN', phone: '11991230002', ip: '177.92.14.23' },
  { name: 'Juliana Alves', email: 'financeiro@locamania.local', role: 'FINANCE', phone: '11991230003', ip: '177.92.14.23' },
  { name: 'Diego Martins', email: 'funcionario@locamania.local', role: 'STAFF', phone: '11991230004', ip: '177.92.14.23' },
  { name: 'Bruno Lima', email: 'bruno@locamania.local', role: 'STAFF', phone: '11991230005', ip: '189.40.77.12' },
] as const;

function createUsers(w: World): void {
  STAFF.forEach((s, i) => {
    w.users.push({
      id: w.ids.id(),
      name: s.name,
      email: s.email,
      role: s.role,
      phone: s.phone,
      ip: s.ip,
      userAgent: DESKTOP_USER_AGENTS[i % DESKTOP_USER_AGENTS.length]!,
      createdAt: w.clock.at(w.clock.rel(-380), 9, i * 7),
      lastLoginAt: null,
    });
  });
}

/** Situação final das motos: desde quando estão paradas, motivo de bloqueio/reserva. */
function finalizeMotos(w: World): void {
  for (const m of w.motos) {
    const lastEnded = m.contracts.filter((c) => c.status === 'ENDED').at(-1);
    if (m.final === 'AVAILABLE') m.availableSince = lastEnded?.endedAt ?? m.createdAt;
    if (m.final === 'BLOCKED') m.statusReason = 'Roubada — aguardando recuperação (boletim de ocorrência registrado).';
    if (m.final === 'RESERVED') {
      const draft = m.contracts.find((c) => c.status === 'DRAFT');
      m.statusReason = draft ? `Reservada para o contrato ${draft.number}.` : 'Reservada.';
    }
  }
}

/** Regras de consistência da demonstração — falha alto se algo sair do lugar. */
function checkConsistency(w: World): void {
  const errors: string[] = [];
  const { clock } = w;
  for (const m of w.motos) {
    const active = m.contracts.filter((c) => c.status === 'ACTIVE');
    const drafts = m.contracts.filter((c) => c.status === 'DRAFT');
    if ((m.final === 'RENTED') !== (active.length === 1) || active.length > 1) errors.push(`Moto ${m.plate}: ${m.final} com ${active.length} contrato(s) ativo(s)`);
    if ((m.final === 'RESERVED') !== (drafts.length === 1)) errors.push(`Moto ${m.plate}: ${m.final} com ${drafts.length} rascunho(s)`);
    const delivered = m.contracts.filter((c) => c.delivered).sort((a, b) => a.startIdx - b.startIdx);
    for (let i = 1; i < delivered.length; i++) {
      const prevEnd = delivered[i - 1]!.returnIdx ?? Number.POSITIVE_INFINITY;
      if (prevEnd > delivered[i]!.startIdx) errors.push(`Moto ${m.plate}: contratos sobrepostos (${delivered[i - 1]!.number} / ${delivered[i]!.number})`);
    }
    const maxKm = Math.max(...m.readings.map((r) => r.km));
    if (maxKm !== m.currentKm) errors.push(`Moto ${m.plate}: currentKm ${m.currentKm} ≠ maior leitura ${maxKm}`);
    if (!isValidPlate(m.plate)) errors.push(`Placa inválida ${m.plate}`);
  }
  const cpfs = new Set<string>();
  for (const c of w.customers) {
    if (c.contracts.filter((k) => k.status === 'ACTIVE').length > 1) errors.push(`Cliente ${c.name}: mais de um contrato ativo`);
    if (!isValidCpf(c.cpf) || cpfs.has(c.cpf)) errors.push(`CPF inválido/repetido ${c.cpf}`);
    cpfs.add(c.cpf);
  }
  for (const ch of w.charges) {
    if (ch.contract && ch.contract.customer !== ch.customer) errors.push(`${ch.number}: cliente diferente do contrato`);
    if (ch.status === 'PENDING' && diffDays(ch.dueDate, clock.today) > DEFAULT_CHARGE_RULES.graceDays) errors.push(`${ch.number}: pendente depois da tolerância`);
    if (ch.paidAt && ch.paidAt.getTime() > clock.now.getTime()) errors.push(`${ch.number}: pago no futuro`);
  }
  if (errors.length > 0) throw new Error(`Seed de demonstração inconsistente:\n- ${errors.slice(0, 30).join('\n- ')}`);
}

async function printSummary(w: World, startedAt: number): Promise<void> {
  const tables: [string, () => Promise<number>][] = [
    ['User', () => prisma.user.count()],
    ['Customer', () => prisma.customer.count()],
    ['Motorcycle', () => prisma.motorcycle.count()],
    ['Contract', () => prisma.contract.count()],
    ['ReturnInspection', () => prisma.returnInspection.count()],
    ['Charge', () => prisma.charge.count()],
    ['OdometerReading', () => prisma.odometerReading.count()],
    ['MaintenancePlan', () => prisma.maintenancePlan.count()],
    ['MaintenanceRecord', () => prisma.maintenanceRecord.count()],
    ['MaintenanceRecordType', () => prisma.maintenanceRecordType.count()],
    ['Occurrence', () => prisma.occurrence.count()],
    ['Document', () => prisma.document.count()],
    ['FinancialEntry', () => prisma.financialEntry.count()],
    ['TrackerPosition', () => prisma.trackerPosition.count()],
    ['TrackerCommand', () => prisma.trackerCommand.count()],
    ['GatewayEvent', () => prisma.gatewayEvent.count()],
    ['Notification', () => prisma.notification.count()],
    ['NotificationDelivery', () => prisma.notificationDelivery.count()],
    ['Announcement', () => prisma.announcement.count()],
    ['SupportMessage', () => prisma.supportMessage.count()],
    ['AuditLog', () => prisma.auditLog.count()],
    ['JobRun', () => prisma.jobRun.count()],
  ];
  console.log('\n══ Seed de demonstração concluída ══');
  console.log(`Hoje (America/Sao_Paulo): ${w.clock.today} · janela desde ${w.clock.start}`);
  console.log('\nLinhas por tabela:');
  for (const [name, count] of tables) console.log(`  ${name.padEnd(22)} ${String(await count()).padStart(6)}`);

  const motos = await prisma.motorcycle.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } });
  console.log('\nMotos por situação:');
  for (const r of motos) console.log(`  ${MOTORCYCLE_STATUS_LABELS[r.status].padEnd(16)} ${String(r._count._all).padStart(4)}`);

  const customers = await prisma.customer.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } });
  console.log('\nClientes por situação:');
  for (const r of customers) console.log(`  ${CUSTOMER_STATUS_LABELS[r.status].padEnd(20)} ${String(r._count._all).padStart(4)}`);
  const portal = await prisma.customer.count({ where: { portalEnabled: true } });
  const collection = await prisma.customer.count({ where: { inCollection: true } });
  console.log(`  (com acesso ao app: ${portal} · em cobrança: ${collection})`);

  const contracts = await prisma.contract.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } });
  console.log('\nContratos por situação:');
  for (const r of contracts) console.log(`  ${r.status.padEnd(12)} ${String(r._count._all).padStart(4)}`);

  const charges = await prisma.charge.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amount: true, paidAmount: true }, orderBy: { status: 'asc' } });
  console.log('\nCobranças por situação (valor nominal / recebido):');
  for (const r of charges) {
    const paid = r._sum.paidAmount ? ` · recebido ${formatBRL(r._sum.paidAmount.toString())}` : '';
    console.log(`  ${r.status.padEnd(10)} ${String(r._count._all).padStart(5)}  ${formatBRL(r._sum.amount?.toString() ?? '0').padStart(16)}${paid}`);
  }

  const plans = planStatuses(w);
  const motoState = new Map<string, string>();
  for (const p of plans) {
    const cur = motoState.get(p.moto.id) ?? 'OK';
    if (p.status === 'OVERDUE' || (p.status === 'DUE_SOON' && cur === 'OK')) motoState.set(p.moto.id, p.status);
  }
  const countState = (s: string) => [...motoState.values()].filter((x) => x === s).length;
  const records = await prisma.maintenanceRecord.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } });
  console.log('\nManutenção:');
  console.log(`  Motos com manutenção próxima: ${countState('DUE_SOON')} · vencida: ${countState('OVERDUE')}`);
  console.log(`  Registros: ${records.map((r) => `${r.status} ${r._count._all}`).join(' · ')}`);

  const joao = w.customers.find((c) => c.cpf === DEMO_CUSTOMER_CPF)!;
  const joaoContract = joao.contracts.find((c) => c.status === 'ACTIVE')!;
  const joaoNext = joaoContract.charges.filter((c) => c.status === 'PENDING' && c.kind === 'RENT').sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const joaoOil = plans.find((p) => p.moto === joaoContract.moto && p.code === 'OIL_CHANGE');
  console.log(`\nCliente do app: ${joao.name} (CPF ${formatCpf(joao.cpf)}) · ${joaoContract.number} · moto ${joaoContract.moto.plate}`);
  console.log(`  Próxima parcela: ${joaoNext?.number} vence ${joaoNext?.dueDate} · troca de óleo em ${joaoOil?.kmRemaining} km`);

  const password = process.env.SEED_PASSWORD ?? 'changeme123';
  console.log('\nCredenciais de demonstração (senha para todos: ' + password + '):');
  for (const s of STAFF) console.log(`  ${s.role.padEnd(8)} ${s.name.padEnd(15)} ${s.email}`);
  console.log(`  CLIENTE  ${joao.name.padEnd(15)} CPF ${joao.cpf} (app do cliente)`);
  console.log(`\nTempo total: ${((Date.now() - startedAt) / 1000).toFixed(1)} s`);
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  await seedReferenceData(prisma);
  const types = await prisma.maintenanceType.findMany({ select: { id: true, code: true } });

  const w = new World(SEED);
  w.maintenanceTypeIds = new Map(types.map((t) => [t.code, t.id]));
  w.passwordHash = await argon2.hash(process.env.SEED_PASSWORD ?? 'changeme123', { type: argon2.argon2id });

  // 1) Simulação em memória.
  createUsers(w);
  buildFleet(w);
  buildTimelines(w);
  addCancelledContracts(w);
  simulateKm(w);
  assignCustomers(w);
  flagCustomers(w);
  detailContracts(w);
  buildInspections(w);
  buildReadings(w);
  buildMaintenance(w);
  buildCharges(w);
  buildOccurrences(w);
  numberCharges(w);
  finalizeMotos(w);
  finalizeCustomerStatuses(w);
  buildFinance(w);
  buildDocuments(w, await makePdfs());
  buildTracking(w);
  const support = buildSupport(w);
  const announcements = buildAnnouncements(w);
  buildNotifications(w, support, announcements);
  buildAudit(w, support);
  buildJobsAndGateway(w);
  checkConsistency(w);
  console.log(`Simulação montada em ${((Date.now() - startedAt) / 1000).toFixed(1)} s — gravando no banco...`);

  // 2) Banco: apaga o negócio e grava tudo.
  await wipeBusinessData(prisma);
  await persist(prisma, w);
  await printSummary(w, startedAt);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
