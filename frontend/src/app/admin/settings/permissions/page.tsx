'use client';

import { PERMISSION_CATALOG, STAFF_ROLE_LABELS, type Permission, type PermissionMeta, type RolePermissionsDto, type StaffRole } from '@locamania/shared';
import { Lock, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useEffect, useMemo, useState } from 'react';

import { PendingBar } from '@/components/settings/pending-bar';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { usePermissions, useSetPermissions } from '@/lib/queries';
import { ROLE_HINT, permissionDependents, permissionRequires } from '@/lib/settings/meta';
import { useUrlState } from '@/lib/use-url-state';
import { cn } from '@/lib/utils';

const ROLES: StaffRole[] = ['OWNER', 'ADMIN', 'FINANCE', 'STAFF'];
type Matrix = Record<StaffRole, Set<Permission>>;

function toMatrix(rows: RolePermissionsDto[]): Matrix {
  const m = Object.fromEntries(ROLES.map((r) => [r, new Set<Permission>()])) as Matrix;
  for (const r of rows) m[r.role] = new Set(r.permissions);
  return m;
}

const GROUPS: { label: string; items: PermissionMeta[] }[] = (() => {
  const map = new Map<string, PermissionMeta[]>();
  for (const p of PERMISSION_CATALOG) map.set(p.group, [...(map.get(p.group) ?? []), p]);
  return [...map.entries()].map(([label, items]) => ({ label, items }));
})();

export default function PermissionsPage() {
  const { data, isLoading, error } = usePermissions();
  const save = useSetPermissions();
  const [q, setQ] = useUrlState({ role: 'ADMIN' });
  const [draft, setDraft] = useState<Matrix | null>(null);
  const [busy, setBusy] = useState(false);

  const saved = useMemo(() => (data ? toMatrix(data) : null), [data]);
  useEffect(() => {
    if (saved) setDraft(saved);
  }, [saved]);

  const locked = (role: StaffRole) => role === 'OWNER' || !!data?.find((r) => r.role === role)?.locked;

  const changes = useMemo(() => {
    if (!saved || !draft) return [] as { role: StaffRole; key: Permission }[];
    const out: { role: StaffRole; key: Permission }[] = [];
    for (const role of ROLES)
      for (const p of PERMISSION_CATALOG) if (saved[role].has(p.key) !== draft[role].has(p.key)) out.push({ role, key: p.key });
    return out;
  }, [saved, draft]);
  const changed = (role: StaffRole, key: Permission) => changes.some((c) => c.role === role && c.key === key);

  /** Liga/desliga respeitando a dependência "fazer" → "ver". */
  function toggle(role: StaffRole, key: Permission, on: boolean) {
    setDraft((d) => {
      if (!d) return d;
      const next = new Set(d[role]);
      if (on) {
        next.add(key);
        const req = permissionRequires(key);
        if (req) next.add(req);
      } else {
        next.delete(key);
        for (const dep of permissionDependents(key)) next.delete(dep);
      }
      return { ...d, [role]: next };
    });
  }

  async function onSave() {
    if (!draft) return;
    const roles = [...new Set(changes.map((c) => c.role))];
    setBusy(true);
    try {
      for (const role of roles) await save.mutateAsync({ role, permissions: [...draft[role]] });
      toast.success('Permissões salvas', { description: roles.map((r) => STAFF_ROLE_LABELS[r]).join(', ') });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const mobileRole = (ROLES as string[]).includes(q.role) ? (q.role as StaffRole) : 'ADMIN';

  const cell = (role: StaffRole, p: PermissionMeta) => {
    const on = draft![role].has(p.key);
    const id = `perm-${role}-${p.key}`;
    return (
      <span className="relative inline-flex">
        <label htmlFor={id} className="sr-only">
          {STAFF_ROLE_LABELS[role]}: {p.label}
        </label>
        <Switch id={id} checked={locked(role) || on} disabled={locked(role) || busy} onCheckedChange={(v) => toggle(role, p.key, v)} />
        {changed(role, p.key) && <span className="absolute -right-1.5 -top-1.5 size-2.5 rounded-full border-2 border-card bg-warning" aria-hidden />}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Permissões"
        description="O que cada perfil pode ver e fazer. O Proprietário sempre tem tudo — assim ninguém se tranca fora do sistema."
      />

      {isLoading || (!draft && !error) ? (
        <Skeleton className="h-[60vh] w-full" />
      ) : error || !draft ? (
        <EmptyState icon={TriangleAlert} title="Não foi possível carregar as permissões" description={errorMessage(error)} />
      ) : (
        <>
          {/* Desktop/tablet: matriz perfil × permissão */}
          <Card className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="sticky top-16 z-10 bg-card">
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Permissão</th>
                  {ROLES.map((r) => (
                    <th key={r} className="w-[118px] px-2 py-3 text-center font-medium">
                      <span className="block">{STAFF_ROLE_LABELS[r]}</span>
                      <span className="block text-xs font-normal text-muted-foreground tabular">
                        {locked(r) ? (
                          <span className="inline-flex items-center gap-1">
                            <Lock className="size-3" aria-hidden /> tudo
                          </span>
                        ) : (
                          `${draft[r].size} de ${PERMISSION_CATALOG.length}`
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GROUPS.map((g) => (
                  <Fragment key={g.label}>
                    <tr className="border-b border-border bg-muted/50">
                      <td colSpan={ROLES.length + 1} className="px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {g.label}
                      </td>
                    </tr>
                    {g.items.map((p) => (
                      <tr key={p.key} className="border-b border-border last:border-0 hover:bg-accent/30">
                        <td className="px-5 py-3">
                          <p className="font-medium">{p.label}</p>
                          <p className="text-xs text-muted-foreground">{p.description}</p>
                        </td>
                        {ROLES.map((r) => (
                          <td key={r} className={cn('px-2 py-3 text-center', r === 'OWNER' && 'bg-muted/30')}>
                            {cell(r, p)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Celular: escolhe o perfil e vê a lista dele */}
          <div className="space-y-4 md:hidden">
            <div role="radiogroup" aria-label="Perfil" className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => {
                const on = r === mobileRole;
                const pending = changes.filter((c) => c.role === r).length;
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setQ({ role: r })}
                    className={cn(
                      'relative flex h-11 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-accent',
                    )}
                  >
                    {locked(r) && <Lock className="size-3.5" aria-hidden />}
                    {STAFF_ROLE_LABELS[r]}
                    {pending > 0 && <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-warning text-[11px] text-warning-foreground">{pending}</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{STAFF_ROLE_LABELS[mobileRole]}</strong> · {ROLE_HINT[mobileRole]}
              {locked(mobileRole) ? ' — travado com todas as permissões.' : ` — ${draft[mobileRole].size} de ${PERMISSION_CATALOG.length} permissões.`}
            </p>
            {GROUPS.map((g) => (
              <section key={g.label} className="space-y-1.5">
                <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</h2>
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  {g.items.map((p) => (
                    <li key={p.key} className="flex min-h-14 items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium leading-snug">{p.label}</p>
                        <p className="text-[13px] text-muted-foreground">{p.description}</p>
                      </div>
                      {cell(mobileRole, p)}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            Ligar uma permissão de fazer (ex.: <em>Registrar pagamentos</em>) liga junto a de ver. Quem tem o perfil sente a mudança na próxima tela que abrir. Os
            perfis de cada pessoa ficam em{' '}
            <Link href="/admin/settings/users" className="font-medium text-primary hover:underline">
              Usuários
            </Link>
            .
          </p>

          <PendingBar count={changes.length} busy={busy} onSave={onSave} onDiscard={() => saved && setDraft(saved)} />
        </>
      )}
    </div>
  );
}
