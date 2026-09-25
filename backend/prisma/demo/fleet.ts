import { addDays, addMonths, diffDays, weekday } from '@locamania/shared';

import { round10, type ContractSim, type ModelSpec, type MotoRole, type MotoSim, type World } from './world';

/**
 * Frota: ~40 motos de uma locadora para entregadores de aplicativo em São Paulo
 * (maioria Honda CG 160), a linha do tempo de aluguéis de cada uma nos últimos
 * 12 meses e a quilometragem diária que sai disso.
 */

export const FLEET: ModelSpec[] = [
  { brand: 'HONDA', model: 'CG_160_FAN', label: 'CG 160 Fan', count: 9, price: [16500, 17600], weeklyRent: [340, 370], disc: true, belt: false, wmi: '9C2', vds: 'KC2210', oilLiters: '1 L', tire: '90/90-18' },
  { brand: 'HONDA', model: 'CG_160_START', label: 'CG 160 Start', count: 6, price: [15000, 15900], weeklyRent: [320, 340], disc: false, belt: false, wmi: '9C2', vds: 'KC2200', oilLiters: '1 L', tire: '90/90-18' },
  { brand: 'HONDA', model: 'CG_160_TITAN', label: 'CG 160 Titan', count: 4, price: [18000, 19000], weeklyRent: [350, 380], disc: true, belt: false, wmi: '9C2', vds: 'KC2220', oilLiters: '1 L', tire: '100/80-18' },
  { brand: 'HONDA', model: 'POP_110I', label: 'Pop 110i', count: 5, price: [9400, 9900], weeklyRent: [280, 300], disc: false, belt: false, wmi: '9C2', vds: 'JB0110', oilLiters: '0,8 L', tire: '80/100-14' },
  { brand: 'HONDA', model: 'BIZ_125', label: 'Biz 125', count: 3, price: [13500, 14500], weeklyRent: [300, 320], disc: false, belt: false, wmi: '9C2', vds: 'JC7510', oilLiters: '0,9 L', tire: '80/100-14' },
  { brand: 'HONDA', model: 'NXR_160_BROS', label: 'NXR 160 Bros', count: 3, price: [19000, 20500], weeklyRent: [380, 410], disc: true, belt: false, wmi: '9C2', vds: 'KD0810', oilLiters: '1,2 L', tire: '110/90-17' },
  { brand: 'YAMAHA', model: 'FACTOR_150', label: 'Factor 150', count: 3, price: [15000, 16000], weeklyRent: [340, 360], disc: true, belt: false, wmi: '9C6', vds: 'RG5410', oilLiters: '1 L', tire: '90/90-18' },
  { brand: 'YAMAHA', model: 'FAZER_FZ15', label: 'Fazer FZ15', count: 2, price: [17500, 18500], weeklyRent: [360, 390], disc: true, belt: false, wmi: '9C6', vds: 'RG6210', oilLiters: '1 L', tire: '100/80-17' },
  { brand: 'YAMAHA', model: 'CROSSER_150', label: 'Crosser 150', count: 1, price: [18500, 19500], weeklyRent: [370, 400], disc: true, belt: false, wmi: '9C6', vds: 'DG4510', oilLiters: '1 L', tire: '110/90-17' },
  { brand: 'YAMAHA', model: 'NMAX_160', label: 'NMax 160', count: 1, price: [22000, 23000], weeklyRent: [400, 420], disc: true, belt: true, wmi: '9C6', vds: 'SG7610', oilLiters: '0,9 L', tire: '140/70-13' },
  { brand: 'SHINERAY', model: 'WORKER_125', label: 'Worker 125', count: 3, price: [9000, 10000], weeklyRent: [280, 290], disc: false, belt: false, wmi: '99H', vds: 'XW1250', oilLiters: '0,9 L', tire: '90/90-18' },
];

const COLORS: readonly (readonly [string, number])[] = [
  ['Preta', 30],
  ['Vermelha', 20],
  ['Branca', 15],
  ['Prata', 15],
  ['Azul', 10],
  ['Cinza', 10],
];

/** 10º caractere do chassi (ano-modelo). */
const VIN_YEAR: Record<number, string> = { 2021: 'M', 2022: 'N', 2023: 'P', 2024: 'R', 2025: 'S' };

const ACTIVE_MONTHS: readonly (readonly [number, number])[] = [
  [3, 35],
  [6, 45],
  [12, 20],
];
const ENDED_MONTHS: readonly (readonly [number, number])[] = [
  [3, 30],
  [6, 50],
  [12, 20],
];

/** RENAVAM de 11 dígitos com dígito verificador válido. */
function renavam(w: World): string {
  const base = w.rng.digits(10);
  const weights = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, wt, i) => acc + wt * Number(base[i]), 0);
  const dv = (sum * 10) % 11;
  return base + String(dv === 10 ? 0 : dv);
}

function plate(w: World, old: boolean, used: Set<string>): string {
  for (;;) {
    const first = w.rng.pick(old ? ['E', 'F', 'G'] : ['F', 'G', 'R', 'S', 'T']);
    const letters = first + w.rng.letters(2, 'ABCDEFGHJKLMNPRSTUVWXYZ');
    const value = old
      ? `${letters}${w.rng.digits(4)}`
      : `${letters}${w.rng.int(1, 9)}${w.rng.letters(1, 'ABCDEFGHIJ')}${w.rng.digits(2)}`;
    if (!used.has(value)) {
      used.add(value);
      return value;
    }
  }
}

export function buildFleet(w: World): void {
  const { rng, clock } = w;

  // 1) Modelo, compra e ano de cada moto.
  let index = 0;
  for (const spec of FLEET) {
    for (let i = 0; i < spec.count; i++) {
      const daysAgo = rng.int(183, 730);
      const m: MotoSim = {
        id: w.ids.id(),
        index: index++,
        spec,
        plate: '',
        renavam: '',
        chassis: '',
        manufactureYear: 0,
        modelYear: 0,
        color: '',
        acquiredAt: clock.rel(-daysAgo),
        isNew: rng.chance(0.65),
        acqKm: 0,
        purchaseCents: 0,
        hasTracker: false,
        trackerDeviceId: null,
        final: 'RENTED',
        roles: new Set<MotoRole>(),
        idleDays: 0,
        startIdx: 0,
        contracts: [],
        cum: [],
        readings: [],
        currentKm: 0,
        lastReadingIdx: 0,
        statusReason: null,
        availableSince: null,
        theftIdx: null,
        soldIdx: null,
        salePriceCents: null,
        insurance: null,
        notes: null,
        createdAt: new Date(0),
      };
      w.motos.push(m);
    }
  }

  // 2) Situação final (hoje) e papéis da demonstração.
  const order = rng.shuffle(w.motos);
  const take = (pred: (m: MotoSim) => boolean): MotoSim => {
    const i = order.findIndex(pred);
    if (i < 0) throw new Error('Frota: nenhuma moto atende ao critério da demonstração');
    return order.splice(i, 1)[0] as MotoSim;
  };
  const ageDays = (m: MotoSim) => diffDays(m.acquiredAt, clock.today);

  const sold = take((m) => !m.isNew && ageDays(m) >= 450);
  sold.final = 'INACTIVE';
  const stolen = take((m) => m.spec.model === 'CG_160_TITAN' || m.spec.model === 'CG_160_FAN');
  stolen.final = 'BLOCKED';
  const joao = take((m) => m.spec.model === 'CG_160_FAN');
  joao.roles.add('JOAO');
  const battery = take((m) => m.spec.brand === 'HONDA' && m.spec.model !== 'POP_110I');
  battery.roles.add('BATTERY_DUE_SOON');
  // Bateria original perto dos 540 dias: moto 0 km comprada há ~17 meses e meio.
  battery.acquiredAt = clock.rel(-532);
  battery.isNew = true;

  for (const role of ['SHOP_SERVICE', 'SHOP_CRASH', 'SHOP_ENGINE'] as const) {
    const m = take(() => true);
    m.final = 'MAINTENANCE';
    m.roles.add(role);
  }
  for (let i = 0; i < 2; i++) take(() => true).final = 'RESERVED';
  for (const idle of [2, 4, 9, 12, 19]) {
    const m = take(() => true);
    m.final = 'AVAILABLE';
    m.idleDays = idle;
  }
  // O resto está alugado; alguns com papéis de alerta.
  const rentedRoles: MotoRole[] = [
    'ENDING_SOON', 'ENDING_SOON', 'ENDING_SOON',
    'OIL_DUE_SOON', 'OIL_DUE_SOON', 'OIL_DUE_SOON',
    'OIL_OVERDUE', 'OIL_OVERDUE',
    'BRAKE_OVERDUE',
    'BLOCK_HISTORY',
  ];
  for (const role of rentedRoles) take(() => true).roles.add(role);

  // 3) Identificação (placa, chassi, RENAVAM), ano, preço e km na compra.
  const plates = new Set<string>();
  let oldPlates = 0;
  for (const m of w.motos) {
    const acqYear = Number(m.acquiredAt.slice(0, 4));
    if (m.isNew) {
      m.modelYear = Math.min(2025, acqYear + (rng.chance(0.3) ? 1 : 0));
      m.manufactureYear = Math.min(m.modelYear, acqYear);
    } else {
      m.modelYear = Math.max(2021, Math.min(2024, acqYear - rng.int(1, 3)));
      m.manufactureYear = rng.chance(0.3) ? m.modelYear - 1 : m.modelYear;
    }
    const age = Math.max(0, acqYear - m.modelYear);
    m.acqKm = m.isNew ? rng.int(0, 12) : age * rng.int(8000, 14000) + rng.int(300, 4000);
    const newPrice = round10(rng.int(m.spec.price[0], m.spec.price[1]));
    m.purchaseCents = m.isNew ? newPrice * 100 : Math.round((newPrice * (0.92 - 0.08 * age)) / 100) * 100 * 100;

    const old = !m.isNew && m.modelYear <= 2022 && oldPlates < 3 && rng.chance(0.7);
    if (old) oldPlates++;
    m.plate = plate(w, old, plates);
    m.renavam = renavam(w);
    const plant = m.spec.brand === 'SHINERAY' ? 'S' : 'M';
    m.chassis = `${m.spec.wmi}${m.spec.vds}${VIN_YEAR[m.modelYear] ?? 'S'}${plant}${rng.digits(6)}`;
    m.color = rng.weighted(COLORS);

    const acqIdx = clock.idx(m.acquiredAt);
    m.startIdx = Math.max(0, acqIdx);
    m.createdAt = acqIdx < 0 ? clock.at(clock.start, 9, m.index) : clock.at(m.acquiredAt, 10, rng.int(0, 59));
  }

  // 4) Rastreador em ~70% da frota (obrigatório nas motos com papel de rastreio).
  const mustTrack = w.motos.filter((m) => m.roles.has('JOAO') || m.roles.has('BLOCK_HISTORY') || m === stolen);
  const pool = rng.shuffle(w.motos.filter((m) => m !== sold && !mustTrack.includes(m)));
  const tracked = [...mustTrack, ...pool.slice(0, 28 - mustTrack.length)];
  const deviceIds = new Set<string>();
  for (const m of tracked) {
    m.hasTracker = true;
    let dev: string;
    do dev = `TRK-${rng.int(10000, 99999)}`;
    while (deviceIds.has(dev));
    deviceIds.add(dev);
    m.trackerDeviceId = dev;
  }

  // 5) Seguro nas motos mais caras — algumas apólices vencendo e duas vencidas.
  const insurers = ['Porto Seguro', 'Mapfre', 'HDI Seguros', 'Tokio Marine'];
  const insurable = w.motos
    .filter((m) => m !== sold && m !== stolen && m.purchaseCents >= 1_650_000)
    .sort((a, b) => b.purchaseCents - a.purchaseCents)
    .slice(0, 10);
  insurable.forEach((m, i) => {
    const old = ageDays(m) >= 400;
    let startDaysAgo: number;
    if (i < 3 && old) startDaysAgo = rng.int(338, 358); // vence nos próximos 30 dias
    else if (i < 5 && old) startDaysAgo = rng.int(372, 385); // vencida
    else startDaysAgo = rng.int(20, Math.min(300, ageDays(m) - 5));
    m.insurance = {
      start: clock.rel(-startDaysAgo),
      insurer: rng.pick(insurers),
      premiumCents: Math.round((m.purchaseCents * rng.float(0.07, 0.1)) / 100) * 100,
    };
  });

  const noteOptions = ['Baú de 45 L instalado.', 'Protetor de motor e mata-cachorro instalados.', 'Suporte de celular no guidão.', 'Chave reserva no cofre do galpão.'];
  for (const m of w.motos) if (rng.chance(0.25)) m.notes = rng.pick(noteOptions);
}

// ─────────────────────── Linha do tempo de contratos ───────────────────────

function blankContract(w: World, m: MotoSim, startIdx: number, months: number): ContractSim {
  const startDate = w.clock.ymd(startIdx);
  return {
    id: w.ids.id(),
    moto: m,
    customer: null,
    status: 'ENDED',
    role: null,
    startIdx,
    startDate,
    endDate: addDays(addMonths(startDate, months), -1),
    months,
    returnIdx: null,
    fullTerm: false,
    delivered: true,
    renewalOf: null,
    createdIdx: startIdx,
    dailyKm: 0,
    periodicity: 'WEEKLY',
    rentCents: 0,
    depositCents: null,
    number: '',
    seq: 0,
    createdAt: new Date(0),
    deliveredAt: null,
    endedAt: null,
    cancelledAt: null,
    cancelReason: null,
    createdBy: w.users[0]!,
    signatureMethod: null,
    signedAt: null,
    signatureIp: null,
    signatureUserAgent: null,
    sentAt: null,
    renderedText: null,
    documentHash: null,
    signedDocumentId: null,
    notes: null,
    reajuste: null,
    inspection: null,
    charges: [],
  };
}

function plannedDays(w: World, startIdx: number, months: number): number {
  const s = w.clock.ymd(startIdx);
  return diffDays(s, addMonths(s, months));
}

/** Contrato encerrado que termina (devolução) no dia `returnIdx`. */
function endedBefore(w: World, m: MotoSim, returnIdx: number, renewal: boolean): ContractSim | null {
  const { rng } = w;
  const minStart = m.startIdx + (m.startIdx > 0 ? rng.int(2, 6) : 0);
  let months = rng.weighted(ENDED_MONTHS);
  let full = renewal || rng.chance(0.55);
  let start: number;
  if (full) {
    start = returnIdx - Math.round(months * 30.44);
    start = returnIdx - plannedDays(w, start, months);
    start = returnIdx - plannedDays(w, start, months);
  } else {
    const planned = Math.round(months * 30.44);
    start = returnIdx - rng.int(Math.max(21, Math.round(planned * 0.5)), Math.max(22, planned - 7));
  }
  if (start < minStart) {
    if (returnIdx - minStart < 21) return null;
    start = minStart;
    full = false;
    while (months < 12 && plannedDays(w, start, months) < returnIdx - start + 7) months = months === 3 ? 6 : 12;
  }
  const c = blankContract(w, m, start, months);
  c.returnIdx = returnIdx;
  c.fullTerm = full && w.clock.idx(c.endDate) + 1 === returnIdx;
  return c;
}

function gapDays(w: World): number {
  const r = w.rng.next();
  if (r < 0.12) return 0;
  if (r < 0.5) return w.rng.int(1, 4);
  return w.rng.int(5, 14);
}

/** Preenche para trás, a partir do contrato mais antigo já colocado, até o início da moto. */
function backfill(w: World, m: MotoSim): void {
  let next = m.contracts[0];
  while (next) {
    const canRenew = next.role === null && next.status !== 'DRAFT';
    const renewal = canRenew && w.rng.chance(0.12);
    const returnIdx = next.startIdx - (renewal ? 0 : gapDays(w));
    const prev = endedBefore(w, m, returnIdx, renewal);
    if (!prev) break;
    if (renewal && prev.fullTerm && prev.returnIdx === next.startIdx) next.renewalOf = prev;
    m.contracts.unshift(prev);
    next = prev;
  }
}

export function buildTimelines(w: World): void {
  const { rng, clock } = w;
  const T = clock.todayIdx;
  const endingSoon = [3, 8, 13];
  const shopReturn: Record<string, number> = { SHOP_SERVICE: 1, SHOP_CRASH: 2, SHOP_ENGINE: 4 };

  for (const m of w.motos) {
    let last: ContractSim | null = null;
    switch (m.final) {
      case 'RENTED': {
        let start: number;
        let months: number;
        if (m.roles.has('JOAO')) {
          start = T - 68;
          months = 6;
        } else if (m.roles.has('ENDING_SOON')) {
          const endTarget = clock.rel(endingSoon.shift() ?? 10);
          start = clock.idx(addMonths(addDays(endTarget, 1), -3));
          months = 3;
        } else {
          const minAge = m.roles.has('BLOCK_HISTORY') ? 100 : 4;
          const maxAge = Math.min(330, T - (m.startIdx + 3));
          const age = rng.int(Math.min(minAge, maxAge), maxAge);
          start = T - age;
          const pick = rng.weighted(ACTIVE_MONTHS);
          months = 12;
          for (const mm of [3, 6, 12].filter((x) => x >= pick)) {
            if (clock.idx(addDays(addMonths(clock.ymd(start), mm), -1)) > T + 15) {
              months = mm;
              break;
            }
          }
        }
        last = blankContract(w, m, start, months);
        last.status = 'ACTIVE';
        if (m.roles.has('JOAO')) last.role = 'JOAO';
        if (m.roles.has('ENDING_SOON')) last.role = 'ENDING_SOON';
        m.contracts.push(last);
        break;
      }
      case 'AVAILABLE':
      case 'RESERVED':
      case 'MAINTENANCE':
      case 'INACTIVE': {
        let returnIdx: number;
        if (m.final === 'AVAILABLE') returnIdx = T - m.idleDays;
        else if (m.final === 'RESERVED') returnIdx = T - rng.int(3, 9);
        else if (m.final === 'MAINTENANCE') returnIdx = T - (shopReturn[[...m.roles][0] ?? ''] ?? 2);
        else returnIdx = T - rng.int(60, 85);
        last = endedBefore(w, m, returnIdx, false);
        if (!last) throw new Error(`Moto ${m.index}: sem espaço para o último contrato`);
        m.contracts.push(last);
        if (m.final === 'INACTIVE') m.soldIdx = returnIdx + rng.int(12, 25);
        break;
      }
      case 'BLOCKED': {
        const theft = T - 3;
        last = blankContract(w, m, theft - rng.int(60, 150), 6);
        last.returnIdx = theft;
        last.role = 'THEFT';
        m.theftIdx = theft;
        m.contracts.push(last);
        break;
      }
    }
    backfill(w, m);

    if (m.final === 'RESERVED') {
      const draft = blankContract(w, m, T + rng.int(1, 2), rng.weighted(ACTIVE_MONTHS));
      draft.status = 'DRAFT';
      draft.delivered = false;
      draft.createdIdx = T - rng.int(0, 1);
      m.contracts.push(draft);
    }
    w.contracts.push(...m.contracts);
  }
}

/**
 * Cinco contratos cancelados, nos intervalos em que a moto ficou parada: três
 * desistências antes da retirada e dois clientes que devolveram em 2–3 dias.
 */
export function addCancelledContracts(w: World): void {
  const { rng, clock } = w;
  const gaps: { m: MotoSim; from: number; to: number }[] = [];
  for (const m of w.motos) {
    let prevEnd = m.startIdx;
    for (const c of m.contracts) {
      if (!c.delivered) continue;
      if (c.startIdx - prevEnd >= 4 && prevEnd <= clock.todayIdx - 30) gaps.push({ m, from: prevEnd, to: c.startIdx });
      prevEnd = c.returnIdx ?? Number.POSITIVE_INFINITY;
    }
  }
  const shuffled = rng.shuffle(gaps);
  const picked = new Set<number>();
  const plan: ('CANCEL_AFTER_DELIVERY' | 'CANCEL_NO_DELIVERY')[] = [
    'CANCEL_AFTER_DELIVERY', 'CANCEL_AFTER_DELIVERY', 'CANCEL_NO_DELIVERY', 'CANCEL_NO_DELIVERY', 'CANCEL_NO_DELIVERY',
  ];
  const reasons = [
    'Cliente desistiu antes da retirada da moto.',
    'Documentação reprovada na análise de cadastro.',
    'Cliente não compareceu para retirar a moto.',
  ];
  let reasonIdx = 0;
  for (const role of plan) {
    const need = role === 'CANCEL_AFTER_DELIVERY' ? 6 : 4;
    const gi = shuffled.findIndex((g, i) => !picked.has(i) && g.to - g.from >= need);
    if (gi < 0) continue;
    picked.add(gi);
    const g = shuffled[gi]!;
    const startIdx = g.from + 1;
    const c = blankContract(w, g.m, startIdx, 3);
    c.status = 'CANCELLED';
    c.role = role;
    if (role === 'CANCEL_AFTER_DELIVERY') {
      const days = rng.int(2, 3);
      c.returnIdx = startIdx + days;
      c.createdIdx = startIdx;
      c.cancelReason = `Cliente desistiu após ${days} dias de uso; semana paga não reembolsada, conforme contrato.`;
    } else {
      c.delivered = false;
      c.createdIdx = g.from;
      c.startIdx = startIdx + 1;
      c.startDate = clock.ymd(c.startIdx);
      c.endDate = addDays(addMonths(c.startDate, 3), -1);
      c.cancelReason = reasons[reasonIdx++ % reasons.length] ?? null;
    }
    g.m.contracts.push(c);
    g.m.contracts.sort((a, b) => a.startIdx - b.startIdx);
    w.contracts.push(c);
  }
}

/**
 * Quilometragem dia a dia: entregador roda 90–160 km/dia (menos no domingo) —
 * ~3.300 km/mês, o que dá ~1 troca de óleo por mês e um custo de manutenção de
 * ~25% do aluguel (com 150–250 km/dia o financeiro da demonstração fechava no vermelho).
 */
export function simulateKm(w: World): void {
  const { rng, clock } = w;
  const n = clock.todayIdx + 1;
  for (const m of w.motos) {
    const dayKm = new Array<number>(n).fill(0);
    for (const c of m.contracts) {
      if (!c.delivered) continue;
      c.dailyKm = rng.int(90, 160);
      const endRide = c.status === 'ACTIVE' ? clock.todayIdx : (c.returnIdx ?? c.startIdx);
      for (let d = c.startIdx; d < endRide && d < n; d++) {
        if (rng.chance(0.05)) continue; // folga
        const sunday = weekday(clock.ymd(d)) === 0;
        dayKm[d] = (dayKm[d] ?? 0) + Math.round(c.dailyKm * (sunday ? rng.float(0.4, 0.8) : rng.float(0.8, 1.2)));
      }
    }
    const acqIdx = clock.idx(m.acquiredAt);
    const base = acqIdx < 0 ? m.acqKm + Math.round(-acqIdx * rng.int(95, 135)) : m.acqKm;
    const cum = new Array<number>(n);
    cum[0] = base;
    for (let i = 1; i < n; i++) cum[i] = (cum[i - 1] ?? 0) + (dayKm[i - 1] ?? 0);
    m.cum = cum;
  }
}
