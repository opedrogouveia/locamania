import { addDays, instantToYmd, isValidCpf, resolveCustomerStatus, type Ymd } from '@locamania/shared';
import type { CnhCategory } from '@prisma/client';

import {
  COMPLEMENTS,
  DISTRICTS,
  EMAIL_DOMAINS,
  FEMALE_FIRST_NAMES,
  FEMALE_MIDDLE_NAMES,
  MALE_FIRST_NAMES,
  MALE_MIDDLE_NAMES,
  METHOD_WEIGHTS,
  MOBILE_USER_AGENTS,
  SURNAME_PARTICLE,
  SURNAMES,
} from './catalog';
import { randomIp, slug, type ContractSim, type CustomerSim, type World } from './world';

/** Cliente fixo do app de demonstração (o CPF é válido). */
export const DEMO_CUSTOMER_CPF = '52998224725';
export const TOTAL_CUSTOMERS = 130;

const usedCpfs = new Set<string>([DEMO_CUSTOMER_CPF]);
const usedNames = new Set<string>();
const usedEmails = new Set<string>();

function cpf(w: World): string {
  const dv = (digits: string): number => {
    let sum = 0;
    for (let i = 0; i < digits.length; i++) sum += Number(digits[i]) * (digits.length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  for (;;) {
    const base = w.rng.digits(9);
    if (/^(\d)\1{8}$/.test(base)) continue;
    const d1 = dv(base);
    const value = `${base}${d1}${dv(base + d1)}`;
    if (!usedCpfs.has(value) && isValidCpf(value)) {
      usedCpfs.add(value);
      return value;
    }
  }
}

/** RG no padrão de SP (8 dígitos + dígito verificador, que pode ser X). */
function rg(w: World): string {
  const base = `${w.rng.int(1, 5)}${w.rng.digits(7)}`;
  const sum = [...base].reduce((acc, d, i) => acc + Number(d) * (i + 2), 0);
  const dv = 11 - (sum % 11);
  return base + (dv === 10 ? 'X' : dv === 11 ? '0' : String(dv));
}

function personName(w: World, female: boolean): string {
  const { rng } = w;
  for (;;) {
    const first = rng.pick(female ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES);
    const parts: string[] = [first];
    if (rng.chance(0.25)) {
      const middle = rng.pick(female ? FEMALE_MIDDLE_NAMES : MALE_MIDDLE_NAMES);
      if (middle !== first) parts.push(middle);
    }
    const s1 = rng.pick(SURNAMES);
    let s2 = rng.pick(SURNAMES);
    while (s2 === s1) s2 = rng.pick(SURNAMES);
    const withSecond = rng.chance(0.6);
    const last = withSecond ? s2 : s1;
    if (withSecond) parts.push(s1);
    const particle = SURNAME_PARTICLE[last];
    if (particle && rng.chance(0.5)) parts.push(particle);
    parts.push(last);
    const name = parts.join(' ');
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
}

function email(w: World, name: string, birthDate: Ymd): string {
  const tokens = slug(name, ' ')
    .split(' ')
    .filter((t) => !['da', 'das', 'de', 'do', 'dos'].includes(t));
  const first = tokens[0] ?? 'cliente';
  const last = tokens[tokens.length - 1] ?? 'demo';
  const domain = w.rng.weighted(EMAIL_DOMAINS);
  const style = w.rng.int(0, 3);
  let local =
    style === 0
      ? `${first}.${last}`
      : style === 1
        ? `${first}${last}${w.rng.int(10, 99)}`
        : style === 2
          ? `${first}_${last}`
          : `${first}.${last}${birthDate.slice(2, 4)}`;
  while (usedEmails.has(`${local}@${domain}`)) local += String(w.rng.int(0, 9));
  usedEmails.add(`${local}@${domain}`);
  return `${local}@${domain}`;
}

function mobile(w: World): string {
  return `119${w.rng.int(5, 9)}${w.rng.digits(7)}`;
}

function newCustomer(w: World, createdAt: Date): CustomerSim {
  const { rng, clock } = w;
  const female = rng.chance(0.15);
  const name = personName(w, female);
  const age = rng.int(20, 55);
  const birthDate = addDays(clock.today, -(age * 365 + rng.int(0, 364)));
  const phone = mobile(w);
  const d = rng.pick(DISTRICTS);
  const c: CustomerSim = {
    id: w.ids.id(),
    number: 0,
    name,
    female,
    cpf: cpf(w),
    rg: rg(w),
    birthDate,
    phone,
    whatsapp: rng.chance(0.9) ? phone : mobile(w),
    email: null,
    postalCode: `${d.cep}${rng.digits(3)}`,
    street: rng.pick(d.streets),
    streetNumber: String(rng.int(12, 2900)),
    complement: rng.chance(0.35) ? rng.pick(COMPLEMENTS) : null,
    district: d.district,
    city: d.city,
    state: 'SP',
    cnhNumber: `${rng.int(1, 9)}${rng.digits(10)}`,
    cnhCategory: rng.weighted<CnhCategory>([
      ['A', 70],
      ['AB', 30],
    ]),
    cnhExpiresAt: clock.rel(rng.int(90, 1800)),
    createdAt,
    contracts: [],
    busyUntil: Number.NEGATIVE_INFINITY,
    manualStatus: null,
    blockedReason: null,
    inCollection: false,
    collectionSince: null,
    notes: null,
    portalEnabled: false,
    privacyAcceptedAt: null,
    portalLastLoginAt: null,
    status: 'ACTIVE',
    overdueTarget: 0,
    preferredMethod: rng.weighted(METHOD_WEIGHTS),
    ip: randomIp(w),
    userAgent: rng.pick(MOBILE_USER_AGENTS),
  };
  c.email = rng.chance(0.8) ? email(w, name, birthDate) : null;
  w.customers.push(c);
  return c;
}

function joaoPedro(w: World, createdAt: Date): CustomerSim {
  const c = newCustomer(w, createdAt);
  Object.assign(c, {
    name: 'João Pedro da Silva',
    female: false,
    cpf: DEMO_CUSTOMER_CPF,
    rg: '345678912',
    birthDate: '1994-05-17',
    phone: '11976543210',
    whatsapp: '11976543210',
    email: 'joao.silva@email.com',
    postalCode: '08210430',
    street: 'Rua Gregório Ramalho',
    streetNumber: '412',
    complement: 'Casa 2',
    district: 'Itaquera',
    city: 'São Paulo',
    state: 'SP',
    cnhNumber: '04827365190',
    cnhCategory: 'A',
    cnhExpiresAt: w.clock.rel(980),
    notes: 'Cliente da demonstração do aplicativo. Trabalha com iFood e Rappi.',
    preferredMethod: 'PIX',
  } satisfies Partial<CustomerSim>);
  return c;
}

/**
 * Distribui os contratos entre os clientes, em ordem cronológica: renovação fica
 * com o mesmo cliente; parte dos contratos novos vai para quem já alugou antes
 * (clientes recorrentes) e o resto para cadastros novos.
 */
export function assignCustomers(w: World): void {
  const { rng, clock } = w;
  const sorted = [...w.contracts].sort(
    (a, b) => a.createdIdx - b.createdIdx || a.startIdx - b.startIdx || a.moto.index - b.moto.index,
  );
  const customerCreatedAt = (c: ContractSim): Date => {
    const idx = Math.max(0, c.createdIdx - rng.int(0, 6));
    return clock.past(clock.ymd(idx), rng, 9, 12);
  };

  for (const c of sorted) {
    let cu: CustomerSim;
    if (c.role === 'JOAO') cu = joaoPedro(w, customerCreatedAt(c));
    else if (c.renewalOf?.customer) cu = c.renewalOf.customer;
    else {
      const p = c.status === 'ACTIVE' ? 0.4 : c.status === 'DRAFT' ? 0.5 : c.status === 'CANCELLED' ? 0.05 : 0.06;
      const candidates = w.customers.filter(
        (x) => x.cpf !== DEMO_CUSTOMER_CPF && Number.isFinite(x.busyUntil) && x.busyUntil <= c.startIdx - 3,
      );
      cu = candidates.length > 0 && rng.chance(p) ? rng.pick(candidates) : newCustomer(w, customerCreatedAt(c));
    }
    c.customer = cu;
    cu.contracts.push(c);
    cu.busyUntil =
      c.status === 'ACTIVE' || c.status === 'DRAFT'
        ? Number.POSITIVE_INFINITY
        : Math.max(cu.busyUntil, c.returnIdx ?? c.startIdx);
  }

  // Cadastros sem contrato: interessados, lista de espera, reprovados.
  while (w.customers.length < TOTAL_CUSTOMERS) {
    const recent = rng.chance(0.5);
    const idx = recent ? clock.todayIdx - rng.int(0, 45) : rng.int(0, clock.todayIdx - 46);
    newCustomer(w, clock.past(clock.ymd(idx), rng, 9, 18));
  }
}

export const hasActive = (c: CustomerSim): boolean => c.contracts.some((k) => k.status === 'ACTIVE');
export const hadContract = (c: CustomerSim): boolean => c.contracts.some((k) => k.status === 'ACTIVE' || k.status === 'ENDED');
const endedOnly = (c: CustomerSim): boolean => !hasActive(c) && c.contracts.some((k) => k.status === 'ENDED') && !c.contracts.some((k) => k.status === 'DRAFT');
export const lastReturnIdx = (c: CustomerSim): number =>
  Math.max(...c.contracts.map((k) => k.returnIdx ?? Number.NEGATIVE_INFINITY));

/**
 * Marcações de cliente: acesso ao app, bloqueios e inativações manuais,
 * validade de CNH (algumas vencendo e vencidas, para os alertas) e observações.
 */
export function flagCustomers(w: World): void {
  const { rng, clock } = w;
  const T = clock.todayIdx;
  const joao = w.customers.find((c) => c.cpf === DEMO_CUSTOMER_CPF)!;
  const active = rng.shuffle(w.customers.filter((c) => hasActive(c) && c !== joao));
  const ended = rng.shuffle(w.customers.filter(endedOnly));
  const cancelledOnly = rng.shuffle(w.customers.filter((c) => c.contracts.length > 0 && c.contracts.every((k) => k.status === 'CANCELLED')));
  const noContract = rng.shuffle(w.customers.filter((c) => c.contracts.length === 0));

  // App do cliente: João + 23 com contrato ativo + 14 que já alugaram + 3 cadastros recentes.
  const portal = [joao, ...active.slice(0, 23)];
  const endedRecent = ended.filter((c) => lastReturnIdx(c) >= T - 150);
  portal.push(...endedRecent.slice(0, 14));
  portal.push(...noContract.filter((c) => c.createdAt.getTime() >= clock.at(clock.rel(-45), 0).getTime()).slice(0, 3));
  for (const c of portal) {
    c.portalEnabled = true;
    const firstStart = Math.min(...c.contracts.filter((k) => k.delivered).map((k) => k.startIdx), Number.POSITIVE_INFINITY);
    const idx = Number.isFinite(firstStart) ? Math.min(T, firstStart + rng.int(0, 2)) : Math.min(T, clock.idx(instantToYmd(c.createdAt)) + 1);
    const at = clock.past(clock.ymd(idx), rng, 12, 22);
    c.privacyAcceptedAt = at.getTime() < c.createdAt.getTime() ? clock.plusMinutes(c.createdAt, 30) : at;
  }

  // Bloqueados e inativos definidos pela administradora.
  const endedNoPortal = ended.filter((c) => !c.portalEnabled && lastReturnIdx(c) <= T - 30);
  const blocked = endedNoPortal.slice(0, 2);
  const blockReasons = [
    'Devolveu a moto com avarias e não quitou o débito.',
    'Sublocou a moto para terceiro, em desacordo com o contrato (cláusula 5.2).',
  ];
  blocked.forEach((c, i) => {
    c.manualStatus = 'BLOCKED';
    c.blockedReason = blockReasons[i] ?? null;
  });
  const inactiveReasons = [
    'Mudou-se para o interior.',
    'Comprou moto própria.',
    'Parou de trabalhar com entregas.',
    'Não tem interesse em renovar.',
    'Desistiu da locação.',
    'Desistiu da locação.',
    'Cadastro reprovado na análise.',
    'Não retornou o contato.',
  ];
  const inactive = [
    ...endedNoPortal.slice(2, 6),
    ...cancelledOnly.slice(0, 2),
    ...noContract.filter((c) => !c.portalEnabled).slice(0, 2),
  ];
  inactive.forEach((c, i) => {
    c.manualStatus = 'INACTIVE';
    c.notes = inactiveReasons[i] ?? null;
  });

  // CNH: uma vencida com contrato ativo, algumas vencendo nos próximos 30 dias.
  const activeFree = active.filter((c) => c.manualStatus === null);
  const setCnh = (c: CustomerSim | undefined, days: number) => {
    if (c) c.cnhExpiresAt = clock.rel(days);
  };
  setCnh(activeFree[activeFree.length - 1], -4);
  setCnh(activeFree[activeFree.length - 2], 9);
  setCnh(activeFree[activeFree.length - 3], 24);
  const endedFree = ended.filter((c) => c.manualStatus === null);
  setCnh(endedFree[endedFree.length - 1], 6);
  setCnh(endedFree[endedFree.length - 2], 19);
  setCnh(endedFree[endedFree.length - 3], -40);
  setCnh(endedFree[endedFree.length - 4], -95);

  const notes = [
    'Prefere contato pelo WhatsApp.',
    'Trabalha com iFood e Rappi.',
    'Indicado por outro cliente.',
    'Faz entregas para farmácia no Tatuapé.',
    'Paga sempre no PIX na segunda-feira.',
    'Trabalha à noite (entregas de restaurante).',
  ];
  for (const c of w.customers) if (c.notes === null && rng.chance(0.12)) c.notes = rng.pick(notes);

  // Número curto do cliente segue a ordem de cadastro.
  [...w.customers]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .forEach((c, i) => {
      c.number = i + 1;
    });
}

/** Situação efetiva com a mesma regra do sistema (resolveCustomerStatus). */
export function finalizeCustomerStatuses(w: World): void {
  const overdue = new Set(w.charges.filter((ch) => ch.status === 'OVERDUE').map((ch) => ch.customer.id));
  for (const c of w.customers) {
    c.status = resolveCustomerStatus({
      manualStatus: c.manualStatus,
      hasActiveContract: hasActive(c),
      hasOverdue: overdue.has(c.id),
      hadContract: hadContract(c),
    });
  }
}
