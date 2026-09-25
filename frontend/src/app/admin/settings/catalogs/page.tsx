'use client';

import { CATALOG_GROUPS, type CatalogGroup } from '@locamania/shared';

import { CatalogPanel } from '@/components/settings/catalog-panel';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CATALOG_GROUP_META } from '@/lib/settings/meta';
import { useUrlState } from '@/lib/use-url-state';

export default function CatalogsPage() {
  const [q, setQ, ready] = useUrlState({ group: 'MOTORCYCLE_BRAND' });
  const group = (CATALOG_GROUPS as string[]).includes(q.group) ? (q.group as CatalogGroup) : 'MOTORCYCLE_BRAND';

  return (
    <div className="space-y-5">
      <PageHeader title="Listas de opções" description="As opções que aparecem nos formulários — ninguém precisa digitar o mesmo nome de dez jeitos." />
      <Tabs defaultValue="MOTORCYCLE_BRAND" value={group} onValueChange={(g) => setQ({ group: g })}>
        <TabsList>
          {CATALOG_GROUPS.map((g) => (
            <TabsTrigger key={g} value={g}>
              {CATALOG_GROUP_META[g].tab}
            </TabsTrigger>
          ))}
        </TabsList>
        {CATALOG_GROUPS.map((g) => (
          <TabsContent key={g} value={g}>
            <Card className="p-4 sm:p-5">
              <h2 className="mb-1 text-base font-semibold">{CATALOG_GROUP_META[g].label}</h2>
              {ready ? <CatalogPanel group={g} /> : <Skeleton className="h-64 w-full" />}
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
