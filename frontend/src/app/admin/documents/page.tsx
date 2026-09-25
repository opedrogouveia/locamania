'use client';

import {
  CatalogGroup,
  DOCUMENT_OWNER_LABELS,
  DOCUMENT_OWNER_TYPES,
  formatPlate,
  type DocumentDto,
  type DocumentOwnerType,
  type ExpiringItemDto,
} from '@locamania/shared';
import { CalendarCheck, Download, ExternalLink, Eye, FileText, FolderOpen, IdCard, ImageIcon, MoreHorizontal, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChips, MobileRow, SearchInput } from '@/components/ui/kit';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SelectMenu } from '@/components/ui/select-menu';
import { ExpiryBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toaster';
import { downloadFile, errorMessage, openFile } from '@/lib/api/client';
import { documentsApi } from '@/lib/api/resources';
import { documentOwnerHref } from '@/lib/documents/links';
import { useCatalog, useDocuments, useExpiring } from '@/lib/queries';
import { pageOf, useUrlState } from '@/lib/use-url-state';
import { cn, formatBytes, formatDateTime, formatYmd, plural } from '@/lib/utils';

type Tab = 'expiring' | 'expired' | 'all';
const TABS: Tab[] = ['expiring', 'expired', 'all'];

/** Moto aparece pela placa formatada; o resto pelo nome. */
function ownerName(type: DocumentOwnerType, label: string | null): string {
  if (!label) return '—';
  return type === 'MOTORCYCLE' ? formatPlate(label) : label;
}

function whenLabel(item: ExpiringItemDto): string {
  const d = item.daysRemaining;
  if (d === 0) return 'vence hoje';
  if (d === 1) return 'vence amanhã';
  if (d > 1) return `vence em ${d} dias`;
  if (d === -1) return 'venceu ontem';
  return `venceu há ${-d} dias`;
}

function expiringHref(item: ExpiringItemDto): string | null {
  // CNH fica no resumo da ficha do cliente; documento, na aba de documentos do dono.
  if (item.kind === 'CNH') return `/admin/customers/${item.owner.id}`;
  return documentOwnerHref(item.owner.type, item.owner.id);
}

// ───────────────────────────── Vencendo / vencidos ─────────────────────────────

function ExpiringTab({ items, loading, state, owner, onOwner }: { items: ExpiringItemDto[] | undefined; loading: boolean; state: 'EXPIRING' | 'EXPIRED'; owner: string; onOwner: (v: string) => void }) {
  const router = useRouter();
  const ofState = items?.filter((i) => i.state === state);
  const owners = [...new Set(ofState?.map((i) => i.owner.type) ?? [])];
  const rows = ofState?.filter((i) => owner === 'all' || i.owner.type === owner);

  const columns: Column<ExpiringItemDto>[] = [
    {
      key: 'doc',
      header: 'Documento',
      cell: (i) => {
        const Icon = i.kind === 'CNH' ? IdCard : FileText;
        return (
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', state === 'EXPIRED' ? 'bg-destructive/12 text-destructive' : 'bg-warning/15 text-warning')}>
              <Icon className="size-4" aria-hidden />
            </span>
            <p className="min-w-0 max-w-md truncate font-medium">{i.title}</p>
          </div>
        );
      },
    },
    {
      key: 'owner',
      header: 'De quem',
      cell: (i) => (
        <div>
          <p className={cn(i.owner.type === 'MOTORCYCLE' && 'font-mono text-sm')}>{ownerName(i.owner.type, i.owner.label)}</p>
          <p className="text-xs text-muted-foreground">{DOCUMENT_OWNER_LABELS[i.owner.type]}</p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Vencimento',
      cell: (i) => (
        <div className="whitespace-nowrap">
          <p className="tabular">{formatYmd(i.expiresAt)}</p>
          <p className={cn('text-xs', state === 'EXPIRED' ? 'text-destructive' : 'text-muted-foreground')}>{whenLabel(i)}</p>
        </div>
      ),
    },
    { key: 'state', header: 'Situação', cell: (i) => <ExpiryBadge state={i.state} /> },
  ];

  return (
    <div className="space-y-4">
      {owners.length > 1 && (
        <FilterChips
          value={owners.includes(owner as DocumentOwnerType) ? owner : 'all'}
          onChange={onOwner}
          options={[
            { value: 'all', label: 'Todos', count: ofState?.length },
            ...owners.map((t) => ({ value: t, label: t === 'MOTORCYCLE' ? 'Motos' : t === 'CUSTOMER' ? 'Clientes' : DOCUMENT_OWNER_LABELS[t], count: ofState?.filter((i) => i.owner.type === t).length })),
          ]}
        />
      )}
      <Card>
        <DataTable
          rows={rows}
          loading={loading}
          columns={columns}
          rowKey={(i) => i.id}
          onRowClick={(i) => {
            const href = expiringHref(i);
            if (href) router.push(href);
          }}
          rowClassName={() => (state === 'EXPIRED' ? 'bg-destructive/[0.03]' : undefined)}
          empty={
            state === 'EXPIRING'
              ? { icon: CalendarCheck, title: 'Nada vencendo', description: 'Nenhum documento nem CNH vence nos próximos dias.' }
              : { icon: CalendarCheck, title: 'Nenhum documento vencido', description: 'Tudo em dia com as validades.' }
          }
          mobileCard={(i) => (
            <MobileRow
              leading={
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', state === 'EXPIRED' ? 'bg-destructive/12 text-destructive' : 'bg-warning/15 text-warning')}>
                  {i.kind === 'CNH' ? <IdCard className="size-4" aria-hidden /> : <FileText className="size-4" aria-hidden />}
                </span>
              }
              title={i.title}
              wrapTitle
              subtitle={`${DOCUMENT_OWNER_LABELS[i.owner.type]} · ${ownerName(i.owner.type, i.owner.label)}`}
              meta={
                <>
                  <span className="tabular">{formatYmd(i.expiresAt)}</span>
                  <span className={state === 'EXPIRED' ? 'text-destructive' : undefined}>{whenLabel(i)}</span>
                </>
              }
            />
          )}
        />
      </Card>
    </div>
  );
}

// ───────────────────────────── Todos ─────────────────────────────

function DocIcon({ doc }: { doc: DocumentDto }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      {doc.isImage ? <ImageIcon className="size-4" aria-hidden /> : <FileText className="size-4" aria-hidden />}
    </span>
  );
}

function OwnerLink({ doc, stacked, className }: { doc: DocumentDto; stacked?: boolean; className?: string }) {
  const href = documentOwnerHref(doc.ownerType, doc.ownerId);
  const type = DOCUMENT_OWNER_LABELS[doc.ownerType];
  const name = doc.ownerLabel ? ownerName(doc.ownerType, doc.ownerLabel) : null;
  const label = stacked ? (name ?? type) : name ? `${type} · ${name}` : type;
  const body = href ? (
    <Link href={href} className={cn('text-primary hover:underline', doc.ownerType === 'MOTORCYCLE' && stacked && 'font-mono', className)}>
      {label}
    </Link>
  ) : (
    <span className={className}>{label}</span>
  );
  if (!stacked) return body;
  return (
    <div className="min-w-0">
      <p className="text-sm">{body}</p>
      {name && <p className="text-xs text-muted-foreground">{type}</p>}
    </div>
  );
}

async function run(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    toast.error(errorMessage(e));
  }
}

type DocsQuery = { tab: string; owner: string; type: string; search: string; page: string };

function AllTab({ q, setQ, ready }: { q: DocsQuery; setQ: (p: Partial<DocsQuery>) => void; ready: boolean }) {
  const types = useCatalog(CatalogGroup.DOCUMENT_TYPE);
  const ownerType = (DOCUMENT_OWNER_TYPES as string[]).includes(q.owner) ? (q.owner as DocumentOwnerType) : undefined;
  const { data, isLoading, error, isFetching } = useDocuments(
    { ownerType, typeCode: q.type || undefined, search: q.search || undefined, page: pageOf(q.page), pageSize: 20 },
    ready,
  );

  const open = (doc: DocumentDto) => run(() => openFile(documentsApi.filePath(doc.id)));
  const download = (doc: DocumentDto) => run(() => downloadFile(documentsApi.filePath(doc.id), doc.fileName));

  const columns: Column<DocumentDto>[] = [
    {
      key: 'doc',
      header: 'Documento',
      cell: (d) => (
        <button type="button" onClick={() => void open(d)} className="flex min-w-0 max-w-sm items-center gap-3 text-left xl:max-w-md">
          <DocIcon doc={d} />
          <span className="min-w-0">
            <span className="block truncate font-medium hover:underline">{d.title}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {d.typeLabel} · {formatBytes(d.sizeBytes)}
            </span>
          </span>
        </button>
      ),
    },
    { key: 'owner', header: 'De quem', cell: (d) => <OwnerLink doc={d} stacked /> },
    {
      key: 'expiry',
      header: 'Validade',
      cell: (d) =>
        d.expiresAt ? (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="tabular">{formatYmd(d.expiresAt)}</span>
            <ExpiryBadge state={d.expiryState} />
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'sent',
      header: 'Enviado',
      hideBelow: 'xl',
      cell: (d) => (
        <div className="text-sm">
          <p className="whitespace-nowrap tabular">{formatDateTime(d.createdAt)}</p>
          {d.uploadedBy && <p className="text-xs text-muted-foreground">{d.uploadedBy}</p>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (d) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex size-9 items-center justify-center rounded-md hover:bg-accent">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Ações do documento</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void open(d)}>
              <Eye /> Abrir
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void download(d)}>
              <Download /> Baixar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const filtered = !!ownerType || !!q.type || !!q.search;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[200px_240px_minmax(0,360px)]">
        <SelectMenu
          aria-label="De quem é o documento"
          value={ownerType ?? ''}
          onChange={(v) => setQ({ owner: v || 'all', page: '1' })}
          placeholder="Todas as fichas"
          options={DOCUMENT_OWNER_TYPES.map((t) => ({ value: t, label: DOCUMENT_OWNER_LABELS[t] }))}
        />
        <SelectMenu
          aria-label="Tipo de documento"
          value={q.type ?? ''}
          onChange={(v) => setQ({ type: v, page: '1' })}
          placeholder="Todos os tipos"
          options={(types.data ?? []).map((t) => ({ value: t.code, label: t.label }))}
        />
        <SearchInput value={q.search ?? ''} onChange={(v) => setQ({ search: v, page: '1' })} placeholder="Nome do documento ou do arquivo" className="col-span-2 lg:col-span-1" />
      </div>
      <Card className={isFetching && !isLoading ? 'opacity-70 transition-opacity' : undefined}>
        {error ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : (
          <DataTable
            rows={ready ? data?.data : undefined}
            loading={isLoading || !ready}
            columns={columns}
            rowKey={(d) => d.id}
            empty={{
              icon: FolderOpen,
              title: filtered ? 'Nenhum documento neste filtro' : 'Nenhum documento enviado',
              description: filtered ? 'Tente outro tipo, outra ficha ou outra busca.' : 'Os anexos das fichas (clientes, motos, contratos) aparecem aqui.',
            }}
            mobileCard={(d) => (
              <MobileRow
                leading={<DocIcon doc={d} />}
                wrapTitle
                title={
                  <button type="button" onClick={() => void open(d)} className="text-left">
                    {d.title}
                  </button>
                }
                subtitle={<OwnerLink doc={d} />}
                meta={
                  <>
                    <span>{d.typeLabel}</span>
                    {d.expiresAt && <span className="tabular">vence {formatYmd(d.expiresAt)}</span>}
                    {d.expiresAt && <ExpiryBadge state={d.expiryState} />}
                  </>
                }
                right={
                  <Button variant="ghost" size="icon" onClick={() => void open(d)} aria-label={`Abrir ${d.title}`}>
                    <ExternalLink />
                  </Button>
                }
              />
            )}
          />
        )}
        {data && data.totalPages > 1 && (
          <div className="border-t border-border p-3">
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} unit="documentos" onPageChange={(p) => setQ({ page: String(p) })} />
          </div>
        )}
      </Card>
    </div>
  );
}

export default function DocumentsPage() {
  const [q, setQ, ready] = useUrlState({ tab: 'expiring', owner: 'all', type: '', search: '', page: '1' });
  const tab: Tab = (TABS as string[]).includes(q.tab) ? (q.tab as Tab) : 'expiring';
  const expiring = useExpiring();
  const expiringCount = expiring.data?.filter((i) => i.state === 'EXPIRING').length;
  const expiredCount = expiring.data?.filter((i) => i.state === 'EXPIRED').length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documentos"
        description={
          expiring.data
            ? `${plural(expiringCount ?? 0, 'vencendo', 'vencendo')} · ${plural(expiredCount ?? 0, 'vencido', 'vencidos')} (documentos e CNH)`
            : 'Validades de documentos e CNH, e todos os anexos das fichas.'
        }
      />
      <Tabs defaultValue="expiring" value={tab} onValueChange={(t) => setQ({ tab: t, owner: 'all', page: '1' })}>
        <TabsList>
          <TabsTrigger value="expiring">
            Vencendo
            {expiringCount !== undefined && <span className="rounded-full bg-warning/15 px-1.5 text-xs tabular text-warning">{expiringCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="expired">
            Vencidos
            {expiredCount !== undefined && <span className="rounded-full bg-destructive/12 px-1.5 text-xs tabular text-destructive">{expiredCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>
        {expiring.error && tab !== 'all' ? (
          <EmptyState icon={TriangleAlert} title="Não foi possível carregar os vencimentos" description={errorMessage(expiring.error)} />
        ) : (
          <>
            <TabsContent value="expiring">
              <ExpiringTab items={expiring.data} loading={expiring.isLoading} state="EXPIRING" owner={q.owner ?? 'all'} onOwner={(v) => setQ({ owner: v })} />
            </TabsContent>
            <TabsContent value="expired">
              <ExpiringTab items={expiring.data} loading={expiring.isLoading} state="EXPIRED" owner={q.owner ?? 'all'} onOwner={(v) => setQ({ owner: v })} />
            </TabsContent>
          </>
        )}
        <TabsContent value="all">
          <AllTab q={q} setQ={setQ} ready={ready} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
