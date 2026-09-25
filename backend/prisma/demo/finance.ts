import { addDays, addMonths, formatPlate, startOfMonth, type Ymd } from '@locamania/shared';
import type { FinancialEntryType, PaymentMethod } from '@prisma/client';

import { money, type World } from './world';

/**
 * Lançamentos manuais dos últimos 12 meses (§ financeiro): custos fixos do
 * galpão, folha, rastreadores, impostos, IPVA/licenciamento/seguro das motos,
 * devolução e retenção de caução e a venda da moto inativa. Manutenção não
 * entra aqui (o custo vem do próprio registro).
 */
export function buildFinance(w: World): void {
  const { rng, clock } = w;
  const inWindow = (ymd: Ymd) => ymd >= clock.start && ymd <= clock.today;
  const monthLabel = (ymd: Ymd) => `${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;

  const entry = (
    type: FinancialEntryType,
    categoryCode: string,
    description: string,
    cents: number,
    date: Ymd,
    extra: { motorcycleId?: string; customerId?: string; supplier?: string; method?: PaymentMethod } = {},
  ) => {
    if (!inWindow(date) || cents <= 0) return;
    const createdAt = clock.past(date, rng, 9, 18);
    w.rows.financial.push({
      id: w.ids.id(),
      type,
      categoryCode,
      description,
      amount: money(cents),
      date: clock.ymdDate(date),
      motorcycleId: extra.motorcycleId ?? null,
      customerId: extra.customerId ?? null,
      supplier: extra.supplier ?? null,
      method: extra.method ?? rng.weighted<PaymentMethod>([
        ['BANK_TRANSFER', 40],
        ['PIX', 35],
        ['BOLETO', 20],
        ['DEBIT_CARD', 5],
      ]),
      createdById: rng.chance(0.8) ? w.user('FINANCE').id : w.user('OWNER').id,
      createdAt,
      updatedAt: createdAt,
    });
  };
  const day = (month: Ymd, d: number): Ymd => `${month.slice(0, 7)}-${String(d).padStart(2, '0')}`;

  // Receita de aluguel por mês (base do Simples Nacional do mês seguinte).
  const rentByMonth = new Map<string, number>();
  const gatewayByMonth = new Map<string, number>();
  for (const ch of w.charges) {
    if (ch.status !== 'PAID' || !ch.paidAt || ch.kind === 'DEPOSIT') continue;
    const key = ch.paidAt.toISOString().slice(0, 7);
    rentByMonth.set(key, (rentByMonth.get(key) ?? 0) + (ch.paidCents ?? 0));
    if (ch.gatewayChargeId) gatewayByMonth.set(key, (gatewayByMonth.get(key) ?? 0) + (ch.paidCents ?? 0));
  }

  for (let month = startOfMonth(clock.start); month <= clock.today; month = addMonths(month, 1)) {
    const prev = addMonths(month, -1).slice(0, 7);
    const label = monthLabel(month);
    entry('EXPENSE', 'RENT', `Aluguel do galpão — ${label}`, 350000, day(month, 5), { supplier: 'Imobiliária Vila Formosa', method: 'BOLETO' });
    entry('EXPENSE', 'SALARIES', `Folha de pagamento da equipe — ${label}`, rng.int(6800, 7400) * 100, day(month, 5), { method: 'BANK_TRANSFER' });
    entry('EXPENSE', 'UTILITIES', `Energia elétrica (Enel) — ${label}`, rng.int(190, 320) * 100, day(month, 12), { supplier: 'Enel', method: 'BOLETO' });
    entry('EXPENSE', 'UTILITIES', `Água (Sabesp) — ${label}`, rng.int(70, 120) * 100, day(month, 15), { supplier: 'Sabesp', method: 'BOLETO' });
    entry('EXPENSE', 'UTILITIES', `Internet fibra — ${label}`, 11990, day(month, 10), { supplier: 'Vivo Fibra', method: 'DEBIT_CARD' });
    const tracked = w.motos.filter(
      (m) => (m.hasTracker || m.final === 'INACTIVE') && m.acquiredAt <= day(month, 10) && (m.soldIdx === null || clock.ymd(m.soldIdx) > day(month, 10)),
    ).length;
    entry('EXPENSE', 'TRACKER', `Mensalidade dos rastreadores — ${tracked} motos (${label})`, tracked * 3500, day(month, 10), { supplier: 'RastreiaMais Telemetria', method: 'BOLETO' });
    entry('EXPENSE', 'TAXES', `Simples Nacional (DAS) — competência ${monthLabel(`${prev}-01`)}`, Math.round((rentByMonth.get(prev) ?? 0) * 0.06), day(month, 20), { method: 'BOLETO' });
    entry('EXPENSE', 'MARKETING', `Impulsionamento no Instagram e Facebook — ${label}`, rng.int(200, 600) * 100, day(month, 8), { supplier: 'Meta Ads', method: 'CREDIT_CARD' });
    if (rng.chance(0.3)) entry('EXPENSE', 'MARKETING', 'Panfletos em pontos de apoio de entregadores', 35000, day(month, 18), { supplier: 'Gráfica Rápida Tatuapé', method: 'PIX' });
    entry('EXPENSE', 'BANK_FEES', `Tarifa do pacote PJ — ${label}`, 7990, day(month, 3), { supplier: 'Banco', method: 'DEBIT_CARD' });
    entry('EXPENSE', 'BANK_FEES', `Tarifas PIX do gateway — ${label}`, Math.round((gatewayByMonth.get(prev) ?? 0) * 0.0099), day(month, 4), { supplier: 'Gateway de pagamento', method: 'DEBIT_CARD' });
    entry('EXPENSE', 'OTHER', `Honorários contábeis — ${label}`, 45000, day(month, 7), { supplier: 'Contabilidade Leste', method: 'PIX' });
    if (rng.chance(0.5)) entry('EXPENSE', 'FUEL', 'Combustível — transporte e testes de motos', rng.int(80, 160) * 100, day(month, rng.int(11, 26)), { method: 'DEBIT_CARD' });
    if (month.slice(5, 7) === '11') entry('EXPENSE', 'SALARIES', `13º salário (1ª parcela) — ${month.slice(0, 4)}`, 350000, day(month, 28), { method: 'BANK_TRANSFER' });
    if (month.slice(5, 7) === '12') entry('EXPENSE', 'SALARIES', `13º salário (2ª parcela) — ${month.slice(0, 4)}`, 350000, day(month, 19), { method: 'BANK_TRANSFER' });
  }
  entry('EXPENSE', 'PARTS', 'Capacetes para locação (6 unidades)', 90000, clock.rel(-rng.int(200, 300)), { supplier: 'Moto Peças Radial', method: 'CREDIT_CARD' });
  entry('EXPENSE', 'PARTS', 'Baús de entrega 45 L (5 unidades)', 125000, clock.rel(-rng.int(60, 150)), { supplier: 'Moto Peças Radial', method: 'CREDIT_CARD' });

  // IPVA do ano (janeiro a março): cota única com 3% de desconto ou em 3 vezes.
  const year = Number(clock.today.slice(0, 4));
  for (const m of w.motos) {
    const plate = formatPlate(m.plate);
    const acqYear = Number(m.acquiredAt.slice(0, 4));
    const age = Math.max(0, year - m.modelYear);
    const venal = m.purchaseCents * Math.max(0.55, 1 - 0.1 * age);
    const ipva = Math.round(venal * 0.02);
    if (m.acquiredAt < `${year}-01-01`) {
      if (rng.chance(0.5)) entry('EXPENSE', 'IPVA', `IPVA ${year} (cota única) — ${plate}`, Math.round(ipva * 0.97), `${year}-01-${rng.int(12, 20)}`, { motorcycleId: m.id, method: 'PIX' });
      else for (const mm of ['01', '02', '03']) entry('EXPENSE', 'IPVA', `IPVA ${year} (parcela ${Number(mm)}/3) — ${plate}`, Math.round(ipva / 3), `${year}-${mm}-${rng.int(12, 20)}`, { motorcycleId: m.id, method: 'PIX' });
    }
    // Moto 0 km comprada dentro da janela: IPVA proporcional aos meses restantes.
    if (m.isNew && inWindow(m.acquiredAt)) {
      const remaining = 12 - Number(m.acquiredAt.slice(5, 7)) + 1;
      entry('EXPENSE', 'IPVA', `IPVA ${acqYear} proporcional (moto 0 km) — ${plate}`, Math.round((m.purchaseCents * 0.02 * remaining) / 12), addDays(m.acquiredAt, 5), { motorcycleId: m.id, method: 'PIX' });
    }
    // Licenciamento anual pelo final da placa (calendário do Detran-SP).
    const final = Number(m.plate.slice(-1));
    const licMonth = [12, 7, 7, 8, 8, 9, 9, 10, 10, 11][final] ?? 10;
    for (const y of [year - 1, year]) {
      const date = `${y}-${String(licMonth).padStart(2, '0')}-${String(rng.int(5, 15)).padStart(2, '0')}`;
      if (m.acquiredAt < date && (m.soldIdx === null || clock.ymd(m.soldIdx) > date)) {
        entry('EXPENSE', 'LICENSING', `Licenciamento ${y} — ${plate}`, 16022, date, { motorcycleId: m.id, method: 'PIX' });
      }
    }
    if (m.insurance) {
      entry('EXPENSE', 'INSURANCE', `Seguro anual (${m.insurance.insurer}) — ${plate}`, m.insurance.premiumCents, m.insurance.start, { motorcycleId: m.id, supplier: m.insurance.insurer, method: 'BOLETO' });
    }
    if (m.soldIdx !== null) {
      m.salePriceCents = Math.round((m.purchaseCents * rng.float(0.6, 0.7)) / 10000) * 10000;
      entry('INCOME', 'MOTORCYCLE_SALE', `Venda da moto ${m.spec.label} ${m.modelYear} — ${plate}`, m.salePriceCents, clock.ymd(m.soldIdx), { motorcycleId: m.id, supplier: 'Motos Seminovas Aricanduva', method: 'BANK_TRANSFER' });
      m.statusReason = `Vendida em ${clock.ymd(m.soldIdx).split('-').reverse().join('/')}.`;
    }
  }

  // Caução: devolvida (despesa) ou retida (receita) na vistoria.
  for (const c of w.contracts) {
    const insp = c.inspection;
    if (!insp || !c.depositCents) continue;
    const refundDay = addDays(insp.returnedAt, rng.int(0, 2));
    const date = refundDay > clock.today ? clock.today : refundDay;
    const extra = { motorcycleId: c.moto.id, customerId: c.customer!.id, method: 'PIX' as PaymentMethod };
    if (insp.depositOutcome === 'REFUNDED') {
      entry('EXPENSE', 'DEPOSIT_REFUND', `Devolução de caução — ${c.number}`, c.depositCents, date, extra);
    } else if (insp.depositOutcome === 'PARTIALLY_RETAINED') {
      entry('EXPENSE', 'DEPOSIT_REFUND', `Devolução parcial de caução — ${c.number}`, c.depositCents - (insp.depositRetainedCents ?? 0), date, extra);
      entry('INCOME', 'DEPOSIT_RETAINED', `Caução retida (avaria) — ${c.number}`, insp.depositRetainedCents ?? 0, insp.returnedAt, extra);
    } else if (insp.depositOutcome === 'RETAINED') {
      entry('INCOME', 'DEPOSIT_RETAINED', `Caução retida — ${c.number}`, insp.depositRetainedCents ?? c.depositCents, insp.returnedAt, extra);
    }
  }

  // Multa que a empresa pagou (prazo de indicação do condutor perdido).
  const anyMoto = w.motos[3]!;
  entry('EXPENSE', 'TRAFFIC_FINE', `Multa paga pela empresa — prazo de indicação perdido (${formatPlate(anyMoto.plate)})`, 13016, clock.rel(-rng.int(90, 200)), { motorcycleId: anyMoto.id, method: 'PIX' });
}
