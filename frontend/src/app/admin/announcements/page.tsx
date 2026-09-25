'use client';

import { Permission, type AnnouncementAudience, type AnnouncementDto } from '@locamania/shared';
import { Check, Loader2, Mail, Megaphone, MessageCircle, Send, Smartphone, UserCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { AnnouncementPreview } from '@/components/communication/announcement-preview';
import { CustomerMultiPicker, type PickedCustomer } from '@/components/communication/customer-multi-picker';
import { NoAccess } from '@/components/settings/settings-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { DetailList, Field, MobileRow, SectionCard } from '@/components/ui/kit';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useCan, useMe } from '@/lib/auth/use-auth';
import { useAnnounce, useCompany, useContracts } from '@/lib/queries';
import { useAnnouncementHistory } from '@/lib/settings/queries';
import { shortWhen } from '@/lib/settings/format';
import { pageOf, useUrlState } from '@/lib/use-url-state';
import { cn, formatDateTime, plural } from '@/lib/utils';

const AUDIENCE_LABEL: Record<AnnouncementAudience, string> = {
  ALL_ACTIVE: 'Clientes com aluguel ativo',
  SELECTED: 'Clientes escolhidos',
};

const AUDIENCE_SHORT: Record<AnnouncementAudience, string> = {
  ALL_ACTIVE: 'Aluguel ativo',
  SELECTED: 'Escolhidos',
};

const TITLE_MAX = 120;
const BODY_MAX = 2000;

function AudienceOption({ selected, onSelect, icon, title, hint }: { selected: boolean; onSelect: () => void; icon: ReactNode; title: string; hint: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex min-h-16 flex-1 items-start gap-3 rounded-xl border p-3 text-left transition-colors [&_svg]:size-[18px]',
        selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:bg-accent/50',
      )}
    >
      <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg', selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

function ChannelRow({ icon, title, hint, control }: { icon: ReactNode; title: string; hint: ReactNode; control: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-3 py-2.5 [&>svg]:size-[18px] [&>svg]:shrink-0 [&>svg]:text-muted-foreground">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {control}
    </div>
  );
}

export default function AnnouncementsPage() {
  const { isLoading: meLoading } = useMe();
  const canSend = useCan(Permission.NOTIFICATIONS_SEND);
  const canContracts = useCan(Permission.CONTRACTS_VIEW);
  const [q, setQ] = useUrlState({ page: '1' });
  const history = useAnnouncementHistory(pageOf(q.page), canSend);
  const active = useContracts({ status: 'ACTIVE', pageSize: 1 }, canSend && canContracts);
  const { data: company } = useCompany();
  const announce = useAnnounce();
  const confirm = useConfirm();

  const [audience, setAudience] = useState<AnnouncementAudience>('ALL_ACTIVE');
  const [picked, setPicked] = useState<PickedCustomer[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [email, setEmail] = useState(true);
  const [errors, setErrors] = useState<{ title?: string; body?: string; audience?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [open, setOpen] = useState<AnnouncementDto | null>(null);

  if (meLoading) return <Skeleton className="h-[70vh] w-full" />;
  if (!canSend) return <NoAccess />;

  const activeCount = active.data?.total;
  const recipients = audience === 'SELECTED' ? picked.length : activeCount;

  async function send() {
    const found: typeof errors = {};
    if (!title.trim()) found.title = 'Escreva o título.';
    if (!body.trim()) found.body = 'Escreva a mensagem.';
    if (audience === 'SELECTED' && picked.length === 0) found.audience = 'Escolha pelo menos um cliente.';
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    const who = audience === 'SELECTED' ? plural(picked.length, 'cliente escolhido', 'clientes escolhidos') : recipients !== undefined ? plural(recipients, 'cliente com aluguel ativo', 'clientes com aluguel ativo') : 'todos os clientes com aluguel ativo';
    const ok = await confirm({
      title: 'Enviar o aviso agora?',
      description: `Vai para ${who}: aparece no aplicativo na hora${email ? ' e sai por e-mail para quem tem e-mail cadastrado' : ''}. Depois de enviado não dá para desfazer.`,
      confirmText: 'Enviar aviso',
    });
    if (!ok) return;
    try {
      const out = await announce.mutateAsync({
        title: title.trim(),
        body: body.trim(),
        audience,
        customerIds: audience === 'SELECTED' ? picked.map((c) => c.id) : undefined,
        sendEmail: email,
      });
      toast.success('Aviso enviado', { description: `Chegou para ${plural(out.recipients, 'cliente', 'clientes')}.` });
      setTitle('');
      setBody('');
      setPicked([]);
      setErrors({});
    } catch (err) {
      setFormError(errorMessage(err));
    }
  }

  const columns: Column<AnnouncementDto>[] = [
    {
      key: 'title',
      header: 'Aviso',
      cell: (a) => (
        <div className="max-w-xl">
          <p className="font-medium">{a.title}</p>
          <p className="line-clamp-1 text-xs text-muted-foreground">{a.body}</p>
        </div>
      ),
    },
    { key: 'audience', header: 'Para', hideBelow: 'lg', cell: (a) => <span className="whitespace-nowrap text-sm">{AUDIENCE_SHORT[a.audience]}</span> },
    { key: 'count', header: 'Clientes', align: 'right', cell: (a) => <span className="whitespace-nowrap">{a.recipientsCount.toLocaleString('pt-BR')}</span> },
    { key: 'by', header: 'Enviado por', hideBelow: 'xl', cell: (a) => <span className="whitespace-nowrap">{a.createdBy ?? '—'}</span> },
    { key: 'at', header: 'Quando', align: 'right', cell: (a) => <span className="whitespace-nowrap text-sm text-muted-foreground">{shortWhen(a.createdAt)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Avisos aos clientes" description="Recados da Locamania para os clientes: feriado, campanha, mudança de horário…" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <form
          className="min-w-0 space-y-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <SectionCard title="Para quem">
            <div role="radiogroup" aria-label="Para quem" className="flex flex-col gap-2 sm:flex-row">
              <AudienceOption
                selected={audience === 'ALL_ACTIVE'}
                onSelect={() => setAudience('ALL_ACTIVE')}
                icon={<Users />}
                title="Todos com aluguel ativo"
                hint={activeCount !== undefined ? plural(activeCount, 'cliente hoje', 'clientes hoje') : 'Quem está com moto agora'}
              />
              <AudienceOption selected={audience === 'SELECTED'} onSelect={() => setAudience('SELECTED')} icon={<UserCheck />} title="Escolher clientes" hint="Um ou mais, pela busca" />
            </div>
            {audience === 'SELECTED' && (
              <div className="mt-4">
                <CustomerMultiPicker value={picked} onChange={(v) => (setPicked(v), setErrors((p) => ({ ...p, audience: undefined })))} />
              </div>
            )}
            {errors.audience && <p className="mt-2 text-xs text-destructive">{errors.audience}</p>}
          </SectionCard>

          <SectionCard title="Mensagem">
            <div className="space-y-4">
              <Field label="Título" required error={errors.title} hint={`${title.length}/${TITLE_MAX}`}>
                {(id) => (
                  <Input
                    id={id}
                    value={title}
                    onChange={(e) => (setTitle(e.target.value), setErrors((p) => ({ ...p, title: undefined })))}
                    maxLength={TITLE_MAX}
                    placeholder="Ex.: Horário especial no feriado"
                    autoCapitalize="sentences"
                  />
                )}
              </Field>
              <Field label="Mensagem" required error={errors.body} hint={`${body.length}/${BODY_MAX}`}>
                {(id) => (
                  <Textarea
                    id={id}
                    value={body}
                    onChange={(e) => (setBody(e.target.value), setErrors((p) => ({ ...p, body: undefined })))}
                    maxLength={BODY_MAX}
                    rows={6}
                    placeholder="Escreva como falaria com o cliente. Curto e direto funciona melhor."
                    autoCapitalize="sentences"
                    className="text-[15px] leading-relaxed"
                  />
                )}
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Por onde enviar">
            <div className="divide-y divide-border rounded-xl border border-border">
              <ChannelRow icon={<Smartphone />} title="No aplicativo" hint="Sempre. Aparece em Avisos, com o contador no sino." control={<Check className="size-5 text-success" aria-label="Sempre ligado" />} />
              <ChannelRow
                icon={<Mail />}
                title="Por e-mail"
                hint="Para quem tem e-mail cadastrado."
                control={
                  <>
                    <label htmlFor="ann-email" className="sr-only">
                      Enviar também por e-mail
                    </label>
                    <Switch id="ann-email" checked={email} onCheckedChange={setEmail} />
                  </>
                }
              />
              <ChannelRow
                icon={<MessageCircle />}
                title="WhatsApp automático"
                hint={
                  <>
                    Precisa da integração oficial —{' '}
                    <Link href="/admin/settings/integrations" className="font-medium text-primary hover:underline">
                      ver Integrações
                    </Link>
                    .
                  </>
                }
                control={<span className="text-xs text-muted-foreground">Indisponível</span>}
              />
            </div>
          </SectionCard>

          <FormError message={formError} />
          {/* Celular: prévia antes do botão, para conferir o que vai sair */}
          <div className="lg:hidden">
            <p className="mb-2 text-sm font-medium">Como o cliente vê</p>
            <AnnouncementPreview title={title} body={body} email={email} companyName={company?.tradeName ?? 'Locamania'} />
          </div>
          <div className="sticky bottom-[calc(4.4rem+env(safe-area-inset-bottom))] z-20 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <div className="flex items-center justify-end gap-3">
              {recipients !== undefined && recipients > 0 && <span className="hidden text-sm text-muted-foreground sm:inline">Vai para {plural(recipients, 'cliente', 'clientes')}</span>}
              <Button type="submit" disabled={announce.isPending} className="w-full sm:w-auto">
                {announce.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                Enviar aviso
              </Button>
            </div>
          </div>
        </form>

        <aside className="hidden lg:block">
          <div className="sticky top-[5.5rem] space-y-2">
            <p className="text-sm font-medium">Como o cliente vê</p>
            <AnnouncementPreview title={title} body={body} email={email} companyName={company?.tradeName ?? 'Locamania'} />
          </div>
        </aside>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Avisos enviados</h2>
        <Card className={history.isFetching && !history.isLoading ? 'opacity-70 transition-opacity' : undefined}>
          {history.error ? (
            <p className="p-6 text-sm text-destructive">{errorMessage(history.error)}</p>
          ) : (
            <DataTable
              rows={history.data?.data}
              loading={history.isLoading}
              columns={columns}
              rowKey={(a) => a.id}
              onRowClick={setOpen}
              empty={{ icon: Megaphone, title: 'Nenhum aviso enviado ainda', description: 'Os avisos que você mandar aparecem aqui.' }}
              mobileCard={(a) => (
                <MobileRow
                  title={a.title}
                  wrapTitle
                  subtitle={a.body}
                  meta={
                    <>
                      <span>{plural(a.recipientsCount, 'cliente', 'clientes')}</span>
                      <span>{shortWhen(a.createdAt)}</span>
                    </>
                  }
                />
              )}
            />
          )}
          {history.data && history.data.totalPages > 1 && (
            <div className="border-t border-border p-3">
              <Pagination page={history.data.page} totalPages={history.data.totalPages} total={history.data.total} unit="avisos" onPageChange={(p) => setQ({ page: String(p) })} />
            </div>
          )}
        </Card>
      </section>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        {open && (
          <>
            <DialogHeader>
              <DialogTitle>{open.title}</DialogTitle>
              <DialogDescription>Enviado em {formatDateTime(open.createdAt)}</DialogDescription>
            </DialogHeader>
            <p className="whitespace-pre-line break-words rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">{open.body}</p>
            <DetailList
              className="mt-4"
              items={[
                { label: 'Para', value: AUDIENCE_LABEL[open.audience] },
                { label: 'Recebido por', value: plural(open.recipientsCount, 'cliente', 'clientes') },
                { label: 'Enviado por', value: open.createdBy },
              ]}
            />
            <Button
              variant="outline"
              className="mt-5 w-full"
              onClick={() => {
                setTitle(open.title);
                setBody(open.body);
                setOpen(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Usar como modelo para um novo aviso
            </Button>
          </>
        )}
      </Dialog>
    </div>
  );
}
