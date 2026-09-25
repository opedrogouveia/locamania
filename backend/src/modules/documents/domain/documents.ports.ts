import type { DocumentOwnerType, Ymd } from '@locamania/shared';

export const DOCUMENTS_REPOSITORY = Symbol('DocumentsRepository');

export interface DocumentRecord {
  id: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
  typeCode: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  expiresAt: Ymd | null;
  visibleToCustomer: boolean;
  notes: string | null;
  uploadedByName: string | null;
  createdAt: Date;
}

export interface DocumentsRepository {
  list(filter: { ownerType?: DocumentOwnerType; ownerId?: string; typeCode?: string; expiresBefore?: Ymd; expiresAfter?: Ymd; search?: string; skip: number; take: number; visibleToCustomer?: boolean }): Promise<{ items: DocumentRecord[]; total: number }>;
  findById(id: string): Promise<DocumentRecord | null>;
  data(id: string): Promise<{ data: Buffer; mimeType: string; fileName: string } | null>;
  create(data: Omit<DocumentRecord, 'id' | 'createdAt' | 'uploadedByName'> & { data: Buffer; uploadedById?: string | null; uploadedByCustomerId?: string | null }): Promise<DocumentRecord>;
  update(id: string, data: Partial<Pick<DocumentRecord, 'typeCode' | 'title' | 'expiresAt' | 'visibleToCustomer' | 'notes'>>): Promise<DocumentRecord>;
  archive(id: string): Promise<void>;
  ownerExists(ownerType: DocumentOwnerType, ownerId: string): Promise<boolean>;
  ownerLabels(refs: { ownerType: DocumentOwnerType; ownerId: string }[]): Promise<Map<string, string>>;
  /** Clientes com CNH vencendo/vencida (fora do documento anexado). */
  cnhExpiring(before: Ymd): Promise<{ id: string; name: string; cnhExpiresAt: Ymd }[]>;
  /** Dono (cliente) de um documento, para o portal conferir se pode ver. */
  customerOwnsDocument(documentId: string, customerId: string): Promise<boolean>;
}
