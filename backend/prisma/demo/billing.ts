import {
  addDays,
  buildRentSchedule,
  computeLateFees,
  DEFAULT_CHARGE_RULES,
  diffDays,
  fromCents,
  toCents,
  type ScheduledInstallment,
} from '@locamania/shared';
import type { ChargeKind, ChargeStatus, PaymentMethod } from '@prisma/client';

import { METHOD_WEIGHTS } from './catalog';
import { periodUnit } from './contracts';
import { money, type ChargeSim, type ContractSim, type CustomerSim, type World } from './world';

/**
 * Cobranças (§11): caução na entrega e o cronograma do aluguel gerado pela mesma
 * regra do sistema (`buildRentSchedule`). Parcelas vencidas: a grande maioria
 * paga no dia (ou até 3 dias depois), algumas com atraso de 4–15 dias com multa
 * e juros de `computeLateFees`; ~9 clientes ativos inadimplentes.
 */

type Offset = number | 'UNPAID';


export function newCharge(
  w: World,
  fields: Pick<ChargeSim, 'customer' | 'kind' | 'description' | 'dueDate' | 'amountCents' | 'createdAt'> &
    Partial<ChargeSim>,
): ChargeSim {
  const ch: ChargeSim = {
    id: w.ids.id(),
    seq: 0,
    number: '',
    contract: null,
    motorcycleId: null,
    occurrenceId: null,
    sequence: null,
    periodStart: null,
    periodEnd: null,
    status: 'PENDING',
    paidAt: null,
    paidCents: null,
    fineCents: null,
    interestCents: null,
    method: null,
    registeredBy: null,
    gatewayChargeId: null,
    cancelReason: null,
    notes: null,
    updatedAt: fields.createdAt,
    order: w.chargeOrder++,
    ...fields,
  };
  w.charges.push(ch);
  if (ch.contract) ch.contract.charges.push(ch);
  return ch;
}

function pickMethod(w: World, cu: CustomerSim, paidAt: Date, atCounter: boolean): { method: PaymentMethod; gateway: boolean } {
  const { rng } = w;
  if (atCounter) {
    return {
      method: rng.weighted<PaymentMethod>([
        ['PIX', 45],
        ['CASH', 25],
        ['DEBIT_CARD', 15],
        ['CREDIT_CARD', 15],
      ]),
      gateway: false,
    };
  }
  // Cada cliente tem um jeito preferido de pagar (e às vezes varia).
  const method = rng.chance(0.75) ? cu.preferredMethod : rng.weighted<PaymentMethod>(METHOD_WEIGHTS);
  const portalReady = cu.portalEnabled && cu.privacyAcceptedAt !== null && paidAt.getTime() >= cu.privacyAcceptedAt.getTime();
  return { method, gateway: method === 'PIX' && portalReady && rng.chance(0.85) };
}

/** Marca a cobrança como paga no dia `paidIdx`, com encargos se passou da tolerância. */
export function settle(w: World, ch: ChargeSim, paidIdx: number, atCounter = false, at?: Date): void {
  const { rng, clock } = w;
  const paidYmd = clock.ymd(paidIdx);
  const fees = computeLateFees({ amount: money(ch.amountCents), dueDate: ch.dueDate, today: paidYmd, rules: DEFAULT_CHARGE_RULES });
  let paidAt = at ?? clock.past(paidYmd, rng, 8, 21);
  if (paidAt.getTime() < ch.createdAt.getTime()) paidAt = clock.plusMinutes(ch.createdAt, rng.int(1, 20));
  const { method, gateway } = pickMethod(w, ch.customer, paidAt, atCounter);
  ch.status = 'PAID';
  ch.paidAt = paidAt;
  ch.method = method;
  ch.fineCents = fees.chargeable ? toCents(fees.fine) : null;
  ch.interestCents = fees.chargeable ? toCents(fees.interest) : null;
  ch.paidCents = toCents(fees.total);
  ch.registeredBy = gateway ? null : w.cashier();
  ch.gatewayChargeId = gateway ? `sbx_${w.ids.hex(24)}` : null;
  ch.updatedAt = paidAt;
}

function defaultOffset(w: World): number {
  const r = w.rng.next();
  if (r < 0.15) return -w.rng.int(1, 2);
  if (r < 0.6) return 0;
  if (r < 0.8) return 1;
  if (r < 0.93) return w.rng.int(2, 3);
  return w.rng.int(4, 15);
}

function schedule(c: ContractSim): ScheduledInstallment[] {
  return buildRentSchedule({
    startDate: c.startDate,
    endDate: c.endDate,
    firstDueDate: c.startDate,
    periodicity: c.periodicity,
    amount: fromCents(c.reajuste?.oldCents ?? c.rentCents),
  });
}

export function buildCharges(w: World): void {
  const { rng, clock } = w;
  const T = clock.todayIdx;
  const pastGrace = (dueDate: string) => diffDays(dueDate, clock.today) > DEFAULT_CHARGE_RULES.graceDays;
  const overrides = new Map<ContractSim, Map<number, Offset>>();
  const setOverride = (c: ContractSim, seq: number, off: Offset) => {
    if (!overrides.has(c)) overrides.set(c, new Map());
    overrides.get(c)!.set(seq, off);
  };

  // João: 10 parcelas pagas (2 com atraso), a 11ª vence daqui a 2 dias.
  const joao = w.contracts.find((c) => c.role === 'JOAO')!;
  for (let s = 2; s <= 10; s++) setOverride(joao, s, rng.weighted([[-1, 20], [0, 60], [1, 20]] as const));
  setOverride(joao, 4, 6);
  setOverride(joao, 7, 9);

  // Reajuste de R$ 20 em três contratos semanais ativos há mais de 2 meses.
  const reajustables = rng
    .shuffle(w.contracts.filter((c) => c.status === 'ACTIVE' && c.role === null && c.periodicity === 'WEEKLY' && c.startIdx <= T - 60))
    .slice(0, 3);
  for (const c of reajustables) {
    const idx = T - rng.int(6, 25);
    c.reajuste = {
      idx,
      oldCents: c.rentCents,
      newCents: c.rentCents + 2000,
      at: clock.past(clock.ymd(idx), rng, 9, 17),
      by: rng.pick([w.user('OWNER'), w.user('ADMIN')]),
    };
    c.rentCents += 2000;
  }

  // Inadimplentes: as últimas k parcelas vencidas (passada a tolerância) em aberto.
  const counts = [4, 4, 3, 2, 2, 2, 1, 1, 1];
  const candidates = rng.shuffle(
    w.contracts.filter(
      (c) =>
        c.status === 'ACTIVE' &&
        c.role === null &&
        !c.moto.roles.has('BLOCK_HISTORY') &&
        c.customer!.manualStatus === null,
    ),
  );
  const debtors: ContractSim[] = [];
  for (const k of counts) {
    const i = candidates.findIndex((c) => {
      const past = schedule(c).filter((it) => pastGrace(it.dueDate)).length;
      return past >= k + 2 && (k < 3 || c.periodicity === 'WEEKLY');
    });
    if (i < 0) continue;
    const c = candidates.splice(i, 1)[0]!;
    const past = schedule(c).filter((it) => pastGrace(it.dueDate));
    const unpaid = past.slice(-k);
    for (const it of unpaid) setOverride(c, it.sequence, 'UNPAID');
    c.customer!.overdueTarget = k;
    if (k === 4) {
      c.customer!.inCollection = true;
      c.customer!.collectionSince = addDays(unpaid[0]!.dueDate, 15);
    }
    debtors.push(c);
  }

  // Histórico: moto bloqueada pelo rastreador por atraso e liberada no dia seguinte ao pagamento.
  const blockMoto = w.motos.find((m) => m.roles.has('BLOCK_HISTORY'));
  const blockContract = blockMoto?.contracts.find((c) => c.status === 'ACTIVE');
  if (blockMoto && blockContract) {
    const blockIdx = T - rng.int(40, 70);
    const target = schedule(blockContract)
      .filter((it) => clock.idx(it.dueDate) <= blockIdx - 10 && it.sequence > 1)
      .at(-1);
    if (target) {
      const dueIdx = clock.idx(target.dueDate);
      setOverride(blockContract, target.sequence, blockIdx + 1 - dueIdx);
      w.blockHistory = {
        moto: blockMoto,
        blockIdx,
        unblockIdx: blockIdx + 1,
        reason: `Inadimplência: parcela de ${target.dueDate.split('-').reverse().join('/')} em atraso e cliente sem retorno.`,
      };
    }
  }

  for (const c of w.contracts) {
    if (c.status === 'DRAFT') continue;
    const cu = c.customer!;
    const base = { customer: cu, contract: c, motorcycleId: c.moto.id };

    if (c.status === 'CANCELLED') {
      if (c.role !== 'CANCEL_AFTER_DELIVERY') continue;
      const first = schedule(c)[0]!;
      const ch = newCharge(w, {
        ...base,
        kind: 'RENT',
        sequence: 1,
        description: `Aluguel semana 1 — ${c.number}`,
        periodStart: first.periodStart,
        periodEnd: first.periodEnd,
        dueDate: first.dueDate,
        amountCents: toCents(first.amount),
        createdAt: c.deliveredAt!,
      });
      settle(w, ch, c.startIdx, true, clock.plusMinutes(c.deliveredAt!, rng.int(2, 15)));
      continue;
    }

    // Caução paga na entrega.
    if (c.depositCents) {
      const dep = newCharge(w, {
        ...base,
        kind: 'DEPOSIT',
        description: `Caução — ${c.number}`,
        dueDate: c.startDate,
        amountCents: c.depositCents,
        createdAt: c.deliveredAt!,
      });
      settle(w, dep, c.startIdx, true, clock.plusMinutes(c.deliveredAt!, rng.int(2, 15)));
    }

    const unit = periodUnit(c.periodicity);
    const ov = overrides.get(c);
    for (const it of schedule(c)) {
      let amountCents = toCents(it.amount);
      const dueIdx = clock.idx(it.dueDate);
      if (c.reajuste && dueIdx >= c.reajuste.idx) {
        amountCents = Math.round((amountCents * c.reajuste.newCents) / c.reajuste.oldCents);
      }
      const ch = newCharge(w, {
        ...base,
        kind: 'RENT' as ChargeKind,
        sequence: it.sequence,
        description: `Aluguel ${unit} ${it.sequence}${it.prorated ? ' (proporcional)' : ''} — ${c.number}`,
        periodStart: it.periodStart,
        periodEnd: it.periodEnd,
        dueDate: it.dueDate,
        amountCents,
        createdAt: c.deliveredAt!,
      });

      if (c.status === 'ENDED' && dueIdx >= c.returnIdx!) {
        ch.status = 'CANCELLED';
        ch.cancelReason = 'Contrato encerrado';
        ch.updatedAt = c.endedAt!;
        continue;
      }
      if (dueIdx > T) continue; // a vencer

      const off: Offset = it.sequence === 1 ? 0 : (ov?.get(it.sequence) ?? defaultOffset(w));
      if (off === 'UNPAID') {
        if (pastGrace(it.dueDate)) markOverdue(w, ch);
        continue;
      }
      let paidIdx = Math.max(c.startIdx, dueIdx + off);
      if (paidIdx > T) {
        if (dueIdx >= T - DEFAULT_CHARGE_RULES.graceDays) continue; // ainda na tolerância: em aberto
        paidIdx = rng.int(Math.max(dueIdx, T - 2), T);
      }
      if (it.sequence === 1) settle(w, ch, paidIdx, true, clock.plusMinutes(c.deliveredAt!, rng.int(2, 15)));
      else settle(w, ch, paidIdx);
    }
  }
  w.debtors = debtors;
}

/** Cobrança vencida e não paga: o job diário marca como em atraso 2 dias depois. */
export function markOverdue(w: World, ch: ChargeSim): void {
  ch.status = 'OVERDUE' as ChargeStatus;
  const markIdx = Math.min(w.clock.todayIdx, w.clock.idx(ch.dueDate) + DEFAULT_CHARGE_RULES.graceDays + 1);
  ch.updatedAt = w.clock.clamp(w.clock.at(w.clock.ymd(markIdx), 8, 0, 30), w.rng);
}

/** PAG-NNNNNN na ordem em que as cobranças foram geradas. */
export function numberCharges(w: World): void {
  w.charges
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.order - b.order)
    .forEach((ch, i) => {
      ch.seq = i + 1;
      ch.number = `PAG-${String(i + 1).padStart(6, '0')}`;
    });
}
