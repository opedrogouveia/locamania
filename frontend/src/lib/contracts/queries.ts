'use client';

/**
 * Hooks que faltavam em `lib/queries` para as telas de contratos, pagamentos e
 * inadimplência — mutações por linha (a lista de inadimplentes age sobre vários
 * clientes, e os hooks gerais recebem o id na criação).
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import type { CustomerManualStatus, DocumentOwnerType } from '@locamania/shared';

import { chargesApi, customersApi, documentsApi } from '@/lib/api/resources';
import type { PreparedFile } from '@/lib/files';
import { K, useInvalidate } from '@/lib/queries';

/** Inadimplentes, só para quem pode ver valores (mesma chave do hook geral: a invalidação vale). */
export const useDelinquentsIf = (enabled: boolean) =>
  useQuery({ queryKey: [...K.charges, 'delinquents'], queryFn: chargesApi.delinquents, enabled });

/** Encaminhar/retirar da cobrança (§14) — qualquer cliente da lista. */
export function useSetCollection() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, inCollection }: { id: string; inCollection: boolean }) =>
      customersApi.setCollection(id, inCollection),
    onSuccess: () => invalidate(K.customers, K.charges, K.dashboard),
  });
}

/** Bloquear / desbloquear o cliente a partir da inadimplência. */
export function useSetCustomerManualStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      manualStatus,
      reason,
    }: {
      id: string;
      manualStatus: CustomerManualStatus | null;
      reason?: string | null;
    }) => customersApi.setStatus(id, { manualStatus, reason }),
    onSuccess: () => invalidate(K.customers, K.charges, K.dashboard),
  });
}

/**
 * Envia vários arquivos já preparados (fotos da entrega/devolução, contrato
 * assinado) para uma ficha. Um por vez: o limite de 8 MB é por arquivo e a
 * conexão do celular na rua é fraca.
 */
export function useUploadMany() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      files,
      ownerType,
      ownerId,
      typeCode,
      title,
      visibleToCustomer = false,
    }: {
      files: PreparedFile[];
      ownerType: DocumentOwnerType;
      ownerId: string;
      typeCode: string;
      title: string;
      visibleToCustomer?: boolean;
    }) => {
      const ids: string[] = [];
      for (const [i, f] of files.entries()) {
        const doc = await documentsApi.upload({
          ownerType,
          ownerId,
          typeCode,
          title: files.length > 1 ? `${title} (${i + 1})` : title,
          fileName: f.fileName,
          mimeType: f.mimeType,
          dataBase64: f.dataBase64,
          visibleToCustomer,
        });
        ids.push(doc.id);
      }
      return ids;
    },
    onSuccess: () => invalidate(K.documents),
  });
}
