'use client';

import { TriangleAlert } from 'lucide-react';

import { CompanyForm } from '@/components/settings/company-form';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useCompany, useUpdateCompany } from '@/lib/queries';
import { formatDateTime } from '@/lib/utils';

export default function CompanySettingsPage() {
  const { data, isLoading, error } = useCompany();
  const update = useUpdateCompany();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dados da empresa"
        description={data ? `Última alteração em ${formatDateTime(data.updatedAt)}.` : 'Nome, CNPJ, contatos e endereço da Locamania.'}
      />
      {isLoading ? (
        <div className="space-y-5">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : error || !data ? (
        <EmptyState icon={TriangleAlert} title="Não foi possível carregar" description={errorMessage(error)} />
      ) : (
        <CompanyForm
          key={data.updatedAt}
          company={data}
          onSave={async (body) => {
            await update.mutateAsync(body);
            toast.success('Dados da empresa salvos');
          }}
        />
      )}
    </div>
  );
}
