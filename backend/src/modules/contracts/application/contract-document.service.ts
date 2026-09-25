import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  formatCnpj,
  formatDateTime,
  formatPhone,
  formatPlate,
  formatYmd,
  SIGNATURE_METHOD_LABELS,
} from '@locamania/shared';

import { CatalogLabelsService } from '../../../shared/catalog/catalog-labels.service';
import { ParametersService } from '../../../shared/parameters/parameters.service';
import { PdfService } from '../../../shared/pdf/pdf.service';
import { ClockService } from '../../../shared/time/clock.service';
import { SettingsService } from '../../settings/application/settings.service';
import { contractTemplateValues } from '../domain/contract-rules';
import { renderContractTemplate } from '../domain/contract-template';
import { CONTRACTS_REPOSITORY, type ContractRecord, type ContractsRepository } from '../domain/contracts.ports';

function joinAddress(parts: (string | null | undefined)[]): string | null {
  const text = parts.filter((p) => p && p.trim()).join(', ');
  return text || null;
}

/**
 * Texto e PDF do contrato (§10). Enquanto não assinado, o texto é gerado do
 * modelo atual a cada pedido; ao assinar, fica **congelado** (renderedText +
 * hash SHA-256): mudar o modelo depois não altera o que o cliente aceitou.
 */
@Injectable()
export class ContractDocumentService {
  constructor(
    @Inject(CONTRACTS_REPOSITORY) private readonly repo: ContractsRepository,
    private readonly settings: SettingsService,
    private readonly params: ParametersService,
    private readonly catalog: CatalogLabelsService,
    private readonly clock: ClockService,
    private readonly pdfService: PdfService,
  ) {}

  async render(c: ContractRecord): Promise<{ text: string; hash: string }> {
    const [company, rules, label] = await Promise.all([
      this.settings.company(),
      this.params.chargeRules(),
      this.catalog.motorcycleLabel(c.motorcycle.brandCode, c.motorcycle.modelCode),
    ]);
    const values = contractTemplateValues({
      contract: {
        number: c.number,
        startDate: c.startDate,
        endDate: c.endDate,
        firstDueDate: c.firstDueDate,
        periodicity: c.periodicity,
        rentAmount: c.rentAmount,
        depositAmount: c.depositAmount,
        rules: c.rules,
        notes: c.notes,
        initialKm: c.initialKm,
      },
      customer: {
        name: c.customer.name,
        cpf: c.customer.cpf,
        rg: c.customer.rg,
        phone: c.customer.whatsapp ?? c.customer.phone,
        address: joinAddress([
          c.customer.street && `${c.customer.street}${c.customer.streetNumber ? `, ${c.customer.streetNumber}` : ''}`,
          c.customer.complement,
          c.customer.district,
          c.customer.city && `${c.customer.city}/${c.customer.state ?? ''}`,
          c.customer.postalCode && `CEP ${c.customer.postalCode.replace(/(\d{5})(\d{3})/, '$1-$2')}`,
        ]),
        cnhNumber: c.customer.cnhNumber,
        cnhCategory: c.customer.cnhCategory,
        cnhExpiresAt: c.customer.cnhExpiresAt,
      },
      motorcycle: {
        label,
        plate: c.motorcycle.plate,
        year: c.motorcycle.manufactureYear
          ? `${c.motorcycle.manufactureYear}${c.motorcycle.modelYear && c.motorcycle.modelYear !== c.motorcycle.manufactureYear ? `/${c.motorcycle.modelYear}` : ''}`
          : null,
        color: c.motorcycle.color,
        renavam: c.motorcycle.renavam,
        chassis: c.motorcycle.chassis,
        currentKm: c.motorcycle.currentKm,
      },
      company: {
        tradeName: company.tradeName,
        legalName: company.legalName,
        cnpj: company.cnpj,
        address: joinAddress([
          company.street && `${company.street}${company.streetNumber ? `, ${company.streetNumber}` : ''}`,
          company.district,
          company.city && `${company.city}/${company.state ?? ''}`,
        ]),
        city: company.city,
      },
      rules,
      today: this.clock.today(),
    });
    const text = renderContractTemplate(company.contractTemplate, values);
    return { text, hash: createHash('sha256').update(text, 'utf8').digest('hex') };
  }

  /** Texto vigente: o congelado (se assinado) ou um novo, que já fica gravado. */
  async ensureText(c: ContractRecord): Promise<{ text: string; hash: string }> {
    if (c.signatureStatus === 'SIGNED' && c.renderedText && c.documentHash) {
      return { text: c.renderedText, hash: c.documentHash };
    }
    const rendered = await this.render(c);
    if (rendered.hash !== c.documentHash) await this.repo.saveRendered(c.id, rendered.text, rendered.hash);
    return rendered;
  }

  async pdf(c: ContractRecord): Promise<Buffer> {
    const { text, hash } = await this.ensureText(c);
    const company = await this.settings.company();
    const doc = this.pdfService.create();
    const lines = text.split('\n');
    const first = lines[0]?.trim() ?? '';
    doc.header({
      companyName: company.tradeName,
      companyLine: [company.cnpj ? `CNPJ ${formatCnpj(company.cnpj)}` : null, company.phone ? formatPhone(company.phone) : null, company.email]
        .filter(Boolean)
        .join(' · '),
      title: first.startsWith('CONTRATO') ? 'Contrato de locação de motocicleta' : first,
      subtitle: `${c.number} · ${c.customer.name} · ${formatPlate(c.motorcycle.plate)}`,
    });
    for (const raw of lines.slice(first.startsWith('CONTRATO') ? 1 : 0)) {
      const line = raw.trim();
      if (!line) continue;
      if (/^CLÁUSULA/i.test(line)) doc.heading(line);
      else doc.paragraph(line);
    }
    doc.signatures([
      ['LOCADORA', company.legalName ?? company.tradeName],
      ['LOCATÁRIO(A)', c.customer.name],
    ]);
    if (c.signatureStatus === 'SIGNED' && c.signedAt) {
      doc.paragraph(
        `${SIGNATURE_METHOD_LABELS[c.signatureMethod ?? 'IN_PERSON']} em ${formatDateTime(c.signedAt)}` +
          (c.signatureIp ? ` · IP ${c.signatureIp}` : '') +
          ` · código do documento ${hash.slice(0, 16).toUpperCase()}`,
        { size: 8.5, muted: true },
      );
    } else {
      doc.paragraph(`Documento para assinatura · código ${hash.slice(0, 16).toUpperCase()} · gerado em ${formatYmd(this.clock.today())}`, {
        size: 8.5,
        muted: true,
      });
    }
    return doc.finish(`${company.tradeName} · ${c.number}`);
  }
}
