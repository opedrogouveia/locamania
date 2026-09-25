import { ValidationError } from '../../../shared/errors/domain-errors';
import { buildPixBrCode, crc16 } from './pix-brcode';
import { assertPayable, paidOnToInstant, paymentAmounts } from './payment-rules';

const RULES = { graceDays: 1, finePercent: 2, monthlyInterestPercent: 1 };

describe('baixa de pagamento', () => {
  it('não paga duas vezes nem o cancelado', () => {
    expect(() => assertPayable('PAID')).toThrow(ValidationError);
    expect(() => assertPayable('CANCELLED')).toThrow(ValidationError);
    expect(() => assertPayable('OVERDUE')).not.toThrow();
  });

  it('encargos calculados pela data do pagamento', () => {
    const r = paymentAmounts({ amount: '350.00', dueDate: '2026-10-10', paidOn: '2026-10-25', rules: RULES });
    expect(r).toEqual({ fine: '7.00', interest: '1.75', discount: '0.00', expected: '358.75' });
  });

  it('respeita multa/juros/desconto informados na tela', () => {
    const r = paymentAmounts({ amount: '350.00', dueDate: '2026-10-10', paidOn: '2026-10-25', rules: RULES, fine: '0', interest: '0', discount: '50.00' });
    expect(r.expected).toBe('300.00');
    expect(() => paymentAmounts({ amount: '10.00', dueDate: '2026-10-10', paidOn: '2026-10-10', rules: RULES, discount: '20.00' })).toThrow();
  });

  it('pagamento de dia anterior vira meio-dia em São Paulo', () => {
    const d = paidOnToInstant('2026-10-10', '2026-10-15', new Date());
    expect(d.toISOString()).toBe('2026-10-10T15:00:00.000Z');
  });
});

describe('PIX BR Code', () => {
  it('CRC16 do exemplo do Banco Central', () => {
    // Exemplo do Manual de Padrões para Iniciação do Pix (payload estático).
    const payload =
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
    expect(crc16(payload)).toBe('1D3D');
  });

  it('gera payload com valor e txid', () => {
    const code = buildPixBrCode({ key: 'sandbox@locamania.com.br', merchantName: 'Locamania', merchantCity: 'São Paulo', amount: '358.75', txid: 'PAG-000123' });
    expect(code).toContain('br.gov.bcb.pix');
    expect(code).toContain('5406358.75');
    expect(code).toContain('PAG000123');
    expect(code.slice(-8, -4)).toBe('6304');
    expect(crc16(code.slice(0, -4))).toBe(code.slice(-4));
  });
});
