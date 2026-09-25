import { ValidationError } from '../../../shared/errors/domain-errors';
import { renderContractTemplate } from './contract-template';
import { assertContractDates, chargeNumber, contractNumber, rentChargeDescription } from './contract-rules';

describe('regras do contrato', () => {
  const base = { startDate: '2026-10-01', endDate: '2027-03-31', firstDueDate: '2026-10-01', periodicity: 'WEEKLY' as const, today: '2026-09-28' };

  it('aceita datas coerentes', () => {
    expect(() => assertContractDates(base)).not.toThrow();
    expect(() => assertContractDates({ ...base, firstDueDate: '2026-10-07' })).not.toThrow();
  });

  it('recusa término antes do início e 1º vencimento fora do 1º período', () => {
    expect(() => assertContractDates({ ...base, endDate: '2026-09-30' })).toThrow(ValidationError);
    expect(() => assertContractDates({ ...base, firstDueDate: '2026-10-08' })).toThrow('1º vencimento');
    expect(() => assertContractDates({ ...base, firstDueDate: '2026-09-30' })).toThrow('1º vencimento');
  });

  it('numeração', () => {
    expect(contractNumber(12, '2026-10-01')).toBe('LOC-2026-0012');
    expect(chargeNumber(345)).toBe('PAG-000345');
    expect(rentChargeDescription(3, 'WEEKLY', 'LOC-2026-0012')).toBe('Aluguel semana 3 — LOC-2026-0012');
  });

  it('modelo: marcador sem valor vira travessão, nunca "{{...}}"', () => {
    expect(renderContractTemplate('Cliente {{cliente.nome}}, RG {{cliente.rg}}', { 'cliente.nome': 'João' })).toBe('Cliente João, RG —');
  });
});
