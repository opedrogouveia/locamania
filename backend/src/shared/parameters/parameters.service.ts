import { Global, Injectable, Module } from '@nestjs/common';
import {
  DEFAULT_CHARGE_RULES,
  DEFAULT_MAINTENANCE_RULES,
  PARAMETER_DEFINITIONS,
  parameterDefinition,
  ParameterKey,
  parseList,
  parseNumberList,
  type ChargeRules,
  type MaintenanceAlertRules,
  type ParameterDto,
} from '@locamania/shared';

import { NotFoundError, ValidationError } from '../errors/domain-errors';
import { PrismaService } from '../prisma/prisma.service';

const TTL_MS = 30_000;

/**
 * Parâmetros de regra (tolerância, multa, avisos...). Definição e padrão em
 * `packages/shared/src/parameters.ts`; valor atual em `AppParameter`.
 * Cache curto: todo cálculo de cobrança lê daqui.
 */
@Injectable()
export class ParametersService {
  private cache: { values: Map<string, string>; at: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async values(): Promise<Map<string, string>> {
    if (this.cache && Date.now() - this.cache.at < TTL_MS) return this.cache.values;
    const rows = await this.prisma.raw.appParameter.findMany();
    const values = new Map(rows.map((r) => [r.key, r.value]));
    this.cache = { values, at: Date.now() };
    return values;
  }

  async get(key: ParameterKey): Promise<string> {
    const values = await this.values();
    return values.get(key) ?? parameterDefinition(key)?.defaultValue ?? '';
  }

  async number(key: ParameterKey): Promise<number> {
    const n = Number(await this.get(key));
    return Number.isFinite(n) ? n : Number(parameterDefinition(key)?.defaultValue ?? 0);
  }

  async bool(key: ParameterKey): Promise<boolean> {
    return (await this.get(key)) === 'true';
  }

  async chargeRules(): Promise<ChargeRules> {
    return {
      graceDays: await this.number(ParameterKey.GRACE_DAYS),
      dueSoonDays: await this.number(ParameterKey.DUE_SOON_DAYS),
      finePercent: await this.number(ParameterKey.FINE_PERCENT),
      monthlyInterestPercent: await this.number(ParameterKey.MONTHLY_INTEREST_PERCENT),
    };
  }

  async reminderOffsets(): Promise<number[]> {
    return parseNumberList(await this.get(ParameterKey.REMINDER_OFFSETS));
  }

  async maintenanceRules(): Promise<MaintenanceAlertRules> {
    return {
      warnKm: await this.number(ParameterKey.MAINTENANCE_WARN_KM),
      warnDays: await this.number(ParameterKey.MAINTENANCE_WARN_DAYS),
    };
  }

  async requiredCustomerDocuments(): Promise<string[]> {
    return parseList(await this.get(ParameterKey.REQUIRED_CUSTOMER_DOCUMENTS));
  }

  async list(): Promise<ParameterDto[]> {
    const values = await this.values();
    return PARAMETER_DEFINITIONS.map((d) => ({
      key: d.key,
      group: d.group,
      label: d.label,
      description: d.description,
      valueType: d.valueType,
      value: values.get(d.key) ?? d.defaultValue,
      defaultValue: d.defaultValue,
      min: d.min ?? null,
      max: d.max ?? null,
    }));
  }

  async update(key: string, raw: string): Promise<ParameterDto> {
    const def = parameterDefinition(key);
    if (!def) throw new NotFoundError('Parâmetro não encontrado.');
    const value = raw.trim();
    if (['number', 'percent', 'days', 'km'].includes(def.valueType)) {
      const n = Number(value.replace(',', '.'));
      if (!Number.isFinite(n)) throw new ValidationError(`"${def.label}" precisa ser um número.`);
      if (def.min !== undefined && n < def.min) throw new ValidationError(`"${def.label}" não pode ser menor que ${def.min}.`);
      if (def.max !== undefined && n > def.max) throw new ValidationError(`"${def.label}" não pode ser maior que ${def.max}.`);
    }
    if (def.valueType === 'boolean' && value !== 'true' && value !== 'false') {
      throw new ValidationError(`"${def.label}" aceita apenas sim ou não.`);
    }
    if (def.key === ParameterKey.REMINDER_OFFSETS && parseNumberList(value).length === 0) {
      throw new ValidationError('Informe ao menos um dia de aviso (ex.: 7,3,1,0,-1).');
    }
    const normalized = def.valueType === 'list' ? parseList(value).join(',') : value.replace(',', '.');
    await this.prisma.client.appParameter.upsert({
      where: { key },
      create: { key, value: normalized },
      update: { value: normalized },
    });
    this.cache = null;
    return (await this.list()).find((p) => p.key === key)!;
  }

  /** Cria os parâmetros que faltam com o valor padrão (seed/boot). */
  async ensureDefaults(): Promise<void> {
    const existing = new Set((await this.prisma.raw.appParameter.findMany({ select: { key: true } })).map((r) => r.key));
    const missing = PARAMETER_DEFINITIONS.filter((d) => !existing.has(d.key));
    if (missing.length > 0) {
      await this.prisma.raw.appParameter.createMany({ data: missing.map((d) => ({ key: d.key, value: d.defaultValue })) });
      this.cache = null;
    }
  }
}

@Global()
@Module({ providers: [ParametersService], exports: [ParametersService] })
export class ParametersModule {}

export { DEFAULT_CHARGE_RULES, DEFAULT_MAINTENANCE_RULES };
