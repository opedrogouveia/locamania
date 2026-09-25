import { formatYmd } from '@locamania/shared';
import type { OccurrenceStatus, OccurrenceType } from '@prisma/client';

import { markOverdue, newCharge, settle } from './billing';
import { addRecord } from './maintenance';
import { money, type ContractSim, type World } from './world';

/**
 * Ocorrências (~35): multas de trânsito (a maioria, repassadas ao cliente com
 * cobrança FINE), avarias achadas na devolução, acidentes, o roubo da moto
 * bloqueada e problemas mecânicos.
 */

const FINES: { text: string; short: string; places: string[]; cents: number }[] = [
  { text: 'Transitar em velocidade superior à máxima permitida em até 20%', short: 'excesso de velocidade', places: ['Av. Aricanduva', 'Radial Leste', 'Av. do Estado', 'Marginal Tietê'], cents: 13016 },
  { text: 'Transitar em velocidade superior à máxima permitida em mais de 20% até 50%', short: 'excesso de velocidade', places: ['Marginal Pinheiros', 'Av. Jacu-Pêssego', 'Av. dos Bandeirantes'], cents: 19523 },
  { text: 'Avançar o sinal vermelho do semáforo', short: 'avanço de sinal vermelho', places: ['Av. Sapopemba', 'Av. Ragueb Chohfi', 'Rua Vergueiro', 'Av. Santo Amaro'], cents: 29347 },
  { text: 'Estacionar em local proibido pela sinalização', short: 'estacionamento proibido', places: ['Rua Augusta', 'Rua 25 de Março', 'Rua Teodoro Sampaio'], cents: 13016 },
  { text: 'Transitar em faixa exclusiva de ônibus', short: 'faixa exclusiva de ônibus', places: ['Av. Santo Amaro', 'Av. Rebouças', 'Av. Celso Garcia'], cents: 29347 },
  { text: 'Conduzir o veículo utilizando telefone celular', short: 'uso de celular ao conduzir', places: ['Av. Paulista', 'Av. Brigadeiro Faria Lima'], cents: 29347 },
  { text: 'Estacionar sobre a calçada', short: 'estacionar na calçada', places: ['Rua Tuiuti', 'Rua Domingos de Morais'], cents: 19523 },
];

function ridingAt(w: World, idx: number): ContractSim[] {
  const T = w.clock.todayIdx;
  return w.contracts.filter(
    (c) =>
      c.delivered &&
      c.status !== 'CANCELLED' &&
      c.role !== 'JOAO' &&
      c.startIdx <= idx &&
      idx < (c.status === 'ACTIVE' ? T + 1 : (c.returnIdx ?? 0)),
  );
}

export function buildOccurrences(w: World): void {
  const { rng, clock } = w;
  const T = clock.todayIdx;
  const usedAit = new Set<string>();

  const push = (
    c: ContractSim | null,
    fields: {
      type: OccurrenceType;
      status: OccurrenceStatus;
      occurredIdx: number;
      createdAt: Date;
      description: string;
      cents: number | null;
      notes: string | null;
      fineNumber?: string;
      fineDueIdx?: number;
      motoId?: string;
    },
  ): string => {
    const id = w.ids.id();
    w.occurrences.push({
      moto: c?.moto ?? null,
      customer: c?.customer ?? null,
      createdAt: fields.createdAt,
      row: {
        id,
        type: fields.type,
        status: fields.status,
        occurredAt: clock.idxDate(fields.occurredIdx),
        motorcycleId: fields.motoId ?? c?.moto.id ?? null,
        customerId: c?.customer?.id ?? null,
        contractId: c?.id ?? null,
        description: fields.description,
        amount: fields.cents === null ? null : money(fields.cents),
        fineNumber: fields.fineNumber ?? null,
        fineDueDate: fields.fineDueIdx !== undefined ? clock.idxDate(fields.fineDueIdx) : null,
        notes: fields.notes,
        createdById: w.clerk().id,
        createdAt: fields.createdAt,
        updatedAt: fields.createdAt,
      },
    });
    return id;
  };
  const touch = (id: string, at: Date) => {
    const occ = w.occurrences.find((o) => o.row.id === id);
    if (occ && at.getTime() > (occ.row.updatedAt as Date).getTime()) occ.row.updatedAt = at;
  };

  // Multas de trânsito (22).
  const finePlan: OccurrenceStatus[] = [
    ...Array<OccurrenceStatus>(3).fill('OPEN'),
    ...Array<OccurrenceStatus>(4).fill('IN_PROGRESS'),
    ...Array<OccurrenceStatus>(14).fill('RESOLVED'),
    'CANCELLED',
  ];
  for (const status of finePlan) {
    const createdIdx =
      status === 'OPEN' ? T - rng.int(0, 6) : status === 'IN_PROGRESS' ? T - rng.int(7, 10) : status === 'RESOLVED' ? T - rng.int(16, 330) : T - rng.int(40, 200);
    let contract: ContractSim | null = null;
    let occurredIdx = 0;
    for (let attempt = 0; attempt < 20 && !contract; attempt++) {
      occurredIdx = createdIdx - rng.int(15, 40);
      const options = ridingAt(w, occurredIdx);
      if (options.length > 0) contract = rng.pick(options);
    }
    if (!contract) continue;
    const fine = rng.pick(FINES);
    let ait: string;
    do ait = `SP${rng.digits(9)}`;
    while (usedAit.has(ait));
    usedAit.add(ait);
    const createdAt = clock.past(clock.ymd(createdIdx), rng, 9, 17);
    const notes: Record<OccurrenceStatus, string> = {
      OPEN: 'Notificação de autuação recebida; aguardando a indicação do condutor.',
      IN_PROGRESS: 'Condutor indicado ao Detran; cobrança enviada ao cliente.',
      RESOLVED: 'Condutor indicado e multa repassada ao cliente (paga).',
      CANCELLED: 'Recurso deferido pela JARI — multa cancelada.',
    };
    const id = push(contract, {
      type: 'TRAFFIC_FINE',
      status,
      occurredIdx,
      createdAt,
      description: `${fine.text} — ${rng.pick(fine.places)}`,
      cents: fine.cents,
      notes: notes[status],
      fineNumber: ait,
      fineDueIdx: createdIdx + rng.int(20, 40),
    });
    if (status === 'RESOLVED' || status === 'IN_PROGRESS') {
      const chargeIdx = createdIdx + 1;
      const ch = newCharge(w, {
        customer: contract.customer!,
        contract,
        motorcycleId: contract.moto.id,
        occurrenceId: id,
        kind: 'FINE',
        description: `Multa de trânsito — ${fine.short} (AIT ${ait})`,
        dueDate: clock.ymd(chargeIdx + 10),
        amountCents: fine.cents,
        createdAt: clock.past(clock.ymd(Math.min(T, chargeIdx)), rng, 9, 17),
      });
      if (status === 'RESOLVED') {
        settle(w, ch, Math.min(T, Math.max(chargeIdx, chargeIdx + 10 + rng.int(-3, 2))));
        touch(id, ch.paidAt!);
      }
    }
  }

  // Acidentes (4).
  const accidents: [string, number, OccurrenceStatus, 'CHARGE' | 'COMPANY' | 'PENDING'][] = [
    ['Queda em baixa velocidade na Av. Ragueb Chohfi após frenagem brusca — sem feridos; manete e retrovisor danificados.', 18000, 'RESOLVED', 'CHARGE'],
    ['Colisão traseira leve em semáforo na Av. Inajar de Souza — cliente sem ferimentos; paralama e lanterna trincados.', 26000, 'RESOLVED', 'CHARGE'],
    ['Derrapagem em óleo na pista na Marginal Pinheiros — escoriações leves no cliente; carenagem lateral riscada.', 42000, 'RESOLVED', 'COMPANY'],
    ['Colisão com outra moto no corredor da Radial Leste — boletim de ocorrência registrado.', 85000, 'IN_PROGRESS', 'PENDING'],
  ];
  for (const [text, cents, status, who] of accidents) {
    let contract: ContractSim | null = null;
    let idx = 0;
    for (let attempt = 0; attempt < 20 && !contract; attempt++) {
      idx = status === 'IN_PROGRESS' ? T - rng.int(2, 6) : T - rng.int(25, 300);
      const options = ridingAt(w, idx).filter((c) => (status === 'IN_PROGRESS' ? c.status === 'ACTIVE' : true));
      if (options.length > 0) contract = rng.pick(options);
    }
    if (!contract) continue;
    const createdAt = clock.past(clock.ymd(idx), rng, 10, 20);
    const id = push(contract, {
      type: 'ACCIDENT',
      status,
      occurredIdx: idx,
      createdAt,
      description: text,
      cents,
      notes:
        who === 'CHARGE'
          ? 'Reparo feito na oficina e cobrado do cliente, conforme contrato.'
          : who === 'COMPANY'
            ? 'Reparo pago pela Locamania: óleo na pista, sem culpa do cliente.'
            : 'Cliente enviou fotos pelo WhatsApp; aguardando orçamento da oficina.',
    });
    const repairIdx = Math.min(idx + rng.int(1, 3), contract.moto.lastReadingIdx);
    if (status === 'RESOLVED' && repairIdx > idx) {
      addRecord(w, contract.moto, {
        status: 'DONE',
        idx: repairIdx,
        types: ['OTHER'],
        workshop: 'Moto Center Itaquera',
        parts: 'Reparo de avarias do acidente (peças e mão de obra)',
        costCents: cents,
        notes: `Reparo após o acidente de ${formatYmd(clock.ymd(idx))}.`,
      });
    }
    if (who === 'CHARGE') {
      const ch = newCharge(w, {
        customer: contract.customer!,
        contract,
        motorcycleId: contract.moto.id,
        occurrenceId: id,
        kind: 'DAMAGE',
        description: `Reparo de avaria (acidente em ${formatYmd(clock.ymd(idx))}) — ${contract.number}`,
        dueDate: clock.ymd(idx + 10),
        amountCents: cents,
        createdAt: clock.past(clock.ymd(idx + 3), rng, 9, 17),
      });
      settle(w, ch, Math.min(T, idx + 10 + rng.int(-2, 2)));
      touch(id, ch.paidAt!);
    }
  }

  // Avarias identificadas na vistoria de devolução (5).
  for (const c of w.contracts) {
    const dmg = c.inspection?.damage;
    if (!c.inspection || !dmg) continue;
    const returnIdx = c.returnIdx!;
    const overdue = dmg.chargeStatus === 'OVERDUE';
    const id = push(c, {
      type: 'DAMAGE',
      status: overdue ? 'IN_PROGRESS' : 'RESOLVED',
      occurredIdx: returnIdx,
      createdAt: clock.plusMinutes(c.inspection.createdAt, rng.int(5, 30)),
      description: `${dmg.description} — identificado na vistoria de devolução.`,
      cents: dmg.amountCents,
      notes:
        dmg.chargeStatus === null
          ? 'Valor descontado da caução na devolução.'
          : overdue
            ? 'Cliente não pagou o reparo; cadastro bloqueado.'
            : 'Cobrança do reparo gerada para o cliente.',
    });
    if (dmg.chargeStatus) {
      const ch = newCharge(w, {
        customer: c.customer!,
        contract: c,
        motorcycleId: c.moto.id,
        occurrenceId: id,
        kind: 'DAMAGE',
        description: `Reparo de avaria: ${dmg.description.toLowerCase()} — ${c.number}`,
        dueDate: clock.ymd(returnIdx + 7),
        amountCents: dmg.amountCents,
        createdAt: clock.plusMinutes(c.inspection.createdAt, rng.int(30, 90)),
      });
      if (overdue) markOverdue(w, ch);
      else {
        settle(w, ch, Math.min(T, returnIdx + 7 + rng.int(-3, 2)));
        touch(id, ch.paidAt!);
      }
    }
  }

  // Roubo da moto bloqueada.
  const theft = w.contracts.find((c) => c.role === 'THEFT');
  if (theft) {
    const X = theft.returnIdx!;
    push(theft, {
      type: 'THEFT',
      status: 'IN_PROGRESS',
      occurredIdx: X,
      createdAt: clock.at(clock.ymd(X), 22, 40),
      description: "Roubo à mão armada durante entrega na Estrada do M'Boi Mirim, Jardim Ângela. Cliente sem ferimentos.",
      cents: null,
      notes: `Boletim de ocorrência nº ${rng.int(1000, 9999)}/${clock.ymd(X).slice(0, 4)} registrado no 100º DP. Rastreador bloqueado preventivamente.`,
    });
  }

  // Problemas mecânicos (3).
  const mech: [string, string][] = [
    ['Moto não dava partida pela manhã — bateria descarregada.', 'Bateria testada e recarregada na oficina; sem custo para o cliente.'],
    ['Corrente escapou da coroa durante entrega na Av. Inajar de Souza.', 'Relação ajustada e corrente esticada na oficina.'],
  ];
  for (const [text, notes] of mech) {
    let contract: ContractSim | null = null;
    let idx = 0;
    for (let attempt = 0; attempt < 20 && !contract; attempt++) {
      idx = T - rng.int(20, 200);
      const options = ridingAt(w, idx);
      if (options.length > 0) contract = rng.pick(options);
    }
    if (!contract) continue;
    push(contract, { type: 'MECHANICAL_ISSUE', status: 'RESOLVED', occurredIdx: idx, createdAt: clock.past(clock.ymd(idx), rng, 7, 11), description: text, cents: null, notes });
  }
  const engine = w.motos.find((m) => m.roles.has('SHOP_ENGINE'));
  const engineContract = engine?.contracts.filter((c) => c.status === 'ENDED').at(-1);
  if (engine && engineContract) {
    const idx = engineContract.returnIdx! - 1;
    push(engineContract, {
      type: 'MECHANICAL_ISSUE',
      status: 'IN_PROGRESS',
      occurredIdx: idx,
      createdAt: clock.past(clock.ymd(idx), rng, 18, 22),
      description: 'Cliente relatou barulho anormal no motor ao acelerar.',
      cents: null,
      notes: 'Moto recolhida na devolução e encaminhada para diagnóstico na oficina.',
    });
  }
}
