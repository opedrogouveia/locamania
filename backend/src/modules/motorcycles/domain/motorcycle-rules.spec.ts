import { ValidationError } from '../../../shared/errors/domain-errors';
import {
  assertManualStatusChange,
  assertOdometerForward,
  assertYears,
  normalizeChassis,
  normalizeRenavam,
  normalizeValidPlate,
} from './motorcycle-rules';

describe('regras da moto', () => {
  it('placa normalizada e validada', () => {
    expect(normalizeValidPlate('abc-1234')).toBe('ABC1234');
    expect(normalizeValidPlate('bra 2e19')).toBe('BRA2E19');
    expect(() => normalizeValidPlate('AB12')).toThrow(ValidationError);
  });

  it('anos coerentes', () => {
    expect(() => assertYears(2024, 2025, 2026)).not.toThrow();
    expect(() => assertYears(2025, 2024, 2026)).toThrow('anterior');
    expect(() => assertYears(1980, null, 2026)).toThrow(ValidationError);
  });

  it('RENAVAM e chassi', () => {
    expect(normalizeRenavam('0012.345.678-9')).toBe('00123456789');
    expect(() => normalizeRenavam('123')).toThrow(ValidationError);
    expect(normalizeChassis('9c2kc1670nr000001')).toBe('9C2KC1670NR000001');
    expect(() => normalizeChassis('9C2KC1670NR00000I')).toThrow(ValidationError);
  });

  it('situação manual respeita o contrato', () => {
    expect(() => assertManualStatusChange('AVAILABLE', 'RENTED', true, null)).toThrow('contrato aberto');
    expect(() => assertManualStatusChange('MAINTENANCE', 'RENTED', true, null)).not.toThrow();
    expect(() => assertManualStatusChange('BLOCKED', 'RENTED', true, '')).toThrow('motivo');
    expect(() => assertManualStatusChange('BLOCKED', 'RENTED', true, 'Roubo')).not.toThrow();
  });

  it('quilometragem só anda para frente', () => {
    expect(() => assertOdometerForward(12000, 12500)).toThrow('menor que a atual');
    expect(() => assertOdometerForward(12600, 12500)).not.toThrow();
    expect(() => assertOdometerForward(60000, 12500)).toThrow('grande demais');
  });
});
