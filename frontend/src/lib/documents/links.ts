import type { DocumentOwnerType } from '@locamania/shared';

/**
 * Ficha do "dono" de um documento, para o link da lista. Donos sem tela
 * própria (pagamento, devolução, manutenção) ficam sem link.
 */
export function documentOwnerHref(type: DocumentOwnerType, id: string): string | null {
  switch (type) {
    case 'CUSTOMER':
      return `/admin/customers/${id}?tab=documents`;
    case 'MOTORCYCLE':
      return `/admin/motorcycles/${id}?tab=documents`;
    case 'CONTRACT':
      return `/admin/contracts/${id}`;
    case 'OCCURRENCE':
      return `/admin/occurrences/${id}`;
    case 'FINANCIAL_ENTRY':
      return '/admin/finance';
    default:
      return null;
  }
}
