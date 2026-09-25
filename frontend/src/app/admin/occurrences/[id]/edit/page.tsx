'use client';

import { OCCURRENCE_TYPE_LABELS } from '@locamania/shared';
import { TriangleAlert } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

import { OccurrenceForm } from '@/components/occurrences/occurrence-form';
import { BackLink } from '@/components/ui/back-link';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { K, useInvalidate, useOccurrence, useUpdateOccurrence } from '@/lib/queries';

export default function EditOccurrencePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error } = useOccurrence(id);
  const update = useUpdateOccurrence(id);
  const invalidate = useInvalidate();
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <BackLink href={`/admin/occurrences/${id}`}>{data ? OCCURRENCE_TYPE_LABELS[data.type] : 'Ocorrência'}</BackLink>
      <PageHeader title="Editar ocorrência" />
      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : error || !data ? (
        <EmptyState icon={TriangleAlert} title="Ocorrência não encontrada" description={errorMessage(error)} />
      ) : (
        <OccurrenceForm
          occurrence={data}
          submitLabel="Salvar alterações"
          onCancel={() => router.push(`/admin/occurrences/${id}`)}
          onSubmit={async (_body, changed) => {
            if (Object.keys(changed).length === 0) {
              toast.info('Nada foi alterado');
            } else {
              await update.mutateAsync(changed);
              await invalidate(K.audit);
              toast.success('Ocorrência atualizada');
            }
            router.push(`/admin/occurrences/${id}`);
          }}
        />
      )}
    </div>
  );
}
