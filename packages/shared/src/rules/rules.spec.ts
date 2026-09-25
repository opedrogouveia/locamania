import { buildRentSchedule, scheduleTotal } from './schedule';
import {
  chargeDisplayStatus,
  computeLateFees,
  currentReminderOffset,
  DEFAULT_CHARGE_RULES,
  reminderMessage,
} from './charges';
import { customerMaintenanceMessage, maintenanceDueStatus, nextMaintenanceDue } from './maintenance';
import { expiryState, rentalBlockers, resolveCustomerStatus } from './customers';

describe('buildRentSchedule', () => {
  it('semanal com 4 semanas fechadas gera 4 parcelas cheias, pagas no início de cada semana', () => {
    const items = buildRentSchedule({
      startDate: '2026-10-01',
      endDate: '2026-10-28',
      periodicity: 'WEEKLY',
      amount: '350.00',
    });
    expect(items.map((i) => i.dueDate)).toEqual(['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22']);
    expect(items.every((i) => i.amount === '350.00' && !i.prorated)).toBe(true);
    expect(items[3]).toMatchObject({ periodStart: '2026-10-22', periodEnd: '2026-10-28' });
    expect(scheduleTotal(items)).toBe('1400.00');
  });

  it('última semana incompleta é proporcional aos dias', () => {
    const items = buildRentSchedule({
      startDate: '2026-10-01',
      endDate: '2026-10-10',
      periodicity: 'WEEKLY',
      amount: '350.00',
    });
    expect(items).toHaveLength(2);
    // 08 a 10 = 3 dias de 7 → 150,00
    expect(items[1]).toMatchObject({ periodStart: '2026-10-08', periodEnd: '2026-10-10', amount: '150.00', prorated: true });
  });

  it('respeita o 1º vencimento diferente do início (paga no fim da semana)', () => {
    const items = buildRentSchedule({
      startDate: '2026-10-05',
      endDate: '2026-10-18',
      firstDueDate: '2026-10-09',
      periodicity: 'WEEKLY',
      amount: '300',
    });
    expect(items.map((i) => i.dueDate)).toEqual(['2026-10-09', '2026-10-16']);
  });

  it('mensal mantém o dia e ajusta no mês curto', () => {
    const items = buildRentSchedule({
      startDate: '2026-01-31',
      endDate: '2026-04-15',
      periodicity: 'MONTHLY',
      amount: '1200.00',
    });
    expect(items.map((i) => i.dueDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    // 31/03 a 15/04 = 16 dias de um período de 30 (31/03 → 30/04)
    expect(items[2]).toMatchObject({ periodEnd: '2026-04-15', prorated: true, amount: '640.00' });
  });

  it('quinzenal', () => {
    const items = buildRentSchedule({
      startDate: '2026-10-01',
      endDate: '2026-10-28',
      periodicity: 'BIWEEKLY',
      amount: '650.00',
    });
    expect(items.map((i) => i.dueDate)).toEqual(['2026-10-01', '2026-10-15']);
  });

  it('término antes do início não gera nada', () => {
    expect(
      buildRentSchedule({ startDate: '2026-10-10', endDate: '2026-10-01', periodicity: 'WEEKLY', amount: '1' }),
    ).toEqual([]);
  });
});

describe('computeLateFees', () => {
  const rules = { graceDays: 1, finePercent: 2, monthlyInterestPercent: 1 };

  it('dentro da tolerância não cobra encargo', () => {
    const fees = computeLateFees({ amount: '350.00', dueDate: '2026-10-10', today: '2026-10-11', rules });
    expect(fees).toMatchObject({ daysLate: 1, chargeable: false, fine: '0.00', interest: '0.00', total: '350.00' });
  });

  it('depois da tolerância: multa única + juros pro rata desde o vencimento', () => {
    const fees = computeLateFees({ amount: '350.00', dueDate: '2026-10-10', today: '2026-10-25', rules });
    // multa 2% = 7,00; juros 1% a.m. × 15 dias = 350 × 0,01 × 15/30 = 1,75
    expect(fees).toMatchObject({ daysLate: 15, chargeable: true, fine: '7.00', interest: '1.75', total: '358.75' });
  });

  it('antes do vencimento não há atraso', () => {
    expect(computeLateFees({ amount: '100', dueDate: '2026-10-10', today: '2026-10-01', rules }).daysLate).toBe(0);
  });
});

describe('chargeDisplayStatus', () => {
  const rules = DEFAULT_CHARGE_RULES; // tolerância 1, próximo 3

  it.each([
    ['2026-10-20', 'UPCOMING'],
    ['2026-10-13', 'DUE_SOON'],
    ['2026-10-10', 'DUE_SOON'],
    ['2026-10-09', 'DUE_SOON'], // 1 dia depois, dentro da tolerância
    ['2026-10-08', 'OVERDUE'],
  ])('pendente vencendo em %s → %s (hoje 10/10)', (dueDate, expected) => {
    expect(chargeDisplayStatus({ status: 'PENDING', dueDate }, '2026-10-10', rules)).toBe(expected);
  });

  it('pago e cancelado não mudam com o tempo', () => {
    expect(chargeDisplayStatus({ status: 'PAID', dueDate: '2020-01-01' }, '2026-10-10', rules)).toBe('PAID');
    expect(chargeDisplayStatus({ status: 'CANCELLED', dueDate: '2020-01-01' }, '2026-10-10', rules)).toBe('CANCELLED');
  });
});

describe('currentReminderOffset', () => {
  const offsets = [7, 3, 1, 0, -1, -3];

  it.each([
    [10, null],
    [7, 7],
    [5, 7],
    [3, 3],
    [2, 3],
    [1, 1],
    [0, 0],
    [-1, -1],
    [-2, -1],
    [-3, -3],
    [-20, -3],
  ])('faltando %s dias → marco %s', (daysUntil, expected) => {
    const due = '2026-10-20';
    const today = new Date(Date.UTC(2026, 9, 20 - daysUntil)).toISOString().slice(0, 10);
    expect(currentReminderOffset(due, today, offsets)).toBe(expected);
  });

  it('mensagens do §12', () => {
    expect(reminderMessage(7)).toBe('Seu aluguel vence em 7 dias.');
    expect(reminderMessage(1)).toBe('Seu pagamento vence amanhã.');
    expect(reminderMessage(0)).toBe('Seu pagamento vence hoje.');
    expect(reminderMessage(-2)).toBe('Identificamos que seu pagamento está em atraso.');
  });
});

describe('maintenanceDueStatus', () => {
  const rules = { warnKm: 300, warnDays: 15 };

  it('exemplo do §41: 12.700 km com troca em 15.000 → 2.300 restantes, em dia', () => {
    const due = maintenanceDueStatus({ nextDueKm: 15000, nextDueDate: null }, { currentKm: 12700, today: '2026-10-01', rules });
    expect(due).toEqual({ status: 'OK', kmRemaining: 2300, daysRemaining: null, trigger: 'KM' });
  });

  it('faltando 300 km vira próxima; passou, vencida', () => {
    expect(maintenanceDueStatus({ nextDueKm: 15000, nextDueDate: null }, { currentKm: 14700, today: '2026-10-01', rules }).status).toBe('DUE_SOON');
    expect(maintenanceDueStatus({ nextDueKm: 15000, nextDueDate: null }, { currentKm: 15010, today: '2026-10-01', rules }).status).toBe('OVERDUE');
  });

  it('vale o critério que vencer primeiro (data vencida mesmo com km sobrando)', () => {
    const due = maintenanceDueStatus(
      { nextDueKm: 20000, nextDueDate: '2026-09-30' },
      { currentKm: 12000, today: '2026-10-01', rules },
    );
    expect(due).toMatchObject({ status: 'OVERDUE', trigger: 'DATE', daysRemaining: -1 });
  });

  it('próximo intervalo conta de quando o serviço foi feito', () => {
    expect(
      nextMaintenanceDue({ intervalKm: 3000, intervalDays: 180 }, { km: 15200, date: '2026-10-01' }),
    ).toEqual({ nextDueKm: 18200, nextDueDate: '2027-03-30' });
  });

  it('mensagem ao cliente não expõe dado interno', () => {
    expect(customerMaintenanceMessage({ status: 'OVERDUE', kmRemaining: -10, daysRemaining: null, trigger: 'KM' }, null)).toBe(
      'Sua moto precisa passar por manutenção. Entre em contato com a Locamania.',
    );
    expect(customerMaintenanceMessage({ status: 'OK', kmRemaining: 300, daysRemaining: null, trigger: 'KM' }, null)).toBe(
      'Faltam aproximadamente 300 km para a próxima manutenção.',
    );
    expect(customerMaintenanceMessage({ status: 'OK', kmRemaining: null, daysRemaining: 20, trigger: 'DATE' }, '2026-10-15')).toBe(
      'Revisão prevista para 15/10/2026.',
    );
  });
});

describe('resolveCustomerStatus', () => {
  const base = { manualStatus: null, hasActiveContract: false, hasOverdue: false, hadContract: false };

  it('bloqueio manual vence tudo', () => {
    expect(resolveCustomerStatus({ ...base, manualStatus: 'BLOCKED', hasOverdue: true })).toBe('BLOCKED');
  });
  it('atraso vence inativo e contrato ativo', () => {
    expect(resolveCustomerStatus({ ...base, manualStatus: 'INACTIVE', hasOverdue: true })).toBe('OVERDUE');
    expect(resolveCustomerStatus({ ...base, hasActiveContract: true, hasOverdue: true })).toBe('OVERDUE');
  });
  it('contrato ativo, encerrado e cadastro novo', () => {
    expect(resolveCustomerStatus({ ...base, hasActiveContract: true })).toBe('ACTIVE');
    expect(resolveCustomerStatus({ ...base, hadContract: true })).toBe('CONTRACT_ENDED');
    expect(resolveCustomerStatus(base)).toBe('ACTIVE');
  });
});

describe('expiryState e rentalBlockers', () => {
  it('CNH vencida, vencendo e válida', () => {
    expect(expiryState('2026-09-30', '2026-10-01', 30)).toBe('EXPIRED');
    expect(expiryState('2026-10-20', '2026-10-01', 30)).toBe('EXPIRING');
    expect(expiryState('2027-10-20', '2026-10-01', 30)).toBe('VALID');
    expect(expiryState(null, '2026-10-01', 30)).toBe('UNKNOWN');
  });

  it('impede aluguel para bloqueado, inadimplente e CNH vencida', () => {
    expect(rentalBlockers({ status: 'ACTIVE', cnhExpiresAt: '2027-01-01', today: '2026-10-01' })).toEqual([]);
    expect(rentalBlockers({ status: 'BLOCKED', cnhExpiresAt: '2026-01-01', today: '2026-10-01' })).toEqual([
      'Cliente bloqueado.',
      'CNH vencida.',
    ]);
  });
});
