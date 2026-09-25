'use client';

import { STAFF_ROLE_LABELS, formatPhone, type StaffRole, type UserDto } from '@locamania/shared';
import { Archive, KeyRound, LogOut, MoreHorizontal, Pencil, Plus, UserCheck, UserX, Users } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { PasswordDialog, UserFormDialog } from '@/components/settings/user-dialogs';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DetailList, MobileRow } from '@/components/ui/kit';
import { PageHeader } from '@/components/ui/page-header';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useStaff } from '@/lib/auth/use-auth';
import { useArchiveUser, useCreateUser, useEndUserSessions, useSetUserPassword, useUpdateUser, useUsers } from '@/lib/queries';
import { shortWhen } from '@/lib/settings/format';
import { ROLE_VARIANT } from '@/lib/settings/meta';
import { formatDateTime } from '@/lib/utils';

const ROLE_ORDER: StaffRole[] = ['OWNER', 'ADMIN', 'FINANCE', 'STAFF'];

function RoleBadge({ role }: { role: StaffRole }) {
  return <Badge variant={ROLE_VARIANT[role]}>{STAFF_ROLE_LABELS[role]}</Badge>;
}

function lastLogin(u: UserDto): string {
  return u.lastLoginAt ? shortWhen(u.lastLoginAt) : 'Nunca entrou';
}

type Action = { key: string; label: string; icon: ReactNode; run: () => void; destructive?: boolean };

export default function UsersPage() {
  const me = useStaff();
  const { data, isLoading, error } = useUsers();
  const create = useCreateUser();
  const update = useUpdateUser();
  const setPassword = useSetUserPassword();
  const endSessions = useEndUserSessions();
  const archive = useArchiveUser();
  const confirm = useConfirm();

  const [form, setForm] = useState<{ open: boolean; user: UserDto | null }>({ open: false, user: null });
  const [passwordFor, setPasswordFor] = useState<UserDto | null>(null);
  const [sheet, setSheet] = useState<UserDto | null>(null);

  const rows = data
    ? [...data].sort((a, b) => Number(b.active) - Number(a.active) || ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name, 'pt-BR'))
    : undefined;
  const activeCount = data?.filter((u) => u.active).length ?? 0;

  async function act(fn: () => Promise<unknown>, ok: string, description?: string) {
    try {
      await fn();
      toast.success(ok, description ? { description } : undefined);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  function actionsFor(u: UserDto): Action[] {
    const self = u.id === me?.id;
    const list: Action[] = [
      { key: 'edit', label: 'Editar dados e perfil', icon: <Pencil />, run: () => setForm({ open: true, user: u }) },
      { key: 'password', label: 'Definir nova senha', icon: <KeyRound />, run: () => setPasswordFor(u) },
      {
        key: 'sessions',
        label: 'Encerrar sessões',
        icon: <LogOut />,
        run: async () => {
          if (
            await confirm({
              title: `Encerrar as sessões de ${u.name}?`,
              description: self ? 'Você sai de todos os aparelhos, inclusive deste, e precisa entrar de novo.' : 'A pessoa sai de todos os aparelhos e precisa entrar de novo.',
              confirmText: 'Encerrar sessões',
            })
          )
            await act(() => endSessions.mutateAsync(u.id), 'Sessões encerradas', u.name);
        },
      },
    ];
    if (!self) {
      list.push(
        u.active
          ? {
              key: 'deactivate',
              label: 'Desativar acesso',
              icon: <UserX />,
              run: async () => {
                if (await confirm({ title: `Desativar ${u.name}?`, description: 'A pessoa sai do sistema na hora e não consegue mais entrar. Dá para reativar depois.', confirmText: 'Desativar', variant: 'destructive' }))
                  await act(() => update.mutateAsync({ id: u.id, active: false }), 'Acesso desativado', u.name);
              },
            }
          : { key: 'activate', label: 'Reativar acesso', icon: <UserCheck />, run: () => void act(() => update.mutateAsync({ id: u.id, active: true }), 'Acesso reativado', u.name) },
        {
          key: 'archive',
          label: 'Arquivar',
          icon: <Archive />,
          destructive: true,
          run: async () => {
            if (
              await confirm({
                title: `Arquivar ${u.name}?`,
                description: 'Sai da lista e perde o acesso. O histórico do que a pessoa fez continua guardado.',
                confirmText: 'Arquivar',
                variant: 'destructive',
              })
            )
              await act(() => archive.mutateAsync(u.id), 'Usuário arquivado', u.name);
          },
        },
      );
    }
    return list;
  }

  const columns: Column<UserDto>[] = [
    {
      key: 'name',
      header: 'Usuário',
      cell: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} />
          <div className="min-w-0">
            <p className="truncate font-medium">
              {u.name} {u.id === me?.id && <span className="text-xs font-normal text-muted-foreground">(você)</span>}
            </p>
            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Perfil', cell: (u) => <RoleBadge role={u.role} /> },
    { key: 'phone', header: 'Celular', hideBelow: 'xl', cell: (u) => (u.phone ? <span className="whitespace-nowrap tabular">{formatPhone(u.phone)}</span> : <span className="text-muted-foreground">—</span>) },
    { key: 'last', header: 'Último acesso', hideBelow: 'lg', cell: (u) => <span className="whitespace-nowrap text-sm text-muted-foreground tabular">{lastLogin(u)}</span> },
    { key: 'status', header: 'Situação', cell: (u) => (u.active ? <Badge variant="success">Ativo</Badge> : <Badge variant="muted">Desativado</Badge>) },
    {
      key: 'menu',
      header: '',
      className: 'w-12',
      cell: (u) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Ações de {u.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {actionsFor(u).map((a, i, all) => (
              <div key={a.key}>
                {a.destructive && i > 0 && !all[i - 1]!.destructive && <DropdownMenuSeparator />}
                <DropdownMenuItem onSelect={a.run} variant={a.destructive ? 'destructive' : 'default'}>
                  {a.icon} {a.label}
                </DropdownMenuItem>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const current = sheet ? (data?.find((u) => u.id === sheet.id) ?? sheet) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Usuários"
        description={data ? `${activeCount} ${activeCount === 1 ? 'pessoa com acesso' : 'pessoas com acesso'} ao painel. Cada uma entra com o próprio e-mail e senha.` : 'Quem entra no painel e com qual perfil.'}
        actions={
          <Button className="w-full sm:w-auto" onClick={() => setForm({ open: true, user: null })}>
            <Plus /> Novo usuário
          </Button>
        }
      />
      <Card>
        {error ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : (
          <DataTable
            rows={rows}
            loading={isLoading}
            columns={columns}
            rowKey={(u) => u.id}
            onRowClick={(u) => setSheet(u)}
            rowClassName={(u) => (u.active ? undefined : 'opacity-60')}
            empty={{ icon: Users, title: 'Nenhum usuário' }}
            mobileCard={(u) => (
              <MobileRow
                leading={<Avatar name={u.name} />}
                title={u.id === me?.id ? `${u.name} (você)` : u.name}
                subtitle={u.email}
                meta={<span>Último acesso: {lastLogin(u)}</span>}
                right={
                  <>
                    <RoleBadge role={u.role} />
                    {!u.active && <Badge variant="muted">Desativado</Badge>}
                  </>
                }
              />
            )}
          />
        )}
      </Card>
      <p className="text-sm text-muted-foreground">
        O que cada perfil pode fazer fica em{' '}
        <Link href="/admin/settings/permissions" className="font-medium text-primary hover:underline">
          Permissões
        </Link>
        .
      </p>

      {/* Ficha rápida (toque na linha): dados + ações, igual no celular e no computador */}
      <Dialog open={!!current} onOpenChange={(o) => !o && setSheet(null)}>
        {current && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <Avatar name={current.name} className="size-11" />
                <div className="min-w-0">
                  <DialogTitle>{current.name}</DialogTitle>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <RoleBadge role={current.role} />
                    {current.active ? <Badge variant="success">Ativo</Badge> : <Badge variant="muted">Desativado</Badge>}
                    {current.id === me?.id && <span className="text-xs text-muted-foreground">Você</span>}
                  </div>
                </div>
              </div>
            </DialogHeader>
            <DetailList
              items={[
                { label: 'E-mail (login)', value: current.email },
                { label: 'Celular', value: current.phone ? formatPhone(current.phone) : null },
                { label: 'Último acesso', value: lastLogin(current) },
                { label: 'Cadastrado em', value: formatDateTime(current.createdAt) },
              ]}
            />
            <div className="mt-5 divide-y divide-border overflow-hidden rounded-xl border border-border">
              {actionsFor(current).map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => {
                    setSheet(null);
                    a.run();
                  }}
                  className={`flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm transition-colors hover:bg-accent active:bg-muted [&_svg]:size-4 [&_svg]:shrink-0 ${a.destructive ? 'text-destructive' : ''}`}
                >
                  {a.icon}
                  {a.label}
                </button>
              ))}
            </div>
          </>
        )}
      </Dialog>

      <UserFormDialog
        open={form.open}
        user={form.user}
        isSelf={!!form.user && form.user.id === me?.id}
        canGrantOwner={me?.role === 'OWNER'}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        onCreate={async (body) => {
          const u = await create.mutateAsync(body);
          toast.success('Usuário cadastrado', { description: `${u.name} já pode entrar com ${u.email}.` });
        }}
        onUpdate={async (body) => {
          // Só o que mudou: reenviar o perfil igual derrubaria a sessão à toa (e a API
          // recusa "Proprietário" vindo de quem não é Proprietário, mesmo sem mudança).
          const before = form.user!;
          const patch = Object.fromEntries(Object.entries(body).filter(([k, v]) => before[k as keyof typeof body] !== v));
          if (Object.keys(patch).length) await update.mutateAsync({ id: before.id, ...patch });
          toast.success('Usuário salvo', { description: body.name });
        }}
      />
      <PasswordDialog
        user={passwordFor}
        onOpenChange={(o) => !o && setPasswordFor(null)}
        onSubmit={async (password) => {
          await setPassword.mutateAsync({ id: passwordFor!.id, password });
          toast.success('Senha definida', { description: `Passe a nova senha para ${passwordFor!.name}.` });
        }}
      />
    </div>
  );
}
