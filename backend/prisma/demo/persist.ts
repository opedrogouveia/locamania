import type { Prisma, PrismaClient } from '@prisma/client';

import { CONTRACT_RULES } from './contracts';
import { money, type World } from './world';

/** Apaga os dados de negócio, na ordem das chaves estrangeiras. Referência fica. */
export async function wipeBusinessData(prisma: PrismaClient): Promise<void> {
  await prisma.auditLog.deleteMany();
  await prisma.notificationDelivery.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.supportMessage.deleteMany();
  await prisma.trackerCommand.deleteMany();
  await prisma.trackerPosition.deleteMany();
  await prisma.gatewayEvent.deleteMany();
  await prisma.document.deleteMany();
  await prisma.financialEntry.deleteMany();
  await prisma.maintenanceRecordType.deleteMany();
  await prisma.maintenanceRecord.deleteMany();
  await prisma.maintenancePlan.deleteMany();
  await prisma.charge.deleteMany();
  await prisma.returnInspection.deleteMany();
  await prisma.occurrence.deleteMany();
  await prisma.odometerReading.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.motorcycle.deleteMany();
  await prisma.authToken.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.jobRun.deleteMany();
  await prisma.user.deleteMany();
  for (const seq of ['Customer_number_seq', 'Contract_seq_seq', 'Charge_seq_seq']) {
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE "${seq}" RESTART WITH 1`);
  }
}

async function chunked<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

const d = (w: World, ymd: string | null): Date | null => (ymd ? w.clock.ymdDate(ymd) : null);
const cents = (v: number | null | undefined): string | null => (v === null || v === undefined ? null : money(v));

export async function persist(prisma: PrismaClient, w: World): Promise<void> {
  await prisma.user.createMany({
    data: w.users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      passwordHash: w.passwordHash,
      role: u.role,
      phone: u.phone,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      updatedAt: u.lastLoginAt ?? u.createdAt,
    })),
  });

  const customers: Prisma.CustomerCreateManyInput[] = w.customers.map((c) => ({
    id: c.id,
    number: c.number,
    name: c.name,
    cpf: c.cpf,
    rg: c.rg,
    birthDate: d(w, c.birthDate),
    phone: c.phone,
    whatsapp: c.whatsapp,
    email: c.email,
    postalCode: c.postalCode,
    street: c.street,
    streetNumber: c.streetNumber,
    complement: c.complement,
    district: c.district,
    city: c.city,
    state: c.state,
    cnhNumber: c.cnhNumber,
    cnhCategory: c.cnhCategory,
    cnhExpiresAt: d(w, c.cnhExpiresAt),
    status: c.status,
    manualStatus: c.manualStatus,
    blockedReason: c.blockedReason,
    inCollection: c.inCollection,
    collectionSince: d(w, c.collectionSince),
    notes: c.notes,
    portalEnabled: c.portalEnabled,
    passwordHash: c.portalEnabled ? w.passwordHash : null,
    portalLastLoginAt: c.portalLastLoginAt,
    privacyAcceptedAt: c.privacyAcceptedAt,
    createdAt: c.createdAt,
    updatedAt: new Date(Math.max(c.createdAt.getTime(), ...c.contracts.map((k) => (k.endedAt ?? k.deliveredAt ?? k.createdAt).getTime()))),
  }));
  await chunked(customers, 500, (data) => prisma.customer.createMany({ data }));

  await prisma.motorcycle.createMany({
    data: w.motos.map((m) => ({
      id: m.id,
      brandCode: m.spec.brand,
      modelCode: m.spec.model,
      manufactureYear: m.manufactureYear,
      modelYear: m.modelYear,
      color: m.color,
      plate: m.plate,
      renavam: m.renavam,
      chassis: m.chassis,
      currentKm: m.currentKm,
      acquiredAt: d(w, m.acquiredAt),
      purchasePrice: money(m.purchaseCents),
      status: m.final,
      statusReason: m.statusReason,
      availableSince: m.availableSince,
      hasTracker: m.hasTracker,
      trackerProvider: m.hasTracker ? 'sandbox' : null,
      trackerDeviceId: m.trackerDeviceId,
      notes: m.notes,
      createdAt: m.createdAt,
      updatedAt: new Date(Math.max(m.createdAt.getTime(), ...m.readings.map((r) => r.readAt.getTime()))),
    })),
  });

  const contracts: Prisma.ContractCreateManyInput[] = w.contracts.map((c) => ({
    id: c.id,
    seq: c.seq,
    number: c.number,
    customerId: c.customer!.id,
    motorcycleId: c.moto.id,
    status: c.status,
    startDate: d(w, c.startDate)!,
    endDate: d(w, c.endDate)!,
    firstDueDate: d(w, c.startDate)!,
    periodicity: c.periodicity,
    rentAmount: money(c.rentCents),
    depositAmount: cents(c.depositCents),
    initialKm: c.delivered ? c.moto.cum[c.startIdx]! : c.status === 'DRAFT' ? c.moto.currentKm : null,
    rules: CONTRACT_RULES,
    notes: c.notes,
    renderedText: c.renderedText,
    documentHash: c.documentHash,
    signatureStatus: c.signedAt ? 'SIGNED' : 'PENDING',
    signatureMethod: c.signatureMethod,
    signedAt: c.signedAt,
    signatureIp: c.signatureIp,
    signatureUserAgent: c.signatureUserAgent,
    signedDocumentId: c.signedDocumentId,
    sentAt: c.sentAt,
    deliveredAt: c.deliveredAt,
    endedAt: c.endedAt,
    cancelledAt: c.cancelledAt,
    cancelReason: c.cancelReason,
    createdById: c.createdBy.id,
    createdAt: c.createdAt,
    updatedAt: c.endedAt ?? c.cancelledAt ?? c.reajuste?.at ?? c.deliveredAt ?? c.createdAt,
  }));
  await chunked(contracts, 500, (data) => prisma.contract.createMany({ data }));

  await prisma.returnInspection.createMany({
    data: w.contracts
      .filter((c) => c.inspection)
      .map((c) => {
        const i = c.inspection!;
        return {
          id: i.id,
          contractId: c.id,
          returnedAt: d(w, i.returnedAt)!,
          finalKm: i.finalKm,
          condition: i.condition,
          fuelLevel: i.fuelLevel,
          damages: i.damages,
          pendingItems: i.pendingItems,
          nextMotorcycleStatus: i.nextMotorcycleStatus,
          depositOutcome: i.depositOutcome,
          depositRetainedAmount: cents(i.depositRetainedCents),
          notes: i.notes,
          createdById: i.createdBy.id,
          createdAt: i.createdAt,
          updatedAt: i.createdAt,
        };
      }),
  });

  await prisma.occurrence.createMany({ data: w.occurrences.map((o) => o.row) });

  const charges: Prisma.ChargeCreateManyInput[] = w.charges.map((ch) => ({
    id: ch.id,
    seq: ch.seq,
    number: ch.number,
    customerId: ch.customer.id,
    contractId: ch.contract?.id ?? null,
    motorcycleId: ch.motorcycleId,
    occurrenceId: ch.occurrenceId,
    kind: ch.kind,
    sequence: ch.sequence,
    description: ch.description,
    periodStart: d(w, ch.periodStart),
    periodEnd: d(w, ch.periodEnd),
    dueDate: d(w, ch.dueDate)!,
    amount: money(ch.amountCents),
    status: ch.status,
    paidAt: ch.paidAt,
    paidAmount: cents(ch.paidCents),
    fineAmount: cents(ch.fineCents),
    interestAmount: cents(ch.interestCents),
    method: ch.method,
    notes: ch.notes,
    registeredById: ch.registeredBy?.id ?? null,
    cancelReason: ch.cancelReason,
    gatewayProvider: ch.gatewayChargeId ? 'sandbox' : null,
    gatewayChargeId: ch.gatewayChargeId,
    gatewayPaidAt: ch.gatewayChargeId ? ch.paidAt : null,
    createdAt: ch.createdAt,
    updatedAt: ch.updatedAt,
  }));
  await chunked(charges, 1000, (data) => prisma.charge.createMany({ data }));

  const readings: Prisma.OdometerReadingCreateManyInput[] = w.motos.flatMap((m) =>
    m.readings.map((r) => ({
      id: w.ids.id(),
      motorcycleId: r.motorcycleId,
      km: r.km,
      readAt: r.readAt,
      source: r.source,
      userId: r.userId,
      customerId: r.customerId,
      contractId: r.contractId,
      notes: r.notes,
      createdAt: r.readAt,
    })),
  );
  await chunked(readings, 1000, (data) => prisma.odometerReading.createMany({ data }));

  await chunked(w.rows.plans, 1000, (data) => prisma.maintenancePlan.createMany({ data }));
  const records: Prisma.MaintenanceRecordCreateManyInput[] = w.maintenance.map((r) => ({
    id: r.id,
    motorcycleId: r.moto.id,
    status: r.status,
    scheduledFor: d(w, r.scheduledFor),
    startedAt: d(w, r.startedAt),
    completedAt: d(w, r.completedAt),
    km: r.km,
    workshop: r.workshop,
    parts: r.parts,
    cost: cents(r.costCents),
    notes: r.notes,
    createdById: r.createdBy.id,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
  await chunked(records, 1000, (data) => prisma.maintenanceRecord.createMany({ data }));
  const recordTypes = w.maintenance.flatMap((r) => [...new Set(r.types)].map((code) => ({ recordId: r.id, typeId: w.maintenanceTypeIds.get(code)! })));
  await chunked(recordTypes, 2000, (data) => prisma.maintenanceRecordType.createMany({ data }));

  await chunked(w.rows.documents, 100, (data) => prisma.document.createMany({ data }));
  await chunked(w.rows.financial, 1000, (data) => prisma.financialEntry.createMany({ data }));
  await chunked(w.rows.positions, 1000, (data) => prisma.trackerPosition.createMany({ data }));
  await prisma.trackerCommand.createMany({ data: w.rows.commands });
  await chunked(w.rows.gatewayEvents, 500, (data) => prisma.gatewayEvent.createMany({ data }));
  await chunked(w.rows.notifications, 1000, (data) => prisma.notification.createMany({ data }));
  await chunked(w.rows.deliveries, 1000, (data) => prisma.notificationDelivery.createMany({ data }));
  await prisma.announcement.createMany({ data: w.rows.announcements });
  await prisma.supportMessage.createMany({ data: w.rows.support });
  await chunked(w.rows.audit, 1000, (data) => prisma.auditLog.createMany({ data }));
  await prisma.jobRun.createMany({ data: w.rows.jobRuns });

  // Números e sequências foram gravados explicitamente: as sequences seguem do maior.
  for (const [seq, table, column] of [
    ['Customer_number_seq', 'Customer', 'number'],
    ['Contract_seq_seq', 'Contract', 'seq'],
    ['Charge_seq_seq', 'Charge', 'seq'],
  ] as const) {
    await prisma.$queryRawUnsafe(`SELECT setval('"${seq}"', GREATEST((SELECT MAX("${column}") FROM "${table}"), 1))`);
  }
}
