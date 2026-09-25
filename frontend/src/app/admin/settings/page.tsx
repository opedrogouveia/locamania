'use client';

import { STAFF_ROLE_LABELS, formatCnpj } from '@locamania/shared';
import { Building2, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { NoAccess } from '@/components/settings/settings-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe, useStaff } from '@/lib/auth/use-auth';
import { useCompany } from '@/lib/queries';
import { visibleSettings, type SettingsItem } from '@/lib/settings/nav';
import { cn } from '@/lib/utils';

/** Cor do ícone por grupo — só tokens. */
const GROUP_TONE: Record<string, string> = {
  Empresa: 'bg-primary/10 text-primary',
  'Regras do negócio': 'bg-warning/15 text-warning',
  'Equipe e acesso': 'bg-success/12 text-success',
  Sistema: 'bg-info/12 text-info',
};

function ItemIcon({ item, tone, className }: { item: SettingsItem; tone: string; className?: string }) {
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-lg', tone, className)}>
      <item.icon className="size-[18px]" aria-hidden />
    </span>
  );
}

export default function SettingsHomePage() {
  const { isLoading } = useMe();
  const staff = useStaff();
  const { data: company } = useCompany();
  const groups = visibleSettings(staff?.permissions ?? []);

  if (isLoading || !staff) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (groups.length === 0) return <NoAccess />;

  const canCompany = groups.some((g) => g.items.some((i) => i.href === '/admin/settings/company'));
  const place = [company?.city, company?.state].filter(Boolean).join('/');

  const companyCard = company && (
    <div className="flex items-center gap-3 sm:gap-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground sm:size-12">
        <Building2 className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{company.tradeName}</p>
        <p className="truncate text-sm text-muted-foreground">
          {[company.cnpj ? `CNPJ ${formatCnpj(company.cnpj)}` : null, place || null].filter(Boolean).join(' · ') || 'Complete os dados da empresa'}
        </p>
      </div>
      {canCompany && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Configurações" description={`Você entrou como ${staff.name} · ${STAFF_ROLE_LABELS[staff.role]}`} />

      {companyCard &&
        (canCompany ? (
          <Link href="/admin/settings/company" className="block rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-ring/40 hover:bg-accent/30">
            {companyCard}
          </Link>
        ) : (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">{companyCard}</div>
        ))}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-x-6 md:gap-y-7">
        {groups.map((g) => {
          const tone = GROUP_TONE[g.label] ?? 'bg-muted text-muted-foreground';
          return (
            <section key={g.label} className="space-y-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</h2>
              {/* Lista agrupada, estilo "Ajustes" do iPhone — igual no celular e no computador */}
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                {g.items.map((i) => (
                  <li key={i.href}>
                    <Link href={i.href} className="group flex min-h-[60px] items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40 active:bg-muted/70 md:min-h-[68px]">
                      <ItemIcon item={i} tone={tone} className="size-9 md:size-10" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium leading-tight">{i.label}</p>
                        <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground md:text-sm">{i.description}</p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
