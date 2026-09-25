import {
  customerMaintenanceMessage,
  DEFAULT_MAINTENANCE_RULES,
  diffDays,
  formatPlate,
  formatYmd,
  maintenanceDueStatus,
  OCCURRENCE_TYPE_LABELS,
  reminderMessage,
} from '@locamania/shared';
import type { NotificationSeverity, SupportMessageStatus } from '@prisma/client';

import { DEMO_CUSTOMER_CPF, hasActive, lastReturnIdx } from './customers';
import { planStatuses } from './maintenance';
import { brl, type ChargeSim, type CustomerSim, type StaffUser, type World } from './world';

/**
 * O que dá vida às telas: posições do rastreador, comandos de bloqueio,
 * mensagens de suporte, avisos e as notificações da equipe e dos clientes.
 */

const GARAGE = { lat: -23.5646, lng: -46.6527 };
const WORKSHOP = { lat: -23.5405, lng: -46.4568 };

export function buildTracking(w: World): void {
  const { rng, clock } = w;
  const now = clock.now.getTime();
  const jitter = () => rng.float(-0.0004, 0.0004);
  for (const m of w.motos) {
    if (!m.hasTracker) continue;
    const pos = (lat: number, lng: number, speed: number | null, at: Date) =>
      w.rows.positions.push({
        id: w.ids.id(),
        motorcycleId: m.id,
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        speedKmh: speed === null ? null : Number(speed.toFixed(1)),
        recordedAt: at,
      });
    if (m.final === 'BLOCKED' && m.theftIdx !== null) {
      const day = clock.ymd(m.theftIdx);
      pos(-23.6531, -46.7589, 36, clock.at(day, 20, 58));
      pos(-23.6630, -46.7612, 41, clock.at(day, 21, 9));
      pos(-23.6712, -46.7703, 0, clock.at(day, 21, 40));
      continue;
    }
    if (m.final === 'RENTED') {
      const n = rng.int(1, 3);
      const minutes = Array.from({ length: n }, () => rng.int(4, 360)).sort((a, b) => b - a);
      for (const min of minutes) {
        pos(rng.float(-23.7, -23.45), rng.float(-46.8, -46.45), rng.chance(0.35) ? 0 : rng.float(8, 60), new Date(now - min * 60_000));
      }
      continue;
    }
    const place = m.final === 'MAINTENANCE' ? WORKSHOP : GARAGE;
    for (let i = 0; i < rng.int(1, 2); i++) {
      pos(place.lat + jitter(), place.lng + jitter(), 0, new Date(now - rng.int(30, 360) * 60_000));
    }
  }

  const theftMoto = w.motos.find((m) => m.final === 'BLOCKED');
  if (theftMoto?.theftIdx != null) {
    const at = clock.at(clock.ymd(theftMoto.theftIdx), 22, 5);
    w.rows.commands.push({
      id: w.ids.id(),
      motorcycleId: theftMoto.id,
      type: 'BLOCK',
      status: 'SIMULATED',
      reason: 'Roubo informado pelo cliente (boletim de ocorrência registrado) — bloqueio preventivo.',
      requestedById: w.user('OWNER').id,
      providerResponse: 'SANDBOX: comando simulado; nenhum equipamento real foi acionado.',
      createdAt: at,
      updatedAt: at,
    });
  }
  const hist = w.blockHistory;
  if (hist) {
    const blockAt = clock.at(clock.ymd(hist.blockIdx), 10, 32);
    const unblockAt = clock.at(clock.ymd(hist.unblockIdx), 11, 14);
    w.rows.commands.push(
      {
        id: w.ids.id(),
        motorcycleId: hist.moto.id,
        type: 'BLOCK',
        status: 'SIMULATED',
        reason: hist.reason,
        requestedById: w.user('ADMIN').id,
        providerResponse: 'SANDBOX: comando simulado; bloqueio aplicado com a moto parada.',
        createdAt: blockAt,
        updatedAt: blockAt,
      },
      {
        id: w.ids.id(),
        motorcycleId: hist.moto.id,
        type: 'UNBLOCK',
        status: 'SIMULATED',
        reason: 'Pagamento regularizado pelo cliente.',
        requestedById: w.user('ADMIN').id,
        providerResponse: 'SANDBOX: comando simulado; desbloqueio aplicado.',
        createdAt: unblockAt,
        updatedAt: unblockAt,
      },
    );
  }
}

const SUPPORT: [string, string, string][] = [
  ['Pagamento em duas vezes', 'Posso pagar a semana em duas vezes? Essa semana as corridas estão fracas.', 'Oi! Desta vez pode sim: metade até o vencimento e o restante em 3 dias, sem multa. Combinado?'],
  ['Barulho no freio', 'A moto está fazendo um barulho no freio dianteiro quando eu freio forte. Posso levar na oficina amanhã?', 'Pode sim! Leve na Oficina do Zé Motos amanhã a partir das 8h, já avisamos que você vai.'],
  ['Trocar o dia do vencimento', 'Preciso trocar o dia do vencimento para sexta-feira, que é quando o app me paga.', 'Conseguimos mudar a partir da próxima semana. O valor da semana de transição fica proporcional.'],
  ['Troca de óleo', 'O app diz que a troca de óleo está chegando. Qual oficina eu levo?', 'Pode levar na Moto Center Itaquera ou na Oficina do Zé Motos, sem custo para você.'],
  ['PIX em aberto', 'Paguei pelo PIX ontem mas ainda aparece em aberto.', 'Encontramos o seu PIX e a baixa já foi feita. Obrigado!'],
  ['Pneu furado', 'Furou o pneu traseiro na Radial Leste. A Locamania cobre o conserto?', 'O reparo de furo é por conta do cliente, mas a borracharia parceira faz com desconto. Mandamos o endereço no WhatsApp.'],
  ['Renovação do contrato', 'Meu contrato termina mês que vem. Quero renovar por mais 6 meses, como faço?', ''],
  ['Segunda via do contrato', 'Preciso da segunda via do contrato para apresentar no app de entregas.', ''],
  ['Multa que não é minha', 'Chegou uma multa de uma data em que eu estava com a moto parada. Como contesto?', ''],
  ['Luz do painel acesa', 'Acendeu uma luz amarela no painel. É grave?', ''],
  ['Baú para a moto', 'Vocês têm baú para alugar junto com a moto?', 'Temos sim: o baú de 45 L sai por R$ 10 a semana. Quer que a gente inclua no seu contrato?'],
  ['Mudança de endereço', 'Mudei de endereço. Preciso enviar novo comprovante?', 'Precisa sim. Pode enviar pelo próprio aplicativo, em Documentos.'],
];

export interface SupportSim {
  customer: CustomerSim;
  subject: string;
  status: SupportMessageStatus;
  createdAt: Date;
  answeredAt: Date | null;
  answeredBy: StaffUser | null;
  id: string;
}

export function buildSupport(w: World): SupportSim[] {
  const { rng, clock } = w;
  const joao = w.customers.find((c) => c.cpf === DEMO_CUSTOMER_CPF)!;
  const pool = rng.shuffle(w.customers.filter((c) => c.portalEnabled && hasActive(c) && c !== joao));
  // Status na ordem da lista: 6 respondidas (a 1ª é do João), 4 abertas, as 2 últimas encerradas.
  const statuses: SupportMessageStatus[] = ['ANSWERED', 'ANSWERED', 'ANSWERED', 'ANSWERED', 'ANSWERED', 'ANSWERED', 'OPEN', 'OPEN', 'OPEN', 'OPEN', 'CLOSED', 'CLOSED'];
  const out: SupportSim[] = [];
  statuses.forEach((status, i) => {
    const [subject, body, answer] = SUPPORT[i]!;
    const customer = i === 0 ? joao : pool[i % pool.length]!;
    const daysAgo = status === 'OPEN' ? rng.int(0, 3) : status === 'ANSWERED' ? (i === 0 ? 5 : rng.int(2, 20)) : rng.int(25, 60);
    const createdAt = clock.past(clock.rel(-daysAgo), rng, 7, 22);
    const answered = status !== 'OPEN';
    const answeredBy = answered ? rng.pick([w.user('ADMIN'), w.user('STAFF', 0), w.user('STAFF', 1)]) : null;
    const answeredAt = answered ? clock.plusMinutes(createdAt, rng.int(20, 360)) : null;
    const id = w.ids.id();
    w.rows.support.push({
      id,
      customerId: customer.id,
      subject,
      body,
      status,
      answer: answered ? answer || 'Obrigado pela mensagem! Já resolvemos por aqui.' : null,
      answeredById: answeredBy?.id ?? null,
      answeredAt,
      createdAt,
      updatedAt: answeredAt ?? createdAt,
    });
    out.push({ customer, subject, status, createdAt, answeredAt, answeredBy, id });
  });
  return out;
}

export interface AnnouncementSim {
  title: string;
  body: string;
  createdAt: Date;
  recipients: CustomerSim[];
}

export function buildAnnouncements(w: World): AnnouncementSim[] {
  const { rng, clock } = w;
  const list: [string, string, number][] = [
    ['Horário de funcionamento no feriado', 'No próximo feriado nacional o galpão funciona das 8h às 12h. Os pagamentos pelo PIX no aplicativo continuam normais.', 3],
    ['Campanha de revisão gratuita', 'Neste mês a mão de obra da revisão preventiva é gratuita para todos os clientes com contrato ativo. Agende pelo WhatsApp.', 18],
    ['Novo canal de atendimento pelo WhatsApp', 'Agora você também fala com a Locamania pelo WhatsApp (11) 98765-4321, de segunda a sábado. O suporte pelo aplicativo continua funcionando.', 45],
  ];
  return list.map(([title, body, daysAgo]) => {
    const createdAt = clock.past(clock.rel(-daysAgo), rng, 9, 17);
    const idx = clock.todayIdx - daysAgo;
    const recipients = w.customers.filter(
      (c) =>
        c.portalEnabled &&
        c.privacyAcceptedAt !== null &&
        c.privacyAcceptedAt.getTime() <= createdAt.getTime() &&
        (hasActive(c) || lastReturnIdx(c) >= idx),
    );
    w.rows.announcements.push({ id: w.ids.id(), title, body, audience: 'ALL_ACTIVE', recipientsCount: recipients.length, createdById: w.user('OWNER').id, createdAt });
    return { title, body, createdAt, recipients };
  });
}

interface NoticeInput {
  type: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  link: string;
  entityType?: string;
  entityId?: string;
  createdAt: Date;
}

export function buildNotifications(w: World, support: SupportSim[], announcements: AnnouncementSim[]): void {
  const { rng, clock } = w;
  const T = clock.todayIdx;
  const now = clock.now.getTime();
  const tenDaysAgo = clock.at(clock.rel(-10), 0).getTime();
  const jobTime = (idx: number) => clock.clamp(clock.at(clock.ymd(idx), 8, 0, rng.int(5, 50)), rng);

  const push = (recipientType: 'USER' | 'CUSTOMER', recipientId: string, n: NoticeInput, readChance: number, email?: string | null) => {
    if (n.createdAt.getTime() > now) return;
    const read = rng.chance(readChance);
    const readAt = read ? new Date(Math.min(now, n.createdAt.getTime() + rng.int(5, 1440) * 60_000)) : null;
    const id = w.ids.id();
    w.rows.notifications.push({
      id,
      recipientType,
      recipientId,
      type: n.type,
      title: n.title,
      body: n.body,
      severity: n.severity,
      link: n.link,
      entityType: n.entityType ?? null,
      entityId: n.entityId ?? null,
      dedupeKey: null,
      readAt,
      createdAt: n.createdAt,
    });
    if (email) w.rows.deliveries.push({ id: w.ids.id(), notificationId: id, channel: 'EMAIL', status: 'SENT', detail: null, createdAt: new Date(n.createdAt.getTime() + 2000) });
  };

  // ── Equipe (proprietária e administrador; financeiro também recebe os de pagamento) ──
  const staff: NoticeInput[] = [];
  const overdue = w.charges
    .filter((ch) => ch.status === 'OVERDUE' && ch.updatedAt.getTime() >= tenDaysAgo)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 8);
  for (const ch of overdue) {
    staff.push({
      type: 'PAYMENT_OVERDUE',
      severity: 'DANGER',
      title: `Pagamento atrasado — ${ch.customer.name}`,
      body: `${ch.number} (${ch.description}) de ${brl(ch.amountCents)} venceu em ${formatYmd(ch.dueDate)} e não foi pago.`,
      link: `/admin/customers/${ch.customer.id}`,
      entityType: 'Charge',
      entityId: ch.id,
      createdAt: ch.updatedAt,
    });
  }
  for (const cu of w.customers.filter((c) => c.inCollection && c.collectionSince)) {
    const idx = clock.idx(cu.collectionSince!);
    staff.push({
      type: 'CUSTOMER_DELINQUENT',
      severity: 'DANGER',
      title: `Cliente em cobrança — ${cu.name}`,
      body: 'Atraso passou de 15 dias: cliente encaminhado para cobrança.',
      link: `/admin/customers/${cu.id}`,
      entityType: 'Customer',
      entityId: cu.id,
      createdAt: jobTime(Math.max(idx, T - 9)),
    });
  }
  const confirmed = w.charges
    .filter((ch) => ch.status === 'PAID' && ch.gatewayChargeId && ch.paidAt && ch.paidAt.getTime() >= now - 3 * 86_400_000)
    .sort((a, b) => b.paidAt!.getTime() - a.paidAt!.getTime())
    .slice(0, 6);
  for (const ch of confirmed) {
    staff.push({
      type: 'PAYMENT_CONFIRMED',
      severity: 'SUCCESS',
      title: `Pagamento recebido — ${ch.customer.name}`,
      body: `${brl(ch.paidCents ?? ch.amountCents)} via PIX (${ch.number}).`,
      link: '/admin/payments',
      entityType: 'Charge',
      entityId: ch.id,
      createdAt: new Date(ch.paidAt!.getTime() + 4000),
    });
  }
  const typeName = new Map([
    ['OIL_CHANGE', 'Troca de óleo'],
    ['SERVICE', 'Revisão'],
    ['BRAKE_PADS', 'Pastilhas de freio'],
    ['TIRES', 'Pneus'],
    ['CHAIN_KIT', 'Relação'],
    ['BELT', 'Correia'],
    ['BATTERY', 'Bateria'],
  ]);
  const statuses = planStatuses(w);
  const seenMoto = new Set<string>();
  for (const s of statuses.filter((x) => x.status !== 'OK').sort((a, b) => (a.status === 'OVERDUE' ? -1 : 1) - (b.status === 'OVERDUE' ? -1 : 1))) {
    if (seenMoto.has(s.moto.id)) continue;
    seenMoto.add(s.moto.id);
    const what = typeName.get(s.code) ?? s.code;
    const detail =
      s.kmRemaining !== null && (s.daysRemaining === null || Math.abs(s.kmRemaining) < 1000)
        ? s.kmRemaining > 0
          ? `faltam ${s.kmRemaining.toLocaleString('pt-BR')} km`
          : `passou ${(-s.kmRemaining).toLocaleString('pt-BR')} km do limite`
        : s.daysRemaining !== null && s.daysRemaining >= 0
          ? `vence em ${s.daysRemaining} dias`
          : `venceu há ${-(s.daysRemaining ?? 0)} dias`;
    const overdueNow = s.status === 'OVERDUE';
    staff.push({
      type: overdueNow ? 'MAINTENANCE_OVERDUE' : 'MAINTENANCE_DUE_SOON',
      severity: overdueNow ? 'DANGER' : 'WARNING',
      title: `${overdueNow ? 'Manutenção vencida' : 'Manutenção próxima'} — ${s.moto.spec.label} ${formatPlate(s.moto.plate)}`,
      body: `${what}: ${detail}.`,
      link: `/admin/motorcycles/${s.moto.id}`,
      entityType: 'Motorcycle',
      entityId: s.moto.id,
      createdAt: jobTime(T - rng.int(0, 4)),
    });
  }
  for (const cu of w.customers) {
    const days = diffDays(clock.today, cu.cnhExpiresAt);
    if (days >= 0 && days <= 30) {
      staff.push({ type: 'DOCUMENT_EXPIRING', severity: 'WARNING', title: `CNH vencendo — ${cu.name}`, body: `A CNH vence em ${formatYmd(cu.cnhExpiresAt)}.`, link: `/admin/customers/${cu.id}`, entityType: 'Customer', entityId: cu.id, createdAt: jobTime(T - rng.int(0, 6)) });
    } else if (days < 0 && days >= -10) {
      staff.push({ type: 'DOCUMENT_EXPIRED', severity: 'DANGER', title: `CNH vencida — ${cu.name}`, body: `A CNH venceu em ${formatYmd(cu.cnhExpiresAt)}${hasActive(cu) ? ' e o cliente está com contrato ativo' : ''}.`, link: `/admin/customers/${cu.id}`, entityType: 'Customer', entityId: cu.id, createdAt: jobTime(T + days + 1) });
    }
  }
  for (const m of w.motos) {
    if (!m.insurance) continue;
    const end = `${String(Number(m.insurance.start.slice(0, 4)) + 1)}${m.insurance.start.slice(4)}`;
    const days = diffDays(clock.today, end);
    if (days >= 0 && days <= 30) {
      staff.push({ type: 'DOCUMENT_EXPIRING', severity: 'WARNING', title: `Seguro vencendo — ${formatPlate(m.plate)}`, body: `A apólice (${m.insurance.insurer}) vence em ${formatYmd(end)}.`, link: `/admin/motorcycles/${m.id}`, entityType: 'Motorcycle', entityId: m.id, createdAt: jobTime(T - rng.int(0, 6)) });
    } else if (days < 0 && days >= -30) {
      staff.push({ type: 'DOCUMENT_EXPIRED', severity: 'DANGER', title: `Seguro vencido — ${formatPlate(m.plate)}`, body: `A apólice (${m.insurance.insurer}) venceu em ${formatYmd(end)}.`, link: `/admin/motorcycles/${m.id}`, entityType: 'Motorcycle', entityId: m.id, createdAt: jobTime(Math.max(T - 9, T + days + 1)) });
    }
  }
  for (const c of w.contracts.filter((k) => k.status === 'ACTIVE' && diffDays(clock.today, k.endDate) <= 15)) {
    staff.push({ type: 'CONTRACT_ENDING', severity: 'WARNING', title: `Contrato terminando — ${c.number}`, body: `${c.customer!.name} · termina em ${formatYmd(c.endDate)}.`, link: `/admin/contracts/${c.id}`, entityType: 'Contract', entityId: c.id, createdAt: jobTime(Math.max(T - 9, clock.idx(c.endDate) - 15)) });
  }
  for (const m of w.motos.filter((x) => x.final === 'AVAILABLE' && x.idleDays >= 7)) {
    staff.push({ type: 'MOTORCYCLE_IDLE', severity: 'WARNING', title: `Moto parada — ${m.spec.label} ${formatPlate(m.plate)}`, body: `Disponível há ${m.idleDays} dias sem contrato.`, link: `/admin/motorcycles/${m.id}`, entityType: 'Motorcycle', entityId: m.id, createdAt: jobTime(Math.max(T - 9, T - m.idleDays + 7)) });
  }
  const recentOccurrences = w.occurrences
    .filter((x) => x.createdAt.getTime() >= tenDaysAgo)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 6);
  for (const o of recentOccurrences) {
    const type = o.row.type;
    staff.push({
      type: 'OCCURRENCE_CREATED',
      severity: type === 'THEFT' ? 'DANGER' : type === 'ACCIDENT' ? 'WARNING' : 'INFO',
      title: `Nova ocorrência — ${OCCURRENCE_TYPE_LABELS[type]}${o.moto ? ` (${formatPlate(o.moto.plate)})` : ''}`,
      body: o.row.description,
      link: '/admin/occurrences',
      entityType: 'Occurrence',
      entityId: o.row.id!,
      createdAt: clock.plusMinutes(o.createdAt, 1),
    });
  }
  for (const s of support.filter((x) => x.createdAt.getTime() >= tenDaysAgo).slice(0, 5)) {
    staff.push({ type: 'SUPPORT_MESSAGE', severity: 'INFO', title: `Nova mensagem de ${s.customer.name}`, body: s.subject, link: '/admin/support', entityType: 'SupportMessage', entityId: s.id, createdAt: clock.plusMinutes(s.createdAt, 1) });
  }
  const owner = w.user('OWNER');
  const admin = w.user('ADMIN');
  const finance = w.user('FINANCE');
  for (const n of staff) {
    const old = now - n.createdAt.getTime() > 2 * 86_400_000;
    push('USER', owner.id, n, old ? 0.6 : 0.25);
    push('USER', admin.id, n, old ? 0.8 : 0.4);
    if (n.type.startsWith('PAYMENT') || n.type === 'CUSTOMER_DELINQUENT') push('USER', finance.id, n, old ? 0.8 : 0.4);
  }

  // ── Clientes com acesso ao app ──
  const statusByMoto = new Map<string, (typeof statuses)[number][]>();
  for (const s of statuses) statusByMoto.set(s.moto.id, [...(statusByMoto.get(s.moto.id) ?? []), s]);
  for (const cu of w.customers.filter((c) => c.portalEnabled)) {
    const mine = w.charges.filter((ch) => ch.customer === cu);
    const list: [NoticeInput, number][] = [];
    const paid = mine.filter((ch) => ch.status === 'PAID' && ch.kind === 'RENT').sort((a, b) => b.paidAt!.getTime() - a.paidAt!.getTime());
    for (const ch of paid.slice(0, rng.int(2, 3))) {
      list.push([{ type: 'PAYMENT_CONFIRMED', severity: 'SUCCESS', title: 'Pagamento confirmado', body: `Recebemos ${brl(ch.paidCents ?? ch.amountCents)} referente a ${ch.description.split(' — ')[0]!.toLowerCase()}. Obrigado!`, link: '/app/payments', entityType: 'Charge', entityId: ch.id, createdAt: new Date(ch.paidAt!.getTime() + 60_000) }, 0.85]);
    }
    const next: ChargeSim | undefined = mine
      .filter((ch) => ch.status === 'PENDING' && ch.kind === 'RENT' && ch.dueDate >= clock.today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    if (next) {
      const dueIdx = clock.idx(next.dueDate);
      for (const offset of [7, 3, 1, 0]) {
        if (dueIdx - offset > T || dueIdx - offset < T - 7) continue;
        list.push([{ type: offset === 0 ? 'PAYMENT_DUE_TODAY' : 'PAYMENT_REMINDER', severity: offset <= 1 ? 'WARNING' : 'INFO', title: offset === 0 ? 'Pagamento vence hoje' : 'Lembrete de pagamento', body: `${reminderMessage(offset)} Valor: ${brl(next.amountCents)}.`, link: '/app/payments', entityType: 'Charge', entityId: next.id, createdAt: jobTime(dueIdx - offset) }, offset >= 3 ? 0.7 : 0.2]);
      }
    }
    for (const ch of mine.filter((x) => x.status === 'OVERDUE').slice(-2)) {
      list.push([{ type: 'PAYMENT_OVERDUE', severity: 'DANGER', title: 'Pagamento em atraso', body: `${reminderMessage(-1)} ${ch.description.split(' — ')[0]} de ${brl(ch.amountCents)}, vencida em ${formatYmd(ch.dueDate)}.`, link: '/app/payments', entityType: 'Charge', entityId: ch.id, createdAt: ch.updatedAt }, 0.3]);
    }
    const activeContract = cu.contracts.find((k) => k.status === 'ACTIVE');
    if (activeContract) {
      const plans = statusByMoto.get(activeContract.moto.id) ?? [];
      const worst = plans.find((p) => p.status === 'OVERDUE') ?? plans.find((p) => p.status === 'DUE_SOON');
      if (worst) {
        const plan = w.rows.plans.find((p) => p.motorcycleId === activeContract.moto.id && w.maintenanceTypeIds.get(worst.code) === p.typeId);
        const nextDueDate = plan?.nextDueDate ? (plan.nextDueDate as Date).toISOString().slice(0, 10) : null;
        const due = maintenanceDueStatus(
          { nextDueKm: plan?.nextDueKm ?? null, nextDueDate },
          { currentKm: activeContract.moto.currentKm, today: clock.today, rules: DEFAULT_MAINTENANCE_RULES },
        );
        list.push([{ type: worst.status === 'OVERDUE' ? 'MAINTENANCE_OVERDUE' : 'MAINTENANCE_DUE_SOON', severity: worst.status === 'OVERDUE' ? 'DANGER' : 'WARNING', title: 'Manutenção da moto', body: customerMaintenanceMessage(due, nextDueDate), link: '/app/maintenance', entityType: 'Motorcycle', entityId: activeContract.moto.id, createdAt: jobTime(T - rng.int(0, 2)) }, 0.2]);
      }
      if (diffDays(clock.today, activeContract.endDate) <= 15) {
        list.push([{ type: 'CONTRACT_ENDING', severity: 'WARNING', title: 'Seu contrato está terminando', body: `O contrato ${activeContract.number} termina em ${formatYmd(activeContract.endDate)}. Fale com a Locamania para renovar.`, link: '/app/contract', entityType: 'Contract', entityId: activeContract.id, createdAt: jobTime(Math.max(T - 5, clock.idx(activeContract.endDate) - 15)) }, 0.5]);
      }
    }
    for (const a of announcements.filter((x) => x.recipients.includes(cu))) {
      list.push([{ type: 'ANNOUNCEMENT', severity: 'INFO', title: a.title, body: a.body, link: '/app', createdAt: new Date(a.createdAt.getTime() + 5000) }, 0.5]);
    }
    for (const s of support.filter((x) => x.customer === cu && x.answeredAt)) {
      list.push([{ type: 'SUPPORT_REPLY', severity: 'INFO', title: 'Sua mensagem foi respondida', body: `Resposta sobre "${s.subject}".`, link: '/app/support', entityType: 'SupportMessage', entityId: s.id, createdAt: new Date(s.answeredAt!.getTime() + 3000) }, 0.7]);
    }
    // O cliente do app vê as recentes como não lidas.
    const demo = cu.cpf === DEMO_CUSTOMER_CPF;
    for (const [n, readChance] of list.slice(0, 10)) {
      const recent = now - n.createdAt.getTime() < 2 * 86_400_000;
      push('CUSTOMER', cu.id, n, demo ? (recent ? 0 : 1) : readChance, cu.email);
    }
  }
}
