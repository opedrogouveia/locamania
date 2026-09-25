import { Inject, Injectable } from '@nestjs/common';
import {
  addDays,
  diffDays,
  expiryState,
  ParameterKey,
  type DocumentDto,
  type ExpiringItemDto,
  type ListDocumentsQuery,
  type PaginatedResponse,
  type UpdateDocumentRequest,
  type UploadDocumentRequest,
} from '@locamania/shared';

import type { Principal } from '../../../shared/auth/principal';
import { CatalogLabelsService } from '../../../shared/catalog/catalog-labels.service';
import { NotFoundError, ValidationError } from '../../../shared/errors/domain-errors';
import { iso } from '../../../shared/http/mappers';
import { paginated, pageParams, searchTerm } from '../../../shared/http/pagination';
import { ParametersService } from '../../../shared/parameters/parameters.service';
import { ClockService } from '../../../shared/time/clock.service';
import { DOCUMENTS_REPOSITORY, type DocumentRecord, type DocumentsRepository } from '../domain/documents.ports';

/** 8 MB depois de decodificado (a imagem já chega reduzida pelo navegador). */
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const ALLOWED = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY) private readonly repo: DocumentsRepository,
    private readonly catalog: CatalogLabelsService,
    private readonly params: ParametersService,
    private readonly clock: ClockService,
  ) {}

  private async toDtos(items: DocumentRecord[]): Promise<DocumentDto[]> {
    const [label, warnDays, owners] = await Promise.all([
      this.catalog.resolver(),
      this.params.number(ParameterKey.DOCUMENT_WARN_DAYS),
      this.repo.ownerLabels(items.map((d) => ({ ownerType: d.ownerType, ownerId: d.ownerId }))),
    ]);
    const today = this.clock.today();
    return items.map((d) => ({
      id: d.id,
      ownerType: d.ownerType,
      ownerId: d.ownerId,
      ownerLabel: owners.get(d.ownerId) ?? null,
      typeCode: d.typeCode,
      typeLabel: label('DOCUMENT_TYPE', d.typeCode),
      title: d.title,
      fileName: d.fileName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      isImage: d.mimeType.startsWith('image/'),
      expiresAt: d.expiresAt,
      expiryState: expiryState(d.expiresAt, today, warnDays),
      visibleToCustomer: d.visibleToCustomer,
      notes: d.notes,
      uploadedBy: d.uploadedByName,
      createdAt: iso(d.createdAt),
    }));
  }

  async list(query: ListDocumentsQuery): Promise<PaginatedResponse<DocumentDto>> {
    const p = pageParams(query, 50);
    const today = this.clock.today();
    const warnDays = await this.params.number(ParameterKey.DOCUMENT_WARN_DAYS);
    const { items, total } = await this.repo.list({
      ownerType: query.ownerType,
      ownerId: query.ownerId,
      typeCode: query.typeCode,
      search: searchTerm(query.search),
      ...(query.expiry === 'EXPIRED' ? { expiresBefore: addDays(today, -1) } : {}),
      ...(query.expiry === 'EXPIRING' ? { expiresAfter: today, expiresBefore: addDays(today, warnDays) } : {}),
      skip: p.skip,
      take: p.take,
    });
    return paginated(await this.toDtos(items), total, p);
  }

  async upload(input: UploadDocumentRequest, uploader: Principal): Promise<DocumentDto> {
    if (!ALLOWED.test(input.mimeType)) throw new ValidationError('Envie foto (JPG, PNG, WEBP) ou PDF.');
    const data = Buffer.from(input.dataBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (data.length === 0) throw new ValidationError('Arquivo vazio.');
    if (data.length > MAX_DOCUMENT_BYTES) throw new ValidationError('Arquivo grande demais (máximo de 8 MB).');
    if (!(await this.catalog.exists('DOCUMENT_TYPE', input.typeCode))) throw new ValidationError('Tipo de documento inválido.');
    if (!(await this.repo.ownerExists(input.ownerType, input.ownerId))) throw new NotFoundError('Registro do anexo não encontrado.');
    const typeLabel = await this.catalog.label('DOCUMENT_TYPE', input.typeCode);
    const created = await this.repo.create({
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      typeCode: input.typeCode,
      title: input.title?.trim() || typeLabel,
      fileName: input.fileName.slice(0, 200),
      mimeType: input.mimeType,
      sizeBytes: data.length,
      data,
      expiresAt: input.expiresAt ?? null,
      visibleToCustomer: uploader.kind === 'customer' ? true : (input.visibleToCustomer ?? false),
      notes: input.notes?.trim() || null,
      uploadedById: uploader.kind === 'staff' ? uploader.id : null,
      uploadedByCustomerId: uploader.kind === 'customer' ? uploader.id : null,
    });
    return (await this.toDtos([created]))[0]!;
  }

  async update(id: string, input: UpdateDocumentRequest): Promise<DocumentDto> {
    if (!(await this.repo.findById(id))) throw new NotFoundError('Documento não encontrado.');
    if (input.typeCode && !(await this.catalog.exists('DOCUMENT_TYPE', input.typeCode))) throw new ValidationError('Tipo de documento inválido.');
    return (await this.toDtos([await this.repo.update(id, { ...input, title: input.title?.trim() })]))[0]!;
  }

  async archive(id: string): Promise<void> {
    if (!(await this.repo.findById(id))) throw new NotFoundError('Documento não encontrado.');
    await this.repo.archive(id);
  }

  async file(id: string): Promise<{ data: Buffer; mimeType: string; fileName: string }> {
    const f = await this.repo.data(id);
    if (!f) throw new NotFoundError('Documento não encontrado.');
    return f;
  }

  /** Arquivo para o cliente: só se o documento for dele e liberado (§38). */
  async fileForCustomer(id: string, customerId: string): Promise<{ data: Buffer; mimeType: string; fileName: string }> {
    if (!(await this.repo.customerOwnsDocument(id, customerId))) throw new NotFoundError('Documento não encontrado.');
    return this.file(id);
  }

  async visibleToCustomer(ownerType: 'CUSTOMER' | 'CONTRACT' | 'MOTORCYCLE', ownerId: string): Promise<DocumentDto[]> {
    const { items } = await this.repo.list({ ownerType, ownerId, visibleToCustomer: true, skip: 0, take: 50 });
    return this.toDtos(items);
  }

  /** Vencimentos acompanhados (§20, §21): documentos com validade + CNH dos clientes. */
  async expiring(): Promise<ExpiringItemDto[]> {
    const today = this.clock.today();
    const warnDays = await this.params.number(ParameterKey.DOCUMENT_WARN_DAYS);
    const until = addDays(today, warnDays);
    const [{ items }, cnhs, label] = await Promise.all([
      this.repo.list({ expiresBefore: until, skip: 0, take: 500 }),
      this.repo.cnhExpiring(until),
      this.catalog.resolver(),
    ]);
    const owners = await this.repo.ownerLabels(items.map((d) => ({ ownerType: d.ownerType, ownerId: d.ownerId })));
    const docs: ExpiringItemDto[] = items
      // CNH como documento é coberta pelo campo da ficha (fonte da verdade).
      .filter((d) => d.typeCode !== 'CNH' && d.expiresAt)
      .map((d) => ({
        kind: 'DOCUMENT' as const,
        id: d.id,
        title: `${label('DOCUMENT_TYPE', d.typeCode)}${d.title && d.title !== label('DOCUMENT_TYPE', d.typeCode) ? ` — ${d.title}` : ''}`,
        owner: { type: d.ownerType, id: d.ownerId, label: owners.get(d.ownerId) ?? '—' },
        expiresAt: d.expiresAt!,
        daysRemaining: diffDays(today, d.expiresAt!),
        state: expiryState(d.expiresAt, today, warnDays),
      }));
    const cnh: ExpiringItemDto[] = cnhs.map((c) => ({
      kind: 'CNH',
      id: `cnh-${c.id}`,
      title: 'CNH',
      owner: { type: 'CUSTOMER', id: c.id, label: c.name },
      expiresAt: c.cnhExpiresAt,
      daysRemaining: diffDays(today, c.cnhExpiresAt),
      state: expiryState(c.cnhExpiresAt, today, warnDays),
    }));
    return [...docs, ...cnh].sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  }
}
