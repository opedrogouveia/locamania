import { createHash } from 'node:crypto';

import { formatCpf, formatPlate, formatYmd } from '@locamania/shared';
import type { FuelLevel, PaymentPeriodicity, ReturnCondition } from '@prisma/client';

import { DESKTOP_USER_AGENTS } from './catalog';
import { brl, round10, type ContractSim, type CustomerSim, type MotoSim, type ReadingSim, type World } from './world';

export const CONTRACT_RULES =
  'Uso exclusivo para trabalho com aplicativos de entrega na Grande São Paulo. ' +
  'Troca de óleo a cada 3.000 km na oficina indicada pela Locamania, sem custo para o locatário. ' +
  'Proibido sublocar ou emprestar a moto. Devolução antecipada exige aviso de 7 dias.';

const OFFICE_IP = '177.92.14.23';

const PERIOD_UNIT: Record<PaymentPeriodicity, string> = { WEEKLY: 'semana', BIWEEKLY: 'quinzena', MONTHLY: 'mês' };
export const periodUnit = (p: PaymentPeriodicity): string => PERIOD_UNIT[p];

function rentFor(w: World, c: ContractSim): number {
  const { rng } = w;
  const [lo, hi] = c.moto.spec.weeklyRent;
  // Contratos mais antigos têm a tabela do ano passado (R$ 10 a menos).
  const weekly = Math.max(280, round10(rng.int(lo, hi)) - (c.startIdx < 180 ? 10 : 0));
  switch (c.periodicity) {
    case 'WEEKLY':
      return weekly * 100;
    case 'BIWEEKLY':
      return round10(weekly * 2 - rng.int(20, 40)) * 100;
    case 'MONTHLY':
      return Math.min(1500, Math.max(1200, Math.round((weekly * 4 - rng.int(50, 100)) / 50) * 50)) * 100;
  }
}

function renderText(c: ContractSim): string {
  const cu = c.customer!;
  const m = c.moto;
  return [
    `CONTRATO DE LOCAÇÃO DE MOTOCICLETA Nº ${c.number}`,
    '',
    `LOCATÁRIO(A): ${cu.name}, CPF ${formatCpf(cu.cpf)}.`,
    `MOTOCICLETA: ${m.spec.label} ${m.modelYear}, placa ${formatPlate(m.plate)}, cor ${m.color.toLowerCase()}.`,
    `VIGÊNCIA: ${formatYmd(c.startDate)} a ${formatYmd(c.endDate)}.`,
    `VALOR: ${brl(c.rentCents)} por ${PERIOD_UNIT[c.periodicity]}; caução ${c.depositCents ? brl(c.depositCents) : 'dispensada'}.`,
    '',
    `REGRAS: ${CONTRACT_RULES}`,
    '',
    '(Texto gerado na demonstração.)',
  ].join('\n');
}

/**
 * Datas, valores, assinatura, texto congelado e número (LOC-AAAA-NNNN, sequencial
 * por ano de criação) de todos os contratos.
 */
export function detailContracts(w: World): void {
  const { rng, clock } = w;
  const blockedDamage = w.customers.find((c) => c.blockedReason?.startsWith('Devolveu'));
  const blockedSublet = w.customers.find((c) => c.blockedReason?.startsWith('Sublocou'));
  const lastEnded = (cu: CustomerSim | undefined) =>
    cu?.contracts.filter((k) => k.status === 'ENDED').sort((a, b) => (b.returnIdx ?? 0) - (a.returnIdx ?? 0))[0];
  const noDeposit = lastEnded(blockedDamage);
  const forcedDeposit = lastEnded(blockedSublet);
  let draftCount = 0;

  for (const c of w.contracts) {
    const cu = c.customer!;
    if (c.delivered && c.status !== 'CANCELLED') c.createdIdx = Math.max(0, c.startIdx - (c.role === 'JOAO' ? 1 : rng.int(0, 2)));
    let created = clock.past(clock.ymd(c.createdIdx), rng, 9, 17);
    if (created.getTime() <= cu.createdAt.getTime()) created = clock.plusMinutes(cu.createdAt, rng.int(20, 90));
    c.createdAt = created;
    c.createdBy = w.clerk();

    c.periodicity =
      c.role === 'JOAO' || c.role === 'CANCEL_AFTER_DELIVERY'
        ? 'WEEKLY'
        : rng.weighted<PaymentPeriodicity>([
            ['WEEKLY', 80],
            ['BIWEEKLY', 12],
            ['MONTHLY', 8],
          ]);
    c.rentCents = c.role === 'JOAO' ? 35000 : rentFor(w, c);
    c.depositCents = rng.chance(0.7)
      ? rng.weighted([
          [50000, 25],
          [60000, 20],
          [70000, 15],
          [80000, 25],
          [100000, 15],
        ])
      : null;
    if (c.role === 'JOAO') c.depositCents = 80000;
    if (c === noDeposit) c.depositCents = null;
    if (c === forcedDeposit) c.depositCents = 80000;

    if (c.delivered) {
      let delivered = clock.past(c.startDate, rng, 9, 17);
      if (delivered.getTime() < created.getTime() + 60 * 60_000) delivered = clock.plusMinutes(created, rng.int(60, 150));
      c.deliveredAt = delivered;
    }
    if (c.status === 'ENDED') {
      c.endedAt =
        c.role === 'THEFT'
          ? clock.at(clock.ymd(c.returnIdx!), 23, 10)
          : clock.past(clock.ymd(c.returnIdx!), rng, 9, 18);
    }
    if (c.status === 'CANCELLED') {
      const idx = c.delivered ? c.returnIdx! : c.createdIdx + rng.int(0, 1);
      let at = clock.past(clock.ymd(idx), rng, 9, 18);
      if (at.getTime() <= created.getTime()) at = clock.plusMinutes(created, rng.int(30, 240));
      c.cancelledAt = at;
    }

    // Assinatura: presencial no balcão ou aceite eletrônico pelo app.
    const signs = c.status !== 'DRAFT' && (c.delivered || rng.chance(0.5));
    const electronic = cu.portalEnabled && rng.chance(0.6);
    if (signs) {
      c.signatureMethod = electronic ? 'ELECTRONIC_ACCEPTANCE' : 'IN_PERSON';
      const limit = c.deliveredAt ?? c.cancelledAt ?? clock.plusMinutes(created, 240);
      if (electronic) {
        c.sentAt = clock.plusMinutes(created, rng.int(5, 30));
        const room = Math.max(2, Math.floor((limit.getTime() - c.sentAt.getTime()) / 60_000) - 10);
        c.signedAt = clock.plusMinutes(c.sentAt, rng.int(1, Math.min(room, 300)));
        c.signatureIp = cu.ip;
        c.signatureUserAgent = cu.userAgent;
        if (!cu.privacyAcceptedAt || cu.privacyAcceptedAt.getTime() > c.signedAt.getTime()) {
          cu.privacyAcceptedAt = new Date(c.signedAt.getTime() - 3 * 60_000);
        }
      } else {
        c.signedAt = new Date(limit.getTime() - rng.int(5, 30) * 60_000);
        if (c.signedAt.getTime() < created.getTime()) c.signedAt = clock.plusMinutes(created, 2);
        c.signatureIp = OFFICE_IP;
        c.signatureUserAgent = rng.pick(DESKTOP_USER_AGENTS);
      }
    }
    if (c.status === 'DRAFT' && draftCount++ === 0) c.sentAt = clock.plusMinutes(created, 15);

    if (rng.chance(0.12)) {
      c.notes = rng.pick([
        'Pagamento combinado às segundas-feiras.',
        'Cliente recebeu baú e suporte de celular.',
        'Cliente indicado por outro locatário.',
        'Entregue com tanque cheio.',
      ]);
    }
  }

  // Número e sequência pela ordem de criação (NNNN reinicia a cada ano).
  const byYear = new Map<string, number>();
  [...w.contracts]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.moto.index - b.moto.index)
    .forEach((c, i) => {
      c.seq = i + 1;
      const year = clock.ymd(c.createdIdx).slice(0, 4);
      const n = (byYear.get(year) ?? 0) + 1;
      byYear.set(year, n);
      c.number = `LOC-${year}-${String(n).padStart(4, '0')}`;
    });

  for (const c of w.contracts) {
    c.renderedText = renderText(c);
    c.documentHash = createHash('sha256').update(c.renderedText).digest('hex');
  }
}

const DAMAGE_ITEMS: [string, number][] = [
  ['Retrovisor esquerdo quebrado', 6500],
  ['Carenagem lateral direita riscada', 18000],
  ['Banco rasgado na lateral', 14000],
  ['Pisca traseiro quebrado', 4500],
  ['Tanque amassado e carenagem trincada', 38000],
];

/** Vistoria de devolução de cada contrato encerrado (§23). */
export function buildInspections(w: World): void {
  const { rng, clock } = w;
  const ended = w.contracts.filter((c) => c.status === 'ENDED');
  const blockedDamage = w.customers.find((c) => c.blockedReason?.startsWith('Devolveu'));
  const blockedSublet = w.customers.find((c) => c.blockedReason?.startsWith('Sublocou'));
  const lastOf = (cu: CustomerSim | undefined) =>
    ended.filter((c) => c.customer === cu).sort((a, b) => (b.returnIdx ?? 0) - (a.returnIdx ?? 0))[0];
  const damageContract = lastOf(blockedDamage);
  const subletContract = lastOf(blockedSublet);

  // Cinco devoluções com avaria (a do cliente bloqueado entre elas).
  const damaged = new Set<ContractSim>(damageContract ? [damageContract] : []);
  for (const c of rng.shuffle(ended)) {
    if (damaged.size >= 5) break;
    if (c.role === 'THEFT' || c === subletContract || (c.returnIdx ?? 0) > clock.todayIdx - 5) continue;
    if (c.moto.final === 'MAINTENANCE' && c === c.moto.contracts.filter((k) => k.status === 'ENDED').at(-1)) continue;
    damaged.add(c);
  }
  const retainedEarly = new Set(
    rng
      .shuffle(ended.filter((c) => !c.fullTerm && c.depositCents && !damaged.has(c) && c !== subletContract && c.role === null))
      .slice(0, 3),
  );
  let damageIdx = 0;

  for (const c of ended) {
    const m = c.moto;
    const returnIdx = c.returnIdx!;
    const isLast = m.contracts.filter((k) => k.status === 'ENDED').at(-1) === c;
    const fuel = rng.weighted<FuelLevel>([
      ['EMPTY', 10],
      ['QUARTER', 25],
      ['HALF', 35],
      ['THREE_QUARTERS', 20],
      ['FULL', 10],
    ]);
    const insp = {
      id: w.ids.id(),
      returnedAt: clock.ymd(returnIdx),
      finalKm: m.cum[returnIdx] ?? m.cum[m.cum.length - 1]!,
      condition: 'GOOD' as ReturnCondition,
      fuelLevel: fuel as FuelLevel | null,
      damages: null as string | null,
      pendingItems: null as string | null,
      nextMotorcycleStatus: (isLast && m.final === 'MAINTENANCE' ? 'MAINTENANCE' : 'AVAILABLE') as ContractSim['moto']['final'],
      depositOutcome: (c.depositCents ? 'REFUNDED' : 'NONE') as 'NONE' | 'REFUNDED' | 'RETAINED' | 'PARTIALLY_RETAINED',
      depositRetainedCents: null as number | null,
      notes: null as string | null,
      createdBy: w.clerk(),
      createdAt: c.endedAt!,
      damage: null as { description: string; amountCents: number; chargeStatus: 'PAID' | 'OVERDUE' | null } | null,
    };

    if (c.role === 'THEFT') {
      Object.assign(insp, {
        condition: 'DAMAGED',
        fuelLevel: null,
        damages: 'Moto não devolvida: roubada durante a locação (ver ocorrência de roubo).',
        pendingItems: 'Aguardar recuperação da moto e o andamento do boletim de ocorrência.',
        nextMotorcycleStatus: 'BLOCKED',
        depositOutcome: 'NONE',
        notes: 'Contrato encerrado por roubo. Caução mantida até a conclusão do caso.',
      });
    } else if (damaged.has(c)) {
      const [item, cents] = DAMAGE_ITEMS[damageIdx++ % DAMAGE_ITEMS.length]!;
      const severe = cents >= 30000 || c === damageContract;
      insp.condition = severe ? 'DAMAGED' : 'FAIR';
      insp.damages = `${item}.`;
      if (c.depositCents && c !== damageContract) {
        insp.depositOutcome = 'PARTIALLY_RETAINED';
        insp.depositRetainedCents = cents;
        insp.notes = `Descontado da caução o reparo: ${item.toLowerCase()} (${brl(cents)}).`;
        insp.damage = { description: item, amountCents: cents, chargeStatus: null };
      } else {
        insp.damage = { description: item, amountCents: cents, chargeStatus: c === damageContract ? 'OVERDUE' : 'PAID' };
        insp.pendingItems = c === damageContract ? 'Cliente não pagou o reparo da avaria.' : null;
      }
    } else {
      if (rng.chance(0.22)) {
        insp.condition = 'FAIR';
        insp.damages = rng.pick(['Riscos leves de uso na carenagem.', 'Banco com desgaste normal.', 'Manoplas gastas.', 'Adesivo do para-lama descolando.']);
      }
      if (c === subletContract && c.depositCents) {
        insp.depositOutcome = 'RETAINED';
        insp.depositRetainedCents = c.depositCents;
        insp.notes = 'Caução retida: sublocação comprovada, em desacordo com a cláusula 5.2.';
      } else if (retainedEarly.has(c)) {
        insp.depositOutcome = 'RETAINED';
        insp.depositRetainedCents = c.depositCents;
        insp.notes = 'Devolução antecipada sem o aviso de 7 dias: caução retida conforme contrato.';
      } else if (rng.chance(0.05)) {
        insp.pendingItems = 'Cliente ficou de entregar a segunda chave.';
      }
    }
    if (isLast && m.final === 'MAINTENANCE') insp.notes = 'Moto encaminhada para a oficina após a vistoria.';
    c.inspection = insp;
  }
}

function reading(
  m: MotoSim,
  idx: number,
  readAt: Date,
  source: ReadingSim['source'],
  extra: Partial<Pick<ReadingSim, 'userId' | 'customerId' | 'contractId' | 'notes' | 'km'>> = {},
): void {
  m.readings.push({
    motorcycleId: m.id,
    idx,
    km: extra.km ?? m.cum[Math.min(idx, m.cum.length - 1)]!,
    readAt,
    source,
    userId: extra.userId ?? null,
    customerId: extra.customerId ?? null,
    contractId: extra.contractId ?? null,
    notes: extra.notes ?? null,
  });
}

/** Leituras de odômetro: cadastro, entrega, devolução e as semanais do aluguel. */
export function buildReadings(w: World): void {
  const { rng, clock } = w;
  const T = clock.todayIdx;
  for (const m of w.motos) {
    const acqIdx = clock.idx(m.acquiredAt);
    if (acqIdx < 0) {
      reading(m, 0, clock.at(clock.start, 9, 5 + m.index), 'MANUAL', {
        userId: w.user('ADMIN').id,
        notes: 'Quilometragem registrada na implantação do sistema.',
      });
    } else {
      reading(m, acqIdx, m.createdAt, 'MANUAL', { userId: w.user('ADMIN').id, notes: 'Cadastro da moto.' });
    }

    for (const c of m.contracts) {
      if (!c.delivered) continue;
      const cu = c.customer!;
      reading(m, c.startIdx, c.deliveredAt!, 'CONTRACT_START', { userId: c.createdBy.id, customerId: cu.id, contractId: c.id });
      const step = c.status === 'ACTIVE' ? 7 : 14;
      const end = c.status === 'ACTIVE' ? T + 1 : c.returnIdx!;
      let lastIdx = c.startIdx;
      for (let d = c.startIdx + step; d < end; d += step) {
        const dd = Math.min(T, d + rng.int(-1, 1));
        if (dd <= lastIdx || dd >= end) continue;
        const fromApp = cu.portalEnabled && rng.chance(0.6);
        const at = clock.past(clock.ymd(dd), rng, fromApp ? 7 : 8, fromApp ? 22 : 18);
        if (fromApp && cu.privacyAcceptedAt && at.getTime() >= cu.privacyAcceptedAt.getTime()) {
          reading(m, dd, at, 'CUSTOMER', { customerId: cu.id, contractId: c.id });
        } else {
          reading(m, dd, at, 'MANUAL', { userId: w.clerk().id, contractId: c.id });
        }
        lastIdx = dd;
      }
      if (c.status === 'ACTIVE' && (lastIdx < T - 3 || c.role === 'JOAO')) {
        const dd = c.role === 'JOAO' ? T - 1 : T - rng.int(0, 2);
        if (dd > lastIdx) {
          const at = clock.past(clock.ymd(dd), rng, 7, 20);
          if (cu.portalEnabled) reading(m, dd, at, 'CUSTOMER', { customerId: cu.id, contractId: c.id });
          else reading(m, dd, at, 'MANUAL', { userId: w.clerk().id, contractId: c.id });
        }
      }
      if (c.status === 'ENDED') {
        reading(m, c.returnIdx!, c.endedAt!, 'RETURN', {
          userId: c.inspection?.createdBy.id ?? c.createdBy.id,
          customerId: cu.id,
          contractId: c.id,
          notes: c.role === 'THEFT' ? 'Última quilometragem conhecida (rastreador) antes do roubo.' : null,
        });
      }
      if (c.status === 'CANCELLED' && c.returnIdx !== null) {
        reading(m, c.returnIdx, c.cancelledAt!, 'MANUAL', {
          userId: c.createdBy.id,
          contractId: c.id,
          notes: 'Devolução após cancelamento do contrato.',
        });
      }
    }
    m.lastReadingIdx = Math.max(...m.readings.map((r) => r.idx));
    m.currentKm = Math.max(...m.readings.map((r) => r.km));
  }
}
