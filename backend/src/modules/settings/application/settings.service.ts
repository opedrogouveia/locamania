import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  isValidCnpj,
  normalizeText,
  onlyDigits,
  type CatalogGroup,
  type CatalogItemDto,
  type CompanySettingsDto,
  type CreateCatalogItemRequest,
  type IntegrationStatusDto,
  type MaintenanceTypeDto,
  type ParameterDto,
  type UpdateCatalogItemRequest,
  type UpdateCompanySettingsRequest,
  type UpsertMaintenanceTypeRequest,
} from '@locamania/shared';

import { CatalogLabelsService } from '../../../shared/catalog/catalog-labels.service';
import type { AppConfig } from '../../../shared/config/configuration';
import { ConflictError, ValidationError } from '../../../shared/errors/domain-errors';
import { iso } from '../../../shared/http/mappers';
import { MailService } from '../../../shared/mail/mail.service';
import { ParametersService } from '../../../shared/parameters/parameters.service';
import { CONTRACT_PLACEHOLDERS, DEFAULT_CONTRACT_TEMPLATE } from '../../contracts/domain/contract-template';
import { SETTINGS_REPOSITORY, type CatalogRecord, type CompanyRecord, type SettingsRepository } from '../domain/settings.ports';

/** "Honda CG 160 Titan" → "HONDA_CG_160_TITAN". Código estável, derivado do rótulo na criação. */
export function codeFromLabel(label: string): string {
  return normalizeText(label)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

function companyDto(c: CompanyRecord): CompanySettingsDto {
  return { ...c, updatedAt: iso(c.updatedAt) };
}

function catalogDto(c: CatalogRecord): CatalogItemDto {
  return { ...c, group: c.group as CatalogGroup };
}

@Injectable()
export class SettingsService {
  constructor(
    @Inject(SETTINGS_REPOSITORY) private readonly repo: SettingsRepository,
    private readonly parameters: ParametersService,
    private readonly mail: MailService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly labels: CatalogLabelsService,
  ) {}

  async company(): Promise<CompanySettingsDto> {
    return companyDto(await this.repo.company());
  }

  async updateCompany(input: UpdateCompanySettingsRequest): Promise<CompanySettingsDto> {
    const data = { ...input };
    if (data.cnpj !== undefined && data.cnpj !== null && data.cnpj !== '') {
      if (!isValidCnpj(data.cnpj)) throw new ValidationError('CNPJ inválido.');
      data.cnpj = onlyDigits(data.cnpj);
    }
    for (const key of ['phone', 'whatsapp', 'postalCode'] as const) {
      if (typeof data[key] === 'string') data[key] = onlyDigits(data[key]) || null;
    }
    if (data.tradeName !== undefined && !data.tradeName.trim()) throw new ValidationError('Informe o nome da empresa.');
    if (data.contractTemplate !== undefined && data.contractTemplate.trim().length < 200) {
      throw new ValidationError('O modelo do contrato parece incompleto (muito curto).');
    }
    return companyDto(await this.repo.updateCompany(data));
  }

  contractPlaceholders() {
    return CONTRACT_PLACEHOLDERS;
  }

  async restoreContractTemplate(): Promise<CompanySettingsDto> {
    return companyDto(await this.repo.updateCompany({ contractTemplate: DEFAULT_CONTRACT_TEMPLATE }));
  }

  parametersList(): Promise<ParameterDto[]> {
    return this.parameters.list();
  }

  updateParameter(key: string, value: string): Promise<ParameterDto> {
    return this.parameters.update(key, value);
  }

  async catalog(group: CatalogGroup, includeInactive = false): Promise<CatalogItemDto[]> {
    return (await this.repo.catalog(group, includeInactive)).map(catalogDto);
  }

  /** Cria item de catálogo. Do formulário ("Cadastrar 'X'") vem marcado como criado por usuário. */
  async createCatalogItem(input: CreateCatalogItemRequest, fromForm: boolean): Promise<CatalogItemDto> {
    const label = input.label.trim();
    if (!label) throw new ValidationError('Informe o nome.');
    const code = input.code ? codeFromLabel(input.code) : codeFromLabel(label);
    if (!code) throw new ValidationError('Nome inválido.');
    const existing = await this.repo.catalogByCode(input.group, code);
    if (existing) {
      if (!existing.active) {
        const reactivated = await this.repo.updateCatalogItem(existing.id, { active: true });
        this.labels.invalidate();
        return catalogDto(reactivated);
      }
      throw new ConflictError(`"${existing.label}" já existe nesta lista.`);
    }
    const sortOrder = input.sortOrder ?? (await this.repo.maxCatalogOrder(input.group)) + 10;
    const created = await this.repo.createCatalogItem({ group: input.group, code, label, sortOrder, userCreated: fromForm });
    this.labels.invalidate();
    return catalogDto(created);
  }

  async updateCatalogItem(id: string, input: UpdateCatalogItemRequest): Promise<CatalogItemDto> {
    if (input.label !== undefined && !input.label.trim()) throw new ValidationError('Informe o nome.');
    const updated = await this.repo.updateCatalogItem(id, { ...input, label: input.label?.trim() });
    this.labels.invalidate();
    return catalogDto(updated);
  }

  maintenanceTypes(includeInactive = false): Promise<MaintenanceTypeDto[]> {
    return this.repo.maintenanceTypes(includeInactive);
  }

  async createMaintenanceType(input: UpsertMaintenanceTypeRequest): Promise<MaintenanceTypeDto> {
    const code = codeFromLabel(input.name);
    if (!code) throw new ValidationError('Informe o nome do tipo de manutenção.');
    if (await this.repo.maintenanceTypeByCode(code)) throw new ConflictError('Já existe um tipo com este nome.');
    this.assertIntervals(input);
    const all = await this.repo.maintenanceTypes(true);
    return this.repo.createMaintenanceType({
      code,
      name: input.name.trim(),
      defaultIntervalKm: input.defaultIntervalKm ?? null,
      defaultIntervalDays: input.defaultIntervalDays ?? null,
      active: input.active ?? true,
      sortOrder: input.sortOrder ?? (all.reduce((m, t) => Math.max(m, t.sortOrder), 0) + 10),
    });
  }

  async updateMaintenanceType(id: string, input: Partial<UpsertMaintenanceTypeRequest>): Promise<MaintenanceTypeDto> {
    this.assertIntervals(input);
    return this.repo.updateMaintenanceType(id, { ...input, name: input.name?.trim() });
  }

  private assertIntervals(input: Partial<UpsertMaintenanceTypeRequest>): void {
    if (input.defaultIntervalKm != null && input.defaultIntervalKm <= 0) throw new ValidationError('Intervalo em km precisa ser maior que zero.');
    if (input.defaultIntervalDays != null && input.defaultIntervalDays <= 0) throw new ValidationError('Intervalo em dias precisa ser maior que zero.');
  }

  /** Situação das integrações para a tela de Configurações › Integrações. */
  integrations(): IntegrationStatusDto[] {
    const payments = this.config.get('payments', { infer: true });
    const tracker = this.config.get('tracker', { infer: true });
    return [
      {
        key: 'payments',
        label: 'Pagamento PIX (gateway)',
        provider: payments.gateway === 'sandbox' ? 'Sandbox (testes)' : 'Desligado',
        configured: payments.gateway !== 'disabled',
        sandbox: payments.gateway === 'sandbox',
        description:
          'O cliente paga pelo PIX no app e a confirmação chega sozinha pela integração. Em sandbox nenhum valor é cobrado. Para cobrar de verdade: escolher o gateway (Asaas, Mercado Pago, Efí…) e configurar as chaves.',
      },
      {
        key: 'whatsapp',
        label: 'WhatsApp',
        provider: 'Link oficial (wa.me)',
        configured: false,
        sandbox: false,
        description:
          'Hoje cada aviso e cobrança tem o botão "Enviar pelo WhatsApp", que abre a conversa com a mensagem pronta. O envio automático exige a WhatsApp Business Platform (Meta) aprovada.',
      },
      {
        key: 'email',
        label: 'E-mail',
        provider: this.mail.configured ? 'SMTP configurado' : 'Não configurado',
        configured: this.mail.configured,
        sandbox: this.config.get('nodeEnv', { infer: true }) !== 'production',
        description: 'Convites de acesso, redefinição de senha, lembretes e confirmações de pagamento.',
      },
      {
        key: 'tracker',
        label: 'Rastreador',
        provider: tracker.provider === 'sandbox' ? 'Sandbox (posições simuladas)' : 'Desligado',
        configured: tracker.provider !== 'disabled',
        sandbox: tracker.provider === 'sandbox',
        description:
          'Localização, última comunicação e bloqueio seguro. A integração real depende da API do fornecedor do rastreador e respeita as limitações do equipamento.',
      },
      {
        key: 'signature',
        label: 'Assinatura eletrônica',
        provider: 'Aceite no aplicativo',
        configured: true,
        sandbox: false,
        description:
          'O cliente aceita o contrato no app (data, IP, dispositivo e código do documento ficam registrados), ou a equipe anexa o contrato assinado em papel. Para validade jurídica reforçada: provedor como ZapSign ou Clicksign.',
      },
      {
        key: 'sentry',
        label: 'Monitoramento de erros',
        provider: process.env.SENTRY_DSN ? 'Sentry' : 'Não configurado',
        configured: !!process.env.SENTRY_DSN,
        sandbox: false,
        description: 'Avisa a equipe técnica quando algo quebra em produção, sem enviar dados pessoais.',
      },
    ];
  }
}
