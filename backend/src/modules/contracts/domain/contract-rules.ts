import {
  addDays,
  addMonths,
  diffDays,
  formatBRL,
  formatCnpj,
  formatCpf,
  formatKm,
  formatPercent,
  formatPhone,
  formatPlate,
  formatYmd,
  PERIODICITY_LABELS,
  PERIODICITY_UNIT,
  type PaymentPeriodicity,
  type Ymd,
} from '@locamania/shared';

import { ValidationError } from '../../../shared/errors/domain-errors';

/** Datas do contrato: término depois do início; 1º vencimento dentro do 1º período. */
export function assertContractDates(input: { startDate: Ymd; endDate: Ymd; firstDueDate: Ymd; periodicity: PaymentPeriodicity; today: Ymd }): void {
  if (input.endDate <= input.startDate) throw new ValidationError('A data de término precisa ser depois do início.');
  if (diffDays(input.startDate, input.endDate) > 366 * 3) throw new ValidationError('O contrato pode ter no máximo 3 anos.');
  if (diffDays(input.startDate, input.today) > 60) {
    throw new ValidationError('O início não pode ser mais de 60 dias no passado.');
  }
  const firstPeriodEnd =
    input.periodicity === 'MONTHLY'
      ? addDays(addMonths(input.startDate, 1), -1)
      : addDays(input.startDate, input.periodicity === 'WEEKLY' ? 6 : 13);
  if (input.firstDueDate < input.startDate || input.firstDueDate > firstPeriodEnd) {
    throw new ValidationError('O 1º vencimento precisa estar dentro do primeiro período do aluguel.');
  }
}

export function assertPositiveMoney(value: string | null, label: string): void {
  if (value === null || Number(value) <= 0) throw new ValidationError(`Informe ${label}.`);
}

export interface TemplateInputs {
  contract: {
    number: string;
    startDate: Ymd;
    endDate: Ymd;
    firstDueDate: Ymd;
    periodicity: PaymentPeriodicity;
    rentAmount: string;
    depositAmount: string | null;
    rules: string | null;
    notes: string | null;
    initialKm: number | null;
  };
  customer: {
    name: string;
    cpf: string;
    rg: string | null;
    phone: string | null;
    address: string | null;
    cnhNumber: string | null;
    cnhCategory: string | null;
    cnhExpiresAt: Ymd | null;
  };
  motorcycle: {
    label: string;
    plate: string;
    year: string | null;
    color: string | null;
    renavam: string | null;
    chassis: string | null;
    currentKm: number;
  };
  company: {
    tradeName: string;
    legalName: string | null;
    cnpj: string | null;
    address: string | null;
    city: string | null;
  };
  rules: { graceDays: number; finePercent: number; monthlyInterestPercent: number };
  today: Ymd;
}

/** Valores dos marcadores `{{...}}` do modelo de contrato. */
export function contractTemplateValues(i: TemplateInputs): Record<string, string> {
  const km = i.contract.initialKm ?? i.motorcycle.currentKm;
  return {
    'contrato.numero': i.contract.number,
    'contrato.inicio': formatYmd(i.contract.startDate),
    'contrato.termino': formatYmd(i.contract.endDate),
    'contrato.valor': formatBRL(i.contract.rentAmount),
    'contrato.periodo': PERIODICITY_UNIT[i.contract.periodicity],
    'contrato.periodicidade': PERIODICITY_LABELS[i.contract.periodicity].toLowerCase(),
    'contrato.primeiroVencimento': formatYmd(i.contract.firstDueDate),
    'contrato.caucao': i.contract.depositAmount ? formatBRL(i.contract.depositAmount) : 'R$ 0,00 (sem caução)',
    'contrato.regras': i.contract.rules?.trim() || 'Não há regras específicas além das cláusulas deste contrato.',
    'contrato.observacoes': i.contract.notes?.trim() || 'Nenhuma.',
    'cliente.nome': i.customer.name,
    'cliente.cpf': formatCpf(i.customer.cpf),
    'cliente.rg': i.customer.rg ?? '',
    'cliente.endereco': i.customer.address ?? '',
    'cliente.telefone': i.customer.phone ? formatPhone(i.customer.phone) : '',
    'cliente.cnh': i.customer.cnhNumber ?? '',
    'cliente.cnhCategoria': i.customer.cnhCategory ?? '',
    'cliente.cnhValidade': i.customer.cnhExpiresAt ? formatYmd(i.customer.cnhExpiresAt) : '',
    'moto.descricao': i.motorcycle.label,
    'moto.placa': formatPlate(i.motorcycle.plate),
    'moto.ano': i.motorcycle.year ?? '',
    'moto.cor': i.motorcycle.color ?? '',
    'moto.renavam': i.motorcycle.renavam ?? '',
    'moto.chassi': i.motorcycle.chassis ?? '',
    'moto.kmInicial': formatKm(km),
    'regras.tolerancia': String(i.rules.graceDays),
    'regras.multa': formatPercent(i.rules.finePercent),
    'regras.juros': formatPercent(i.rules.monthlyInterestPercent),
    'empresa.nome': i.company.tradeName,
    'empresa.razaoSocial': i.company.legalName ?? i.company.tradeName,
    'empresa.cnpj': i.company.cnpj ? formatCnpj(i.company.cnpj) : '',
    'empresa.endereco': i.company.address ?? '',
    'empresa.cidade': i.company.city ?? '',
    'data.hoje': formatYmd(i.today),
  };
}

/** "LOC-2026-0012" a partir do sequencial e do ano do início. */
export function contractNumber(seq: number, startDate: Ymd): string {
  return `LOC-${startDate.slice(0, 4)}-${String(seq).padStart(4, '0')}`;
}

export function chargeNumber(seq: number): string {
  return `PAG-${String(seq).padStart(6, '0')}`;
}

/** "Aluguel semana 3 — LOC-2026-0012". */
export function rentChargeDescription(sequence: number, periodicity: PaymentPeriodicity, contractNumberValue: string): string {
  const unit = periodicity === 'WEEKLY' ? 'semana' : periodicity === 'BIWEEKLY' ? 'quinzena' : 'mês';
  return `Aluguel ${unit} ${sequence} — ${contractNumberValue}`;
}
