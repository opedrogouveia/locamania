'use client';

import { TriangleAlert } from 'lucide-react';

import { ContractTemplateEditor } from '@/components/settings/contract-template-editor';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api/client';
import { useCompany } from '@/lib/queries';

export default function ContractTemplatePage() {
  const { data, isLoading, error } = useCompany();
  return (
    <div className="space-y-5">
      <PageHeader
        title="Modelo de contrato"
        description="Os campos entre {{ }} são trocados pelos dados de cada aluguel. Mudar o modelo vale para os próximos contratos; os já gerados não mudam."
      />
      {isLoading ? (
        <Skeleton className="h-[60vh] w-full" />
      ) : error || !data ? (
        <EmptyState icon={TriangleAlert} title="Não foi possível carregar o modelo" description={errorMessage(error)} />
      ) : (
        <ContractTemplateEditor template={data.contractTemplate} />
      )}
    </div>
  );
}
