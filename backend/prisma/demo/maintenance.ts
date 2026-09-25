import {
  DEFAULT_MAINTENANCE_RULES,
  maintenanceDueStatus,
  nextMaintenanceDue,
  weekday,
  type MaintenanceDueStatus,
} from '@locamania/shared';

import { type MaintenanceSim, type MotoSim, type StaffUser, type World } from './world';

/**
 * Manutenção (§7): planos por moto e 12 meses de histórico coerente com a
 * quilometragem. A troca de óleo (3.000 km) dita o ritmo das visitas; revisão,
 * pastilhas, pneus, relação e bateria entram na visita em que venceriam antes
 * da próxima. A última troca de cada moto é escolhida para chegar hoje no
 * estado desejado (em dia, próxima ou vencida) — e o plano é atualizado com
 * `nextMaintenanceDue`, a mesma regra do sistema.
 */

interface PlanDef {
  code: string;
  km: number | null;
  days: number | null;
}

interface DoneState {
  km: number | null;
  idx: number;
}

export function planDefs(m: MotoSim): PlanDef[] {
  return [
    { code: 'OIL_CHANGE', km: 3000, days: 120 },
    { code: 'SERVICE', km: 6000, days: 180 },
    { code: 'BRAKE_PADS', km: 8000, days: null },
    { code: 'TIRES', km: 12000, days: null },
    m.spec.belt ? { code: 'BELT', km: 20000, days: null } : { code: 'CHAIN_KIT', km: 15000, days: null },
    { code: 'BATTERY', km: null, days: 540 },
  ];
}

const WORKSHOPS: readonly (readonly [string, number])[] = [
  ['Oficina do Zé Motos', 35],
  ['Moto Center Itaquera', 30],
  ['Rei das Motos Tatuapé', 15],
  ['Oficina própria (galpão)', 20],
];

const REPAIRS: [string, number, number][] = [
  ['Troca do manete de embreagem', 3500, 6000],
  ['Troca da lâmpada do farol (H4)', 2500, 4500],
  ['Troca do cabo do acelerador', 4500, 8000],
  ['Troca do retentor da bengala', 12000, 18000],
  ['Troca do relé de partida', 6000, 9500],
  ['Regulagem do carburador/corpo de injeção e limpeza de bicos', 9000, 15000],
  ['Troca do pedal de câmbio', 4000, 7000],
  ['Reparo na fiação do pisca', 3000, 6000],
];

function partFor(w: World, m: MotoSim, code: string, firstRevision: boolean): { part: string; cents: number } {
  const { rng } = w;
  const c = (lo: number, hi: number) => rng.int(lo, hi) * 100;
  switch (code) {
    case 'OIL_CHANGE':
      return { part: `Óleo 4T ${m.spec.belt ? '10W-40' : '20W-50'} (${m.spec.oilLiters}) e filtro de óleo`, cents: c(60, 90) };
    case 'SERVICE':
      return firstRevision
        ? { part: 'Revisão dos 1.000 km (mão de obra na garantia)', cents: 0 }
        : {
            part: m.spec.belt
              ? 'Revisão: freios, transmissão CVT, filtro de ar, vela e parte elétrica'
              : 'Revisão: freios, embreagem, folga da corrente, filtro de ar, vela e parte elétrica',
            cents: c(180, 350),
          };
    case 'BRAKE_PADS':
      return { part: m.spec.disc ? 'Pastilhas de freio dianteiras' : 'Lonas (sapatas) de freio traseiras', cents: c(80, 150) };
    case 'TIRES':
      return rng.chance(0.7)
        ? { part: `Pneu traseiro ${m.spec.tire}`, cents: c(180, 320) }
        : { part: 'Par de pneus (dianteiro e traseiro)', cents: Math.round(c(180, 320) * 1.8) };
    case 'CHAIN_KIT':
      return { part: 'Kit relação (coroa, pinhão e corrente)', cents: c(250, 400) };
    case 'BELT':
      return { part: 'Correia de transmissão CVT e roletes', cents: c(350, 480) };
    case 'BATTERY':
      return { part: `Bateria selada 12 V ${m.spec.model === 'POP_110I' || m.spec.model === 'BIZ_125' ? '4' : '5'} Ah`, cents: c(180, 260) };
    default:
      return { part: 'Serviço avulso', cents: c(40, 120) };
  }
}

function dealer(m: MotoSim): string {
  if (m.spec.brand === 'HONDA') return 'Honda Dream Motos';
  if (m.spec.brand === 'YAMAHA') return 'Yamaha Motopoint';
  return 'Shineray Center SP';
}

export function addRecord(
  w: World,
  m: MotoSim,
  fields: Pick<MaintenanceSim, 'status' | 'types' | 'workshop'> & Partial<MaintenanceSim> & { idx: number | null },
): MaintenanceSim {
  const { clock, rng } = w;
  const createdBy: StaffUser = fields.createdBy ?? w.clerk();
  const dayIdx = fields.idx ?? clock.todayIdx;
  const createdAt = fields.createdAt ?? clock.past(clock.ymd(Math.min(dayIdx, clock.todayIdx)), rng, 8, 12);
  const rec: MaintenanceSim = {
    id: w.ids.id(),
    moto: m,
    scheduledFor: null,
    startedAt: null,
    completedAt: null,
    km: null,
    parts: null,
    costCents: null,
    notes: null,
    createdBy,
    createdAt,
    updatedAt: createdAt,
    ...fields,
  };
  w.maintenance.push(rec);
  if (rec.status === 'DONE' && fields.idx !== null) {
    rec.km = rec.km ?? m.cum[fields.idx]!;
    rec.startedAt = rec.startedAt ?? clock.ymd(fields.idx);
    rec.completedAt = clock.ymd(fields.idx);
    rec.scheduledFor = rec.scheduledFor ?? rec.startedAt;
    rec.updatedAt = clock.past(rec.completedAt, rng, 13, 18);
    if (rec.updatedAt.getTime() < rec.createdAt.getTime()) rec.updatedAt = clock.plusMinutes(rec.createdAt, 60);
    m.readings.push({
      motorcycleId: m.id,
      idx: fields.idx,
      km: rec.km,
      readAt: rec.updatedAt,
      source: 'MAINTENANCE',
      userId: createdBy.id,
      customerId: null,
      contractId: null,
      notes: null,
    });
  }
  return rec;
}

/** Dia da última troca de óleo que deixa hoje o restante (km) perto do alvo. */
function lastOilDay(w: World, m: MotoSim, s0: number, band: [number, number], target: number): number | null {
  const cur = m.currentKm;
  let best: number | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let d = m.lastReadingIdx; d >= s0; d--) {
    if (weekday(w.clock.ymd(d)) === 0) continue;
    if (w.clock.todayIdx - d > 100) break;
    const rem = 3000 - (cur - m.cum[d]!);
    if (rem < band[0] - 600) break;
    const inBand = rem >= band[0] && rem <= band[1];
    const score = Math.abs(rem - target) + (inBand ? 0 : 100_000);
    if (score < bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

/**
 * Cliente do app: a última leitura (informada por ele) fica com a km exata que
 * deixa a troca de óleo a ~250 km. Uma leitura feita à noite pode valer qualquer
 * km entre o início do dia e o do dia seguinte — basta achar o dia certo.
 */
function readingDayFor(w: World, m: MotoSim, desiredKm: number): number | null {
  const T = w.clock.todayIdx;
  const lastReading = m.readings.reduce((a, b) => (b.idx > a.idx ? b : a));
  const floor = Math.max(...m.readings.filter((r) => r !== lastReading).map((r) => r.idx)) + 1;
  for (let r = T; r >= floor; r--) {
    const lo = m.cum[r]!;
    const hi = r < T ? m.cum[r + 1]! : lo + 60;
    if (desiredKm >= lo && desiredKm <= hi) return r;
  }
  return null;
}

function calibrateLastReading(w: World, m: MotoSim, desiredKm: number): void {
  const r = readingDayFor(w, m, desiredKm);
  if (r === null) return;
  const lastReading = m.readings.reduce((a, b) => (b.idx > a.idx ? b : a));
  lastReading.idx = r;
  lastReading.km = desiredKm;
  lastReading.readAt = w.clock.past(w.clock.ymd(r), w.rng, r < w.clock.todayIdx ? 19 : 6, r < w.clock.todayIdx ? 22 : 9);
  m.lastReadingIdx = Math.max(...m.readings.map((x) => x.idx));
  m.currentKm = Math.max(...m.readings.map((x) => x.km));
}

/** Para o João: o dia de troca mais recente cuja leitura final pode cair no alvo exato. */
function joaoOilDay(w: World, m: MotoSim, s0: number, target: number): number | null {
  for (let d = m.lastReadingIdx; d >= s0 && w.clock.todayIdx - d <= 100; d--) {
    if (weekday(w.clock.ymd(d)) === 0) continue;
    if (readingDayFor(w, m, m.cum[d]! + 3000 - target) !== null) return d;
  }
  return null;
}

export function buildMaintenance(w: World): void {
  const { rng, clock } = w;
  const T = clock.todayIdx;
  const dueSoonTargets = [110, 180, 260];
  const overdueTargets = [-300, -450];

  for (const m of w.motos) {
    const acqIdx = clock.idx(m.acquiredAt);
    const s0 = m.startIdx + (acqIdx >= 0 ? 1 : 0);
    const defs = planDefs(m);

    // 1) Alvo de hoje para a troca de óleo.
    let band: [number, number] = [420, 2900];
    let target = rng.int(600, 2700);
    if (m.roles.has('JOAO')) [band, target] = [[225, 290], 250];
    else if (m.roles.has('OIL_DUE_SOON')) [band, target] = [[25, 295], dueSoonTargets.shift() ?? 150];
    else if (m.roles.has('OIL_OVERDUE')) [band, target] = [[-700, -120], overdueTargets.shift() ?? -300];
    else if (m.roles.has('SHOP_SERVICE')) [band, target] = [[60, 260], 150];

    // 2) Visitas de troca de óleo, de trás para frente.
    const visits: number[] = [];
    const joaoDay = m.roles.has('JOAO') ? joaoOilDay(w, m, s0, target) : null;
    const last = joaoDay ?? lastOilDay(w, m, s0, band, target);
    if (joaoDay !== null) calibrateLastReading(w, m, m.cum[joaoDay]! + 3000 - target);
    const cur = m.currentKm;
    if (last !== null) {
      visits.push(last);
      let d = last;
      for (;;) {
        const k = m.cum[d]! - rng.int(2650, 2980);
        let e = d - 1;
        while (e >= s0 && m.cum[e]! > k) e--;
        let prev = Math.max(e, d - rng.int(100, 115));
        if (prev < s0) break;
        if (weekday(clock.ymd(prev)) === 0 && prev - 1 >= s0) prev -= 1;
        if (prev >= d) break;
        visits.push(prev);
        d = prev;
      }
      visits.reverse();
    }
    // Primeira revisão (1.000 km) das motos compradas 0 km dentro da janela.
    let firstRevision: number | null = null;
    if (m.isNew && acqIdx >= 0 && visits.length > 0) {
      const goal = m.acqKm + rng.int(900, 1100);
      const f = m.cum.findIndex((km, i) => i >= s0 && km >= goal);
      if (f >= 0 && f < visits[0]! && m.cum[visits[0]!]! - m.cum[f]! >= 1500) {
        firstRevision = f;
        visits.unshift(f);
      }
    }

    // 3) Estado "de partida" de cada plano (antes da janela ou na compra).
    const state = new Map<string, DoneState>();
    for (const def of defs) {
      let st: DoneState;
      if (acqIdx >= 0) {
        st =
          m.isNew || def.code === 'OIL_CHANGE' || def.code === 'SERVICE'
            ? { km: def.km ? m.acqKm : null, idx: acqIdx }
            : {
                km: def.km ? Math.max(0, m.acqKm - rng.int(0, Math.round(def.km * 0.7))) : null,
                idx: acqIdx - rng.int(0, Math.round((def.days ?? 400) * 0.7)),
              };
      } else {
        const minKm = m.isNew ? m.acqKm : 0;
        st = {
          km: def.km ? Math.max(minKm, m.cum[0]! - rng.int(0, Math.round(def.km * 0.85))) : null,
          idx: Math.max(m.isNew ? acqIdx : acqIdx - 300, -rng.int(0, Math.round((def.days ?? 400) * 0.85))),
        };
        if (def.code === 'BATTERY' && m.isNew) st.idx = acqIdx;
      }
      state.set(def.code, st);
    }

    // Pastilhas vencidas de propósito: a última troca ficou 350–600 km além do limite.
    let brakeCutoff: number | null = null;
    let forcedBrake: number | null = null;
    if (m.roles.has('BRAKE_OVERDUE')) {
      brakeCutoff = cur - 8000 - rng.int(350, 600);
      forcedBrake = [...visits].reverse().find((v) => m.cum[v]! <= brakeCutoff!) ?? null;
      if (forcedBrake === null) state.set('BRAKE_PADS', { km: brakeCutoff, idx: -60 });
    }

    // 4) Tipos de cada visita + registros.
    visits.forEach((v, i) => {
      const isFirstRevision = v === firstRevision;
      const nextKm = i + 1 < visits.length ? m.cum[visits[i + 1]!]! : Math.max(cur + 400, m.cum[v]! + 3000);
      const nextIdx = i + 1 < visits.length ? visits[i + 1]! : Math.max(T + 30, v + 20);
      const types = ['OIL_CHANGE'];
      for (const def of defs) {
        if (def.code === 'OIL_CHANGE') continue;
        if (def.code === 'BATTERY' && m.roles.has('BATTERY_DUE_SOON')) continue;
        const st = state.get(def.code)!;
        let include: boolean;
        if (def.code === 'SERVICE' && isFirstRevision) include = true;
        else if (def.code === 'BRAKE_PADS' && brakeCutoff !== null) {
          include = v === forcedBrake || (m.cum[v]! <= brakeCutoff && forcedBrake !== null && v < forcedBrake && st.km !== null && st.km + 8000 < nextKm + 400);
        } else {
          const byKm = def.km !== null && st.km !== null && st.km + def.km < nextKm + 400;
          const byDate = def.days !== null && st.idx + def.days < nextIdx + 20;
          include = byKm || byDate;
        }
        if (include) {
          types.push(def.code);
          state.set(def.code, { km: m.cum[v]!, idx: v });
        }
      }
      state.set('OIL_CHANGE', { km: m.cum[v]!, idx: v });

      const parts = types.map((t) => partFor(w, m, t, isFirstRevision));
      const atDealer = isFirstRevision || (types.includes('SERVICE') && rng.chance(0.35));
      const scheduledIdx = atDealer ? Math.max(s0, v - rng.int(1, 3)) : v;
      addRecord(w, m, {
        status: 'DONE',
        idx: v,
        types,
        workshop: atDealer ? dealer(m) : rng.weighted(WORKSHOPS),
        parts: parts.map((p) => p.part).join('; '),
        costCents: parts.reduce((acc, p) => acc + p.cents, 0),
        scheduledFor: clock.ymd(scheduledIdx),
        createdAt: clock.past(clock.ymd(scheduledIdx), rng, 8, 11),
        notes: isFirstRevision
          ? 'Primeira revisão na concessionária (garantia).'
          : types.length > 2
            ? rng.pick(['Revisão completa sem pendências.', 'Cliente trouxe no horário combinado.', 'Moto com desgaste normal para a quilometragem.'])
            : rng.chance(0.3)
              ? rng.pick(['Troca preventiva.', 'Corrente lubrificada e ajustada.', 'Pneu traseiro com 40% de vida útil.', 'Pastilha dianteira na metade.'])
              : null,
      });
    });

    // 5) Consertos avulsos durante os aluguéis (~1 a cada 110 dias rodados).
    const visitSet = new Set(visits);
    const riding: number[] = [];
    for (const c of m.contracts) {
      if (!c.delivered) continue;
      const end = Math.min(c.returnIdx ?? T, m.lastReadingIdx);
      for (let d = Math.max(c.startIdx + 1, s0); d < end; d++) if (!visitSet.has(d) && weekday(clock.ymd(d)) !== 0) riding.push(d);
    }
    const repairs = Math.round(riding.length / 110);
    for (let k = 0; k < repairs && riding.length > 0; k++) {
      const d = rng.pick(riding);
      const [part, lo, hi] = rng.pick(REPAIRS);
      addRecord(w, m, {
        status: 'DONE',
        idx: d,
        types: ['OTHER'],
        workshop: rng.weighted(WORKSHOPS),
        parts: part,
        costCents: rng.int(lo / 100, hi / 100) * 100,
        notes: 'Cliente relatou o problema pelo WhatsApp e trouxe a moto no mesmo dia.',
      });
    }

    // 6) Planos com o último serviço feito.
    for (const def of defs) {
      const st = state.get(def.code)!;
      const date = clock.ymd(st.idx);
      const next = nextMaintenanceDue({ intervalKm: def.km, intervalDays: def.days }, { km: st.km, date });
      w.rows.plans.push({
        id: w.ids.id(),
        motorcycleId: m.id,
        typeId: w.maintenanceTypeIds.get(def.code)!,
        intervalKm: def.km,
        intervalDays: def.days,
        lastDoneKm: st.km,
        lastDoneAt: clock.ymdDate(date),
        nextDueKm: next.nextDueKm,
        nextDueDate: next.nextDueDate ? clock.ymdDate(next.nextDueDate) : null,
        active: m.final !== 'INACTIVE',
        createdAt: m.createdAt,
        updatedAt: st.idx >= 0 ? clock.at(date, 17, 0) : m.createdAt,
      });
    }
  }

  // 7) Motos na oficina agora e serviços agendados para os próximos dias.
  for (const m of w.motos.filter((x) => x.final === 'MAINTENANCE')) {
    const R = m.lastReadingIdx;
    const common = { status: 'IN_PROGRESS' as const, idx: R, km: m.cum[R]!, scheduledFor: clock.ymd(R), startedAt: clock.ymd(R) };
    if (m.roles.has('SHOP_SERVICE')) {
      addRecord(w, m, { ...common, types: ['SERVICE', 'OIL_CHANGE', 'TIRES'], workshop: dealer(m), parts: 'Aguardando pneu traseiro da distribuidora', notes: 'Revisão completa após a devolução; troca de óleo perto do limite.' });
      m.statusReason = 'Revisão completa após a devolução.';
    } else if (m.roles.has('SHOP_CRASH')) {
      addRecord(w, m, { ...common, types: ['OTHER', 'BRAKE_PADS'], workshop: 'Moto Center Itaquera', parts: 'Manete, pedaleira e pastilhas dianteiras', notes: 'Reparo após queda em baixa velocidade informada na devolução.' });
      m.statusReason = 'Reparo após queda (manete, pedaleira e freio).';
    } else {
      addRecord(w, m, { ...common, types: ['OTHER'], workshop: 'Oficina do Zé Motos', notes: 'Diagnóstico de ruído no motor ao acelerar (suspeita de corrente de comando).' });
      m.statusReason = 'Diagnóstico de ruído no motor.';
    }
  }
  const scheduled: [string, number, string[]][] = [];
  const dueSoon = w.motos.filter((m) => m.roles.has('OIL_DUE_SOON'));
  if (dueSoon[0]) scheduled.push([dueSoon[0].id, 1, ['OIL_CHANGE']]);
  if (dueSoon[1]) scheduled.push([dueSoon[1].id, 2, ['OIL_CHANGE']]);
  const overdue = w.motos.find((m) => m.roles.has('OIL_OVERDUE'));
  if (overdue) scheduled.push([overdue.id, 1, ['SERVICE', 'OIL_CHANGE']]);
  const battery = w.motos.find((m) => m.roles.has('BATTERY_DUE_SOON'));
  if (battery) scheduled.push([battery.id, 4, ['BATTERY']]);
  for (const [motoId, inDays, types] of scheduled) {
    const m = w.motos.find((x) => x.id === motoId)!;
    addRecord(w, m, {
      status: 'SCHEDULED',
      idx: null,
      types,
      workshop: types.includes('SERVICE') ? dealer(m) : 'Oficina do Zé Motos',
      scheduledFor: clock.rel(inDays),
      createdAt: clock.past(clock.rel(-rng.int(0, 2)), rng, 9, 17),
      notes: 'Agendado com o cliente pelo WhatsApp.',
    });
  }
}

/** Situação de hoje de cada plano ativo (para o resumo e os avisos). */
export function planStatuses(w: World): { moto: MotoSim; code: string; status: MaintenanceDueStatus; kmRemaining: number | null; daysRemaining: number | null }[] {
  const byId = new Map(w.motos.map((m) => [m.id, m]));
  const codeById = new Map([...w.maintenanceTypeIds].map(([code, id]) => [id, code]));
  return w.rows.plans
    .filter((p) => p.active)
    .map((p) => {
      const moto = byId.get(p.motorcycleId)!;
      const due = maintenanceDueStatus(
        {
          nextDueKm: p.nextDueKm ?? null,
          nextDueDate: p.nextDueDate ? (p.nextDueDate as Date).toISOString().slice(0, 10) : null,
        },
        { currentKm: moto.currentKm, today: w.clock.today, rules: DEFAULT_MAINTENANCE_RULES },
      );
      return { moto, code: codeById.get(p.typeId) ?? '?', status: due.status, kmRemaining: due.kmRemaining, daysRemaining: due.daysRemaining };
    });
}
