import { Inject, Injectable } from '@nestjs/common';
import { formatCpf, formatPlate, normalizePlate, onlyDigits, Permission, type SearchResultDto } from '@locamania/shared';

import { CatalogLabelsService } from '../../../shared/catalog/catalog-labels.service';
import { hasPermission, type StaffPrincipal } from '../../../shared/auth/principal';

export const SEARCH_QUERY = Symbol('SearchQuery');

export interface SearchQuery {
  customers(term: string, digits: string): Promise<{ id: string; name: string; cpf: string; phone: string | null; status: string }[]>;
  motorcycles(plate: string, modelCodes: string[]): Promise<{ id: string; plate: string; brandCode: string; modelCode: string; status: string }[]>;
  contracts(term: string): Promise<{ id: string; number: string; customerName: string; plate: string; status: string }[]>;
}

/**
 * Pesquisa rápida (§27): nome, CPF, telefone, placa, modelo e nº do contrato.
 * Placa ou número de contrato idêntico vem marcado como `exact` — a tela abre
 * a ficha direto ("ABC-1234" → ficha da moto).
 */
@Injectable()
export class SearchService {
  constructor(
    @Inject(SEARCH_QUERY) private readonly query: SearchQuery,
    private readonly catalog: CatalogLabelsService,
  ) {}

  async search(q: string, actor: StaffPrincipal): Promise<SearchResultDto[]> {
    const term = q.trim();
    if (term.length < 2) return [];
    const digits = onlyDigits(term);
    const plate = normalizePlate(term);
    const results: SearchResultDto[] = [];
    const label = await this.catalog.resolver();

    const [customers, motorcycles, contracts] = await Promise.all([
      hasPermission(actor, Permission.CUSTOMERS_VIEW) ? this.query.customers(term, digits) : Promise.resolve([]),
      hasPermission(actor, Permission.MOTORCYCLES_VIEW)
        ? this.catalog.codesMatching(['MOTORCYCLE_MODEL', 'MOTORCYCLE_BRAND'], term).then((codes) => this.query.motorcycles(plate, codes))
        : Promise.resolve([]),
      hasPermission(actor, Permission.CONTRACTS_VIEW) ? this.query.contracts(term) : Promise.resolve([]),
    ]);

    for (const m of motorcycles) {
      results.push({
        type: 'motorcycle',
        id: m.id,
        title: formatPlate(m.plate),
        subtitle: `${label('MOTORCYCLE_BRAND', m.brandCode)} ${label('MOTORCYCLE_MODEL', m.modelCode)}`,
        link: `/admin/motorcycles/${m.id}`,
        exact: plate.length === 7 && m.plate === plate,
      });
    }
    for (const c of customers) {
      results.push({
        type: 'customer',
        id: c.id,
        title: c.name,
        subtitle: `CPF ${formatCpf(c.cpf)}`,
        link: `/admin/customers/${c.id}`,
        exact: digits.length === 11 && c.cpf === digits,
      });
    }
    for (const c of contracts) {
      results.push({
        type: 'contract',
        id: c.id,
        title: c.number,
        subtitle: `${c.customerName} · ${formatPlate(c.plate)}`,
        link: `/admin/contracts/${c.id}`,
        exact: c.number.toUpperCase() === term.toUpperCase(),
      });
    }
    return results;
  }
}
