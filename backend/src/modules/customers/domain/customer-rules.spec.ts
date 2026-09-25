import { ValidationError } from '../../../shared/errors/domain-errors';
import { cnhAllowsMotorcycle, normalizeCustomerInput } from './customer-rules';

const TODAY = '2026-09-24';

describe('normalizeCustomerInput', () => {
  it('grava só dígitos e normaliza e-mail/UF', () => {
    const out = normalizeCustomerInput(
      {
        name: '  João   da Silva ',
        cpf: '529.982.247-25',
        phone: '(11) 98765-4321',
        email: ' Joao@Email.COM ',
        postalCode: '01310-100',
        state: 'sp',
      },
      TODAY,
    );
    expect(out).toMatchObject({
      name: 'João da Silva',
      cpf: '52998224725',
      phone: '11987654321',
      email: 'joao@email.com',
      postalCode: '01310100',
      state: 'SP',
    });
  });

  it('recusa CPF inválido, menor de idade e UF inexistente', () => {
    expect(() => normalizeCustomerInput({ cpf: '111.111.111-11' }, TODAY)).toThrow(ValidationError);
    expect(() => normalizeCustomerInput({ birthDate: '2010-01-01' }, TODAY)).toThrow('18 anos');
    expect(() => normalizeCustomerInput({ state: 'XX' }, TODAY)).toThrow(ValidationError);
  });

  it('campo vazio vira nulo (limpar o dado)', () => {
    expect(normalizeCustomerInput({ email: '', phone: '' }, TODAY)).toMatchObject({ email: null, phone: null });
  });

  it('CNH de moto exige categoria A', () => {
    expect(cnhAllowsMotorcycle('A')).toBe(true);
    expect(cnhAllowsMotorcycle('AB')).toBe(true);
    expect(cnhAllowsMotorcycle('B')).toBe(false);
    expect(cnhAllowsMotorcycle(null)).toBe(false);
  });
});
