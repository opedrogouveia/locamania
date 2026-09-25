'use client';

import { ContractWizard } from '@/components/contracts/contract-wizard';
import { BackLink } from '@/components/ui/back-link';
import { PageHeader } from '@/components/ui/page-header';

export default function NewContractPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <BackLink href="/admin/contracts">Contratos</BackLink>
      <PageHeader
        title="Nova locação"
        description="Cliente, moto e condições — o contrato sai pronto para assinar."
      />
      <ContractWizard />
    </div>
  );
}
