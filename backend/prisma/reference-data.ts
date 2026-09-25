import type { PrismaClient } from '@prisma/client';
import { DEFAULT_ROLE_PERMISSIONS, PARAMETER_DEFINITIONS, STAFF_ROLES } from '@locamania/shared';

import { DEFAULT_CONTRACT_TEMPLATE } from '../src/modules/contracts/domain/contract-template';

/**
 * Dados de referência — o que o sistema precisa para funcionar em qualquer
 * ambiente (produção inclusive): permissões, parâmetros, catálogos, tipos de
 * manutenção e os dados da empresa. Idempotente: só cria o que falta, nunca
 * sobrescreve o que a administradora já ajustou.
 */

export const CATALOG: Record<string, [string, string][]> = {
  MOTORCYCLE_BRAND: [
    ['HONDA', 'Honda'],
    ['YAMAHA', 'Yamaha'],
    ['SUZUKI', 'Suzuki'],
    ['SHINERAY', 'Shineray'],
    ['HAOJUE', 'Haojue'],
    ['BAJAJ', 'Bajaj'],
    ['DAFRA', 'Dafra'],
  ],
  MOTORCYCLE_MODEL: [
    ['CG_160_START', 'CG 160 Start'],
    ['CG_160_FAN', 'CG 160 Fan'],
    ['CG_160_TITAN', 'CG 160 Titan'],
    ['POP_110I', 'Pop 110i'],
    ['BIZ_125', 'Biz 125'],
    ['NXR_160_BROS', 'NXR 160 Bros'],
    ['CB_300F_TWISTER', 'CB 300F Twister'],
    ['FACTOR_150', 'Factor 150'],
    ['FAZER_FZ15', 'Fazer FZ15'],
    ['CROSSER_150', 'Crosser 150'],
    ['NMAX_160', 'NMax 160'],
    ['YES_125', 'Yes 125'],
    ['WORKER_125', 'Worker 125'],
    ['DK_160', 'DK 160'],
  ],
  DOCUMENT_TYPE: [
    ['CNH', 'CNH'],
    ['ID_DOCUMENT', 'RG / documento com foto'],
    ['PROOF_OF_ADDRESS', 'Comprovante de residência'],
    ['CONTRACT_SIGNED', 'Contrato assinado'],
    ['CRLV', 'CRLV'],
    ['LICENSING', 'Licenciamento'],
    ['IPVA', 'IPVA'],
    ['INSURANCE', 'Seguro'],
    ['INVOICE', 'Nota fiscal'],
    ['MAINTENANCE_RECEIPT', 'Comprovante de manutenção'],
    ['PAYMENT_RECEIPT', 'Comprovante de pagamento'],
    ['PHOTO_DELIVERY', 'Foto na entrega'],
    ['PHOTO_RETURN', 'Foto na devolução'],
    ['PHOTO_DAMAGE', 'Foto de avaria'],
    ['POLICE_REPORT', 'Boletim de ocorrência'],
    ['TRAFFIC_TICKET', 'Auto de infração (multa)'],
    ['OTHER', 'Outro'],
  ],
  EXPENSE_CATEGORY: [
    ['IPVA', 'IPVA'],
    ['LICENSING', 'Licenciamento'],
    ['INSURANCE', 'Seguro'],
    ['TRACKER', 'Rastreador'],
    ['TRAFFIC_FINE', 'Multa paga pela empresa'],
    ['PARTS', 'Peças e acessórios'],
    ['FUEL', 'Combustível'],
    ['RENT', 'Aluguel do espaço'],
    ['UTILITIES', 'Água, luz e internet'],
    ['SALARIES', 'Salários e pró-labore'],
    ['TAXES', 'Impostos'],
    ['MARKETING', 'Marketing'],
    ['BANK_FEES', 'Tarifas bancárias'],
    ['DEPOSIT_REFUND', 'Devolução de caução'],
    ['OTHER', 'Outras despesas'],
  ],
  INCOME_CATEGORY: [
    ['DEPOSIT_RETAINED', 'Caução retida'],
    ['MOTORCYCLE_SALE', 'Venda de moto'],
    ['INSURANCE_REFUND', 'Indenização de seguro'],
    ['OTHER', 'Outras receitas'],
  ],
};

export const MAINTENANCE_TYPES: { code: string; name: string; km: number | null; days: number | null }[] = [
  { code: 'OIL_CHANGE', name: 'Troca de óleo', km: 3000, days: 120 },
  { code: 'SERVICE', name: 'Revisão', km: 6000, days: 180 },
  { code: 'BRAKE_PADS', name: 'Pastilhas de freio', km: 8000, days: null },
  { code: 'TIRES', name: 'Pneus', km: 12000, days: null },
  { code: 'CHAIN_KIT', name: 'Relação (kit transmissão)', km: 15000, days: null },
  { code: 'BATTERY', name: 'Bateria', km: null, days: 540 },
  { code: 'AIR_FILTER', name: 'Filtro de ar', km: 10000, days: null },
  { code: 'BELT', name: 'Correia (scooter)', km: 20000, days: null },
  { code: 'OTHER', name: 'Outros serviços', km: null, days: null },
];

export async function seedReferenceData(prisma: PrismaClient): Promise<void> {
  for (const role of STAFF_ROLES) {
    await prisma.rolePermission.upsert({
      where: { role },
      create: { role, permissions: DEFAULT_ROLE_PERMISSIONS[role] },
      update: {},
    });
  }

  for (const def of PARAMETER_DEFINITIONS) {
    await prisma.appParameter.upsert({ where: { key: def.key }, create: { key: def.key, value: def.defaultValue }, update: {} });
  }

  for (const [group, items] of Object.entries(CATALOG)) {
    let order = 0;
    for (const [code, label] of items) {
      order += 10;
      await prisma.catalogItem.upsert({
        where: { group_code: { group, code } },
        create: { group, code, label, sortOrder: order },
        update: {},
      });
    }
  }

  let order = 0;
  for (const t of MAINTENANCE_TYPES) {
    order += 10;
    await prisma.maintenanceType.upsert({
      where: { code: t.code },
      create: { code: t.code, name: t.name, defaultIntervalKm: t.km, defaultIntervalDays: t.days, sortOrder: order },
      update: {},
    });
  }

  await prisma.companySettings.upsert({
    where: { id: 'company' },
    create: {
      id: 'company',
      tradeName: 'Locamania',
      legalName: 'Locamania Locação de Motos Ltda.',
      cnpj: '11222333000181',
      phone: '1133334444',
      whatsapp: '11987654321',
      email: 'contato@locamania.com.br',
      postalCode: '01310100',
      street: 'Avenida Paulista',
      streetNumber: '1000',
      district: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      pixKey: '11222333000181',
      supportHours: 'Segunda a sexta, das 8h às 18h. Sábado, das 8h às 12h.',
      contractTemplate: DEFAULT_CONTRACT_TEMPLATE,
    },
    update: {},
  });
}
