import { isValidPlate, normalizePlate, type MotorcycleStatus } from '@locamania/shared';

import { ValidationError } from '../../../shared/errors/domain-errors';

export function normalizeValidPlate(plate: string): string {
  const p = normalizePlate(plate);
  if (!isValidPlate(p)) throw new ValidationError('Placa inválida (ex.: ABC-1234 ou ABC1D23).');
  return p;
}

export function assertYears(manufactureYear?: number | null, modelYear?: number | null, currentYear = new Date().getFullYear()): void {
  for (const [label, y] of [['Ano de fabricação', manufactureYear], ['Ano do modelo', modelYear]] as const) {
    if (y != null && (y < 1990 || y > currentYear + 1)) throw new ValidationError(`${label} inválido.`);
  }
  if (manufactureYear != null && modelYear != null && modelYear < manufactureYear) {
    throw new ValidationError('O ano do modelo não pode ser anterior ao de fabricação.');
  }
}

/** RENAVAM tem 11 dígitos; chassi (VIN) tem 17 caracteres sem I, O e Q. */
export function normalizeRenavam(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  const d = (v ?? '').replace(/\D/g, '');
  if (d && d.length !== 11) throw new ValidationError('O RENAVAM tem 11 dígitos.');
  return d || null;
}

export function normalizeChassis(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  const c = (v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c && !/^[A-HJ-NPR-Z0-9]{17}$/.test(c)) throw new ValidationError('O chassi tem 17 caracteres (letras e números, sem I, O e Q).');
  return c || null;
}

/**
 * Situações que a equipe muda à mão. "Alugada" e "Reservada" só pelo contrato.
 * Com contrato aberto, a moto pode ir para manutenção ou ser bloqueada (roubo,
 * problema grave), mas não pode ficar "disponível" nem "inativa".
 */
export function assertManualStatusChange(
  target: MotorcycleStatus,
  current: MotorcycleStatus,
  hasOpenContract: boolean,
  reason: string | null | undefined,
): void {
  if (target === current) throw new ValidationError('A moto já está nesta situação.');
  if ((target === 'AVAILABLE' || target === 'INACTIVE') && hasOpenContract) {
    throw new ValidationError('A moto tem contrato aberto. Faça a devolução ou cancele o contrato antes.');
  }
  if ((target === 'BLOCKED' || target === 'INACTIVE') && !reason?.trim()) {
    throw new ValidationError('Informe o motivo.');
  }
}

/** Nova leitura de km não pode ser menor que a atual (erro de digitação vira manutenção errada). */
export function assertOdometerForward(km: number, currentKm: number): void {
  if (!Number.isInteger(km) || km < 0) throw new ValidationError('Quilometragem inválida.');
  if (km < currentKm) {
    throw new ValidationError(`A quilometragem não pode ser menor que a atual (${currentKm.toLocaleString('pt-BR')} km).`);
  }
  if (km - currentKm > 20000) {
    throw new ValidationError('Diferença grande demais em relação à quilometragem atual. Confira o número.');
  }
}
