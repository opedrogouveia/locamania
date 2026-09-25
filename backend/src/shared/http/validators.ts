import { isValidCpf, isValidPlate, isYmd } from '@locamania/shared';
import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * Validadores de entrada usados nos DTOs HTTP, com mensagem em pt-BR (a
 * mensagem do ValidationPipe chega à tela).
 */

function make(name: string, test: (value: unknown) => boolean, message: string) {
  return (options?: ValidationOptions): PropertyDecorator =>
    (target: object, propertyName: string | symbol) =>
      registerDecorator({
        name,
        target: target.constructor,
        propertyName: propertyName as string,
        options: { message, ...options },
        validator: { validate: (value: unknown) => test(value) },
      });
}

/** Data `YYYY-MM-DD` válida. */
export const IsYmd = make('isYmd', (v) => isYmd(v), 'Data inválida (use AAAA-MM-DD).');

export const IsCpf = make('isCpf', (v) => typeof v === 'string' && isValidCpf(v), 'CPF inválido.');

export const IsPlate = make('isPlate', (v) => typeof v === 'string' && isValidPlate(v), 'Placa inválida (ex.: ABC-1234 ou ABC1D23).');

/** Valor em dinheiro: número ou string decimal (aceita vírgula). Não negativo. */
export const IsMoney = make(
  'isMoney',
  (v) => {
    if (typeof v === 'number') return Number.isFinite(v) && v >= 0 && v < 1e10;
    if (typeof v !== 'string') return false;
    const normalized = v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v;
    const n = Number(normalized);
    return v.trim() !== '' && Number.isFinite(n) && n >= 0 && n < 1e10;
  },
  'Valor inválido.',
);
