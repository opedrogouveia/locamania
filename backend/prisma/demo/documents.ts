import { formatPlate, instantToYmd, type Ymd } from '@locamania/shared';
import type { DocumentOwnerType } from '@prisma/client';
import PDFDocument from 'pdfkit';

import { CATALOG } from '../reference-data';
import { DEMO_CUSTOMER_CPF, hasActive } from './customers';
import { slug, type World } from './world';

/**
 * Documentos anexados (§ documentos). Um PDF pequeno por tipo, gerado com
 * pdfkit e reaproveitado em todos os anexos daquele tipo — a seed não fica
 * pesada e o download funciona de verdade.
 */

const DOC_LABELS = new Map(CATALOG.DOCUMENT_TYPE!.map(([code, label]) => [code, label]));

async function pdf(typeLabel: string): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 56,
    compress: true,
    info: { Title: `Documento de demonstração — ${typeLabel}`, Producer: 'Locamania', Creator: 'Locamania (seed de demonstração)', CreationDate: new Date(Date.UTC(2026, 0, 1)) },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve) => {
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
  doc.fillColor('#1d4ed8').font('Helvetica-Bold').fontSize(18).text('Locamania');
  doc.moveDown(0.8);
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(14).text(`Documento de demonstração — ${typeLabel} — Locamania (dados fictícios)`);
  doc.moveDown(0.6);
  doc
    .fillColor('#6b7280')
    .font('Helvetica')
    .fontSize(10)
    .text('Arquivo ilustrativo gerado pela seed de demonstração. Não é um documento real e não tem validade.');
  doc.end();
  return done;
}

/** Um arquivo por tipo de documento, reaproveitado em todos os anexos daquele tipo. */
export async function makePdfs(): Promise<Map<string, Uint8Array<ArrayBuffer>>> {
  const out = new Map<string, Uint8Array<ArrayBuffer>>();
  for (const [code, label] of DOC_LABELS) {
    const buf = await pdf(label);
    out.set(code, new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length)) as Uint8Array<ArrayBuffer>);
  }
  return out;
}

export function buildDocuments(w: World, pdfs: Map<string, Uint8Array<ArrayBuffer>>): void {
  const { rng, clock } = w;
  const T = clock.todayIdx;

  const add = (d: {
    ownerType: DocumentOwnerType;
    ownerId: string;
    typeCode: string;
    title: string;
    fileSlug: string;
    createdAt: Date;
    expiresAt?: Ymd | null;
    visibleToCustomer?: boolean;
    uploadedById?: string | null;
    uploadedByCustomerId?: string | null;
    notes?: string | null;
  }): string => {
    const data = pdfs.get(d.typeCode) ?? pdfs.get('OTHER')!;
    const id = w.ids.id();
    w.rows.documents.push({
      id,
      ownerType: d.ownerType,
      ownerId: d.ownerId,
      typeCode: d.typeCode,
      title: d.title,
      fileName: `${slug(d.fileSlug)}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: data.length,
      data,
      expiresAt: d.expiresAt ? clock.ymdDate(d.expiresAt) : null,
      visibleToCustomer: d.visibleToCustomer ?? false,
      notes: d.notes ?? null,
      uploadedById: d.uploadedByCustomerId ? null : (d.uploadedById ?? w.clerk().id),
      uploadedByCustomerId: d.uploadedByCustomerId ?? null,
      createdAt: d.createdAt,
      updatedAt: d.createdAt,
    });
    return id;
  };

  // Clientes: CNH, documento com foto e comprovante (alguns sem comprovante = pendência).
  const withContract = w.customers.filter((c) => c.contracts.length > 0);
  const activeCustomers = rng.shuffle(withContract.filter((c) => hasActive(c) && c.cpf !== DEMO_CUSTOMER_CPF));
  const missingProof = new Set([...activeCustomers.slice(0, 3), ...rng.shuffle(withContract.filter((c) => !hasActive(c))).slice(0, 5)]);
  for (const c of w.customers) {
    const at = clock.plusMinutes(c.createdAt, rng.int(5, 40));
    const full = c.contracts.length > 0;
    if (full || rng.chance(0.6)) {
      add({ ownerType: 'CUSTOMER', ownerId: c.id, typeCode: 'CNH', title: `CNH — ${c.name}`, fileSlug: `cnh ${c.name}`, createdAt: at, expiresAt: c.cnhExpiresAt });
    }
    if (full || rng.chance(0.4)) {
      add({ ownerType: 'CUSTOMER', ownerId: c.id, typeCode: 'ID_DOCUMENT', title: `RG — ${c.name}`, fileSlug: `rg ${c.name}`, createdAt: at });
    }
    if (full && !missingProof.has(c)) {
      const fromApp = c.portalEnabled && c.privacyAcceptedAt && rng.chance(0.25);
      add({
        ownerType: 'CUSTOMER',
        ownerId: c.id,
        typeCode: 'PROOF_OF_ADDRESS',
        title: `Comprovante de residência — ${c.name}`,
        fileSlug: `comprovante residencia ${c.name}`,
        createdAt: fromApp ? clock.plusMinutes(c.privacyAcceptedAt!, rng.int(10, 600)) : at,
        uploadedByCustomerId: fromApp ? c.id : null,
        notes: fromApp ? 'Enviado pelo cliente no aplicativo.' : null,
      });
    }
  }

  // Contrato assinado: metade dos ativos (o do João sempre) e parte dos encerrados.
  const active = rng.shuffle(w.contracts.filter((c) => c.status === 'ACTIVE' && c.role !== 'JOAO'));
  const signed = [
    ...w.contracts.filter((c) => c.role === 'JOAO'),
    ...active.slice(0, Math.ceil(active.length / 2) - 1),
    ...rng.shuffle(w.contracts.filter((c) => c.status === 'ENDED')).slice(0, 20),
  ];
  for (const c of signed) {
    c.signedDocumentId = add({
      ownerType: 'CONTRACT',
      ownerId: c.id,
      typeCode: 'CONTRACT_SIGNED',
      title: `Contrato assinado — ${c.number}`,
      fileSlug: `contrato ${c.number}`,
      createdAt: clock.plusMinutes(c.signedAt ?? c.createdAt, rng.int(5, 60)),
      visibleToCustomer: true,
    });
  }

  // Motos: CRLV, IPVA, nota fiscal (0 km), seguro.
  const year = clock.today.slice(0, 4);
  for (const m of w.motos) {
    const plate = formatPlate(m.plate);
    const base = { ownerType: 'MOTORCYCLE' as const, ownerId: m.id, uploadedById: w.user('ADMIN').id };
    const yearStart = `${year}-01-${String(rng.int(10, 25)).padStart(2, '0')}`;
    const docDate = clock.at(yearStart > m.acquiredAt ? yearStart : m.acquiredAt, 11, 0);
    add({ ...base, typeCode: 'CRLV', title: `CRLV ${year} — ${plate}`, fileSlug: `crlv ${year} ${m.plate}`, createdAt: docDate, expiresAt: m.final === 'INACTIVE' ? null : `${year}-12-31` });
    if (m.final !== 'INACTIVE') {
      add({ ...base, typeCode: 'IPVA', title: `IPVA ${year} — ${plate}`, fileSlug: `ipva ${year} ${m.plate}`, createdAt: docDate, expiresAt: `${year}-12-31` });
    }
    if (m.isNew) {
      add({ ...base, typeCode: 'INVOICE', title: `Nota fiscal de compra — ${plate}`, fileSlug: `nota fiscal ${m.plate}`, createdAt: m.createdAt });
    }
    if (m.insurance) {
      const end = `${String(Number(m.insurance.start.slice(0, 4)) + 1)}${m.insurance.start.slice(4)}`;
      add({ ...base, typeCode: 'INSURANCE', title: `Apólice de seguro (${m.insurance.insurer}) — ${plate}`, fileSlug: `seguro ${m.plate}`, createdAt: clock.at(m.insurance.start, 14, 0), expiresAt: end });
    }
    if (m.soldIdx !== null) {
      add({ ...base, typeCode: 'OTHER', title: `Recibo de venda (CRV assinado) — ${plate}`, fileSlug: `recibo venda ${m.plate}`, createdAt: clock.at(clock.ymd(m.soldIdx), 15, 0) });
    }
  }

  // Comprovantes de manutenção (parte dos serviços maiores dos últimos 3 meses).
  for (const r of w.maintenance) {
    if (r.status !== 'DONE' || (r.costCents ?? 0) < 25000 || r.idx === null || r.idx < T - 90 || !rng.chance(0.5)) continue;
    add({
      ownerType: 'MAINTENANCE',
      ownerId: r.id,
      typeCode: 'MAINTENANCE_RECEIPT',
      title: `Nota da oficina — ${r.workshop} (${formatPlate(r.moto.plate)})`,
      fileSlug: `nota oficina ${r.moto.plate} ${r.completedAt}`,
      createdAt: r.updatedAt,
      uploadedById: r.createdBy.id,
    });
  }

  // Ocorrências: auto de infração, boletim de ocorrência e fotos de avaria.
  for (const o of w.occurrences) {
    const row = o.row;
    const at = clock.plusMinutes(o.createdAt, rng.int(3, 30));
    const plate = o.moto ? formatPlate(o.moto.plate) : '';
    if (row.type === 'TRAFFIC_FINE') {
      add({ ownerType: 'OCCURRENCE', ownerId: row.id!, typeCode: 'TRAFFIC_TICKET', title: `Auto de infração ${row.fineNumber} — ${plate}`, fileSlug: `auto infracao ${row.fineNumber}`, createdAt: at });
    } else if (row.type === 'THEFT' || (row.type === 'ACCIDENT' && row.status === 'IN_PROGRESS')) {
      add({ ownerType: 'OCCURRENCE', ownerId: row.id!, typeCode: 'POLICE_REPORT', title: `Boletim de ocorrência — ${plate}`, fileSlug: `boletim ocorrencia ${plate}`, createdAt: at });
    } else if (row.type === 'DAMAGE' || row.type === 'ACCIDENT') {
      add({ ownerType: 'OCCURRENCE', ownerId: row.id!, typeCode: 'PHOTO_DAMAGE', title: `Fotos da avaria — ${plate}`, fileSlug: `fotos avaria ${plate} ${instantToYmd(o.createdAt)}`, createdAt: at });
    }
  }

  // Fotos da vistoria nas devoluções com avaria.
  for (const c of w.contracts) {
    if (!c.inspection || c.inspection.condition === 'GOOD' || c.role === 'THEFT') continue;
    add({
      ownerType: 'RETURN',
      ownerId: c.inspection.id,
      typeCode: 'PHOTO_RETURN',
      title: `Fotos da devolução — ${c.number}`,
      fileSlug: `fotos devolucao ${c.number}`,
      createdAt: clock.plusMinutes(c.inspection.createdAt, rng.int(2, 20)),
      uploadedById: c.inspection.createdBy.id,
    });
  }
}
