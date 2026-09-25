import type { ReactNode } from 'react';

import { CustomerShell } from '@/components/layout/customer-shell';

export const metadata = { title: { default: 'Meu aluguel', template: '%s · Locamania' } };

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return <CustomerShell>{children}</CustomerShell>;
}
