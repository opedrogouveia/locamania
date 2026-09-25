import { instantToYmd, weekday } from '@locamania/shared';
import type { ActorType, AuditAction, Prisma } from '@prisma/client';

import { money, type CustomerSim, type StaffUser, type World } from './world';
import type { SupportSim } from './engagement';

/**
 * Histórico de auditoria dos últimos 30 dias, no mesmo formato que a extensão do
 * Prisma grava (`changes.after` na criação, `changes.where/data` na alteração),
 * mais as execuções do job diário e os eventos do gateway PIX.
 */
export function buildAudit(w: World, support: SupportSim[]): void {
  const { rng, clock } = w;
  const now = clock.now.getTime();
  const from = now - 30 * 86_400_000;
  const inWindow = (d: Date | null | undefined): d is Date => !!d && d.getTime() >= from && d.getTime() <= now;
  const corr = () => `${w.ids.hex(8)}-${w.ids.hex(4)}-4${w.ids.hex(3)}-a${w.ids.hex(3)}-${w.ids.hex(12)}`;

  const log = (
    occurredAt: Date,
    action: AuditAction,
    entityType: string,
    entityId: string | null,
    actor: { type: ActorType; id?: string | null; name?: string | null; ip?: string | null; ua?: string | null },
    changes?: Record<string, unknown> | null,
  ) => {
    w.rows.audit.push({
      id: w.ids.id(),
      occurredAt,
      actorType: actor.type,
      actorId: actor.id ?? null,
      actorName: actor.name ?? (actor.type === 'SYSTEM' ? 'Sistema' : null),
      action,
      entityType,
      entityId,
      changes: (changes ?? undefined) as Prisma.InputJsonValue | undefined,
      metadata: { ip: actor.ip ?? null, userAgent: actor.ua ?? null } as Prisma.InputJsonValue,
      correlationId: corr(),
    });
  };
  const user = (u: StaffUser) => ({ type: 'USER' as const, id: u.id, name: u.name, ip: u.ip, ua: u.userAgent });
  const customer = (c: CustomerSim) => ({ type: 'CUSTOMER' as const, id: c.id, name: c.name, ip: c.ip, ua: c.userAgent });
  const system = { type: 'SYSTEM' as const };

  // Entradas da equipe (dias úteis e sábado para quem trabalha no balcão).
  for (let d = clock.todayIdx - 30; d <= clock.todayIdx; d++) {
    const ymd = clock.ymd(d);
    const wd = weekday(ymd);
    for (const u of w.users) {
      if (wd === 0) continue;
      if (wd === 6 && (u.role === 'FINANCE' || u.role === 'OWNER')) continue;
      const p = u.role === 'OWNER' ? 0.7 : 0.92;
      if (!rng.chance(p)) continue;
      const at = clock.past(ymd, rng, 7, 10);
      if (at.getTime() > now) continue;
      log(at, 'LOGIN', 'User', u.id, user(u));
      u.lastLoginAt = !u.lastLoginAt || at > u.lastLoginAt ? at : u.lastLoginAt;
      if (rng.chance(0.3)) {
        const again = clock.past(ymd, rng, 13, 15);
        if (again.getTime() <= now && again > at) {
          log(again, 'LOGIN', 'User', u.id, user(u));
          if (again > u.lastLoginAt) u.lastLoginAt = again;
        }
      }
    }
  }

  // Entradas dos clientes no app (perto dos vencimentos e ao informar a km).
  for (const c of w.customers.filter((x) => x.portalEnabled)) {
    const days = new Set<number>();
    for (const ch of w.charges) {
      if (ch.customer !== c || !inWindow(ch.paidAt) || !ch.gatewayChargeId || !rng.chance(0.6)) continue;
      days.add(clock.idx(instantToYmd(ch.paidAt)));
    }
    for (const m of w.motos) for (const r of m.readings) if (r.source === 'CUSTOMER' && r.customerId === c.id && inWindow(r.readAt) && rng.chance(0.5)) days.add(r.idx);
    if (c.contracts.some((k) => k.status === 'ACTIVE')) days.add(clock.todayIdx - rng.int(0, 29));
    for (const idx of [...days].sort((a, b) => a - b)) {
      const at = clock.past(clock.ymd(idx), rng, 7, 22);
      if (!inWindow(at)) continue;
      log(at, 'LOGIN', 'Customer', c.id, customer(c));
      if (!c.portalLastLoginAt || at > c.portalLastLoginAt) c.portalLastLoginAt = at;
    }
    if (!c.portalLastLoginAt && c.privacyAcceptedAt) c.portalLastLoginAt = c.privacyAcceptedAt;
  }

  // Cadastros de clientes.
  for (const c of w.customers.filter((x) => inWindow(x.createdAt))) {
    log(c.createdAt, 'CREATE', 'Customer', c.id, user(w.clerk()), { after: { id: c.id, number: c.number, name: c.name, phone: c.phone, city: c.city, status: 'ACTIVE' } });
  }

  // Contratos: criação, entrega (ativação), encerramento, cancelamento e reajuste.
  for (const c of w.contracts) {
    const by = user(c.createdBy);
    if (inWindow(c.createdAt)) {
      log(c.createdAt, 'CREATE', 'Contract', c.id, by, {
        after: {
          id: c.id,
          number: c.number,
          status: 'DRAFT',
          customerId: c.customer!.id,
          motorcycleId: c.moto.id,
          periodicity: c.periodicity,
          rentAmount: money(c.reajuste?.oldCents ?? c.rentCents),
          startDate: c.startDate,
          endDate: c.endDate,
        },
      });
    }
    if (inWindow(c.deliveredAt)) {
      log(c.deliveredAt, 'STATUS_CHANGE', 'Contract', c.id, by, { where: { id: c.id }, data: { status: 'ACTIVE', deliveredAt: c.deliveredAt.toISOString(), initialKm: c.moto.cum[c.startIdx] } });
      log(c.deliveredAt, 'STATUS_CHANGE', 'Motorcycle', c.moto.id, by, { where: { id: c.moto.id }, data: { status: 'RENTED', availableSince: null } });
    }
    if (inWindow(c.endedAt) && c.inspection) {
      const insp = user(c.inspection.createdBy);
      log(c.endedAt, 'CREATE', 'ReturnInspection', c.inspection.id, insp, { after: { id: c.inspection.id, contractId: c.id, finalKm: c.inspection.finalKm, condition: c.inspection.condition, depositOutcome: c.inspection.depositOutcome } });
      log(c.endedAt, 'STATUS_CHANGE', 'Contract', c.id, insp, { where: { id: c.id }, data: { status: 'ENDED', endedAt: c.endedAt.toISOString() } });
      log(c.endedAt, 'STATUS_CHANGE', 'Motorcycle', c.moto.id, insp, { where: { id: c.moto.id }, data: { status: c.inspection.nextMotorcycleStatus, currentKm: c.inspection.finalKm } });
    }
    if (inWindow(c.cancelledAt)) {
      log(c.cancelledAt, 'STATUS_CHANGE', 'Contract', c.id, by, { where: { id: c.id }, data: { status: 'CANCELLED', cancelReason: c.cancelReason } });
    }
    if (c.reajuste && inWindow(c.reajuste.at)) {
      log(c.reajuste.at, 'UPDATE', 'Contract', c.id, user(c.reajuste.by), { where: { id: c.id }, data: { rentAmount: money(c.reajuste.newCents) } });
    }
  }

  // Cobranças: pagamento registrado (equipe ou webhook do PIX) e atraso marcado pelo job.
  for (const ch of w.charges) {
    if (ch.status === 'PAID' && inWindow(ch.paidAt)) {
      const actor = ch.registeredBy ? user(ch.registeredBy) : system;
      log(ch.paidAt, 'STATUS_CHANGE', 'Charge', ch.id, actor, {
        where: { id: ch.id },
        data: { status: 'PAID', paidAt: ch.paidAt.toISOString(), paidAmount: money(ch.paidCents ?? ch.amountCents), method: ch.method },
      });
    }
    if (ch.status === 'OVERDUE' && inWindow(ch.updatedAt)) {
      log(ch.updatedAt, 'STATUS_CHANGE', 'Charge', ch.id, system, { where: { id: ch.id }, data: { status: 'OVERDUE' } });
    }
    if (ch.kind !== 'RENT' && ch.kind !== 'DEPOSIT' && inWindow(ch.createdAt)) {
      log(ch.createdAt, 'CREATE', 'Charge', ch.id, user(w.cashier()), { after: { id: ch.id, number: ch.number, kind: ch.kind, amount: money(ch.amountCents), dueDate: ch.dueDate } });
    }
  }

  // Quilometragem informada (equipe ou cliente) atualiza a moto.
  for (const m of w.motos) {
    for (const r of m.readings) {
      if (!inWindow(r.readAt) || (r.source !== 'MANUAL' && r.source !== 'CUSTOMER')) continue;
      const actor = r.source === 'CUSTOMER' ? customer(w.customers.find((c) => c.id === r.customerId)!) : user(w.users.find((u) => u.id === r.userId) ?? w.user('ADMIN'));
      log(r.readAt, 'UPDATE', 'Motorcycle', m.id, actor, { where: { id: m.id }, data: { currentKm: r.km } });
    }
  }

  // Manutenções: abertura e conclusão.
  for (const rec of w.maintenance) {
    const by = user(rec.createdBy);
    if (inWindow(rec.createdAt)) {
      log(rec.createdAt, 'CREATE', 'MaintenanceRecord', rec.id, by, { after: { id: rec.id, motorcycleId: rec.moto.id, status: rec.status === 'SCHEDULED' ? 'SCHEDULED' : 'IN_PROGRESS', scheduledFor: rec.scheduledFor, workshop: rec.workshop } });
    }
    if (rec.status === 'DONE' && inWindow(rec.updatedAt)) {
      log(rec.updatedAt, 'STATUS_CHANGE', 'MaintenanceRecord', rec.id, by, { where: { id: rec.id }, data: { status: 'DONE', completedAt: rec.completedAt, km: rec.km, cost: rec.costCents === null ? null : money(rec.costCents) } });
    }
  }

  // Ocorrências, comandos do rastreador, respostas de suporte e exportações.
  for (const o of w.occurrences.filter((x) => inWindow(x.createdAt))) {
    log(o.createdAt, 'CREATE', 'Occurrence', o.row.id!, user(w.users.find((u) => u.id === o.row.createdById) ?? w.clerk()), { after: { id: o.row.id, type: o.row.type, status: o.row.status, motorcycleId: o.row.motorcycleId, amount: o.row.amount } });
  }
  for (const cmd of w.rows.commands) {
    const at = cmd.createdAt as Date;
    if (!inWindow(at)) continue;
    log(at, 'COMMAND', 'Motorcycle', cmd.motorcycleId, user(w.users.find((u) => u.id === cmd.requestedById) ?? w.user('OWNER')), { command: cmd.type, reason: cmd.reason, status: cmd.status });
  }
  for (const s of support.filter((x) => x.answeredAt && inWindow(x.answeredAt))) {
    log(s.answeredAt!, 'STATUS_CHANGE', 'SupportMessage', s.id, user(s.answeredBy!), { where: { id: s.id }, data: { status: 'ANSWERED' } });
  }
  for (const [report, days] of [['cobranças', 3], ['inadimplência', 9], ['financeiro do mês', 24]] as const) {
    const at = clock.past(clock.rel(-days), rng, 10, 17);
    log(at, 'EXPORT', 'Report', null, user(w.user('FINANCE')), { report, format: 'xlsx' });
  }

  w.rows.audit.sort((a, b) => (a.occurredAt as Date).getTime() - (b.occurredAt as Date).getTime());
}

/** Três rodadas do job diário (08:00) e os eventos do gateway PIX dos últimos 30 dias. */
export function buildJobsAndGateway(w: World): void {
  const { rng, clock } = w;
  const now = clock.now.getTime();
  const runs: number[] = [];
  for (let d = clock.todayIdx; runs.length < 3; d--) if (clock.at(clock.ymd(d), 8, 0).getTime() + 60_000 < now) runs.push(d);
  for (const d of runs.reverse()) {
    const startedAt = clock.at(clock.ymd(d), 8, 0, rng.int(0, 20));
    const ymd = clock.ymd(d);
    const overdueMarked = w.charges.filter((ch) => ch.status === 'OVERDUE' && instantToYmd(ch.updatedAt) === ymd).length;
    w.rows.jobRuns.push({
      id: w.ids.id(),
      name: 'daily',
      trigger: 'cron',
      status: 'SUCCESS',
      startedAt,
      finishedAt: new Date(startedAt.getTime() + rng.int(2500, 9000)),
      // Mesmas chaves que o JobsService.runDaily grava (a tela de Sistema lê estas).
      summary: {
        overdueMarked,
        remindersSent: rng.int(8, 18),
        autoBlocked: 0,
        blockSuggested: rng.int(0, 2),
        sentToCollection: rng.int(0, 1),
        maintenanceAlerts: rng.int(2, 6),
        documentAlerts: rng.int(1, 4),
        contractAlerts: rng.int(1, 3),
        idleAlerts: rng.int(1, 3),
      },
    });
  }

  for (const ch of w.charges) {
    if (!ch.gatewayChargeId || !ch.paidAt || ch.paidAt.getTime() < now - 30 * 86_400_000) continue;
    const eventId = `evt_${w.ids.hex(24)}`;
    w.rows.gatewayEvents.push({
      id: w.ids.id(),
      provider: 'sandbox',
      eventId,
      type: 'charge.paid',
      payload: { id: eventId, type: 'charge.paid', data: { chargeId: ch.gatewayChargeId, amount: money(ch.paidCents ?? ch.amountCents), paidAt: ch.paidAt.toISOString() } },
      signatureValid: true,
      chargeId: ch.id,
      processedAt: new Date(ch.paidAt.getTime() + 800),
      receivedAt: new Date(ch.paidAt.getTime() + 300),
    });
  }
}
