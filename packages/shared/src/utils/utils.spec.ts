import {
  formatCep,
  formatCpf,
  formatPhone,
  formatPlate,
  initials,
  isValidCnpj,
  isValidCpf,
  isValidPlate,
  maskCpf,
  normalizeText,
  whatsappLink,
} from './br';
import { addDays, addMonths, diffDays, formatYmd, isYmd, startOfWeek, todayYmd } from './dates';
import { formatBRL, fromCents, sumMoney, toCents } from './money';

describe('br', () => {
  it('CPF', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
    expect(maskCpf('52998224725')).toBe('529.***.***-25');
  });

  it('CNPJ', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-80')).toBe(false);
  });

  it('placa antiga e Mercosul', () => {
    expect(isValidPlate('abc-1234')).toBe(true);
    expect(isValidPlate('BRA2E19')).toBe(true);
    expect(isValidPlate('AB-12345')).toBe(false);
    expect(formatPlate('abc1234')).toBe('ABC-1234');
    expect(formatPlate('bra2e19')).toBe('BRA2E19');
  });

  it('máscaras e WhatsApp', () => {
    expect(formatCep('01310100')).toBe('01310-100');
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
    expect(whatsappLink('(11) 98765-4321', 'Olá')).toBe('https://wa.me/5511987654321?text=Ol%C3%A1');
    expect(whatsappLink('123')).toBeNull();
  });

  it('texto', () => {
    expect(normalizeText('  João  ')).toBe('joão'.normalize('NFD').replace(/[̀-ͯ]/g, ''));
    expect(initials('João da Silva')).toBe('JS');
  });
});

describe('dates', () => {
  it('aritmética de dias e meses', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(diffDays('2026-10-01', '2026-10-15')).toBe(14);
    expect(startOfWeek('2026-10-04')).toBe('2026-09-28'); // domingo → segunda anterior
    expect(formatYmd('2026-10-15')).toBe('15/10/2026');
    expect(isYmd('2026-02-30')).toBe(false);
  });

  it('hoje no fuso de São Paulo (23h de SP já é o dia seguinte em UTC)', () => {
    const lateNightSp = new Date('2026-10-16T02:30:00Z'); // 15/10 23:30 em SP
    expect(todayYmd('America/Sao_Paulo', lateNightSp)).toBe('2026-10-15');
  });
});

describe('money', () => {
  it('centavos sem erro de float', () => {
    expect(toCents('0.1') + toCents('0.2')).toBe(30);
    expect(toCents('R$ 1.250,50')).toBe(125050);
    expect(fromCents(125050)).toBe('1250.50');
    expect(sumMoney('10.10', 5, '0,05')).toBe('15.15');
    expect(formatBRL('1250.5').replace(/\s/g, ' ')).toBe('R$ 1.250,50');
  });
});
