'use client';

import { Braces, Loader2, RotateCcw, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StickyActions } from '@/components/ui/kit';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { usePlaceholders, useRestoreTemplate, useUpdateCompany } from '@/lib/queries';
import { cn } from '@/lib/utils';

type Placeholder = { key: string; description: string };

const PREFIX_LABEL: Record<string, string> = {
  contrato: 'Contrato',
  cliente: 'Cliente',
  moto: 'Moto',
  regras: 'Regras de pagamento',
  empresa: 'Empresa',
  data: 'Datas',
};

const MIN_LENGTH = 200;

/** Descrições mais claras para a tela (as da API são curtas demais em alguns casos). */
const DESCRIPTION: Record<string, string> = {
  'contrato.numero': 'Número do contrato',
  'contrato.periodo': 'Período do aluguel (semana, quinzena ou mês)',
  'contrato.periodicidade': 'Forma de cobrança (semanal, quinzenal ou mensal)',
  'contrato.valor': 'Valor do aluguel',
  'moto.descricao': 'Marca e modelo da moto',
};

function groupPlaceholders(list: Placeholder[]): { label: string; items: Placeholder[] }[] {
  const map = new Map<string, Placeholder[]>();
  for (const p of list) {
    const prefix = p.key.split('.')[0] ?? '';
    map.set(prefix, [...(map.get(prefix) ?? []), p]);
  }
  return [...map.entries()].map(([prefix, items]) => ({ label: PREFIX_LABEL[prefix] ?? prefix, items }));
}

function PlaceholderList({ groups, onPick }: { groups: { label: string; items: Placeholder[] }[]; onPick: (key: string) => void }) {
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.label} className="space-y-1">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</p>
          <ul>
            {g.items.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => onPick(p.key)}
                  className="flex min-h-11 w-full flex-col items-start justify-center rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent active:bg-muted"
                >
                  <span className="text-sm">{DESCRIPTION[p.key] ?? p.description}</span>
                  <code className="text-xs text-primary">{`{{${p.key}}}`}</code>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Editor do modelo de contrato: texto grande, marcadores clicáveis que entram
 * na posição do cursor, aviso de marcador que não existe (sairia "—").
 */
export function ContractTemplateEditor({ template }: { template: string }) {
  const { data: placeholders, isLoading: loadingPh } = usePlaceholders();
  const save = useUpdateCompany();
  const restore = useRestoreTemplate();
  const confirm = useConfirm();
  const [text, setText] = useState(template);
  const [base, setBase] = useState(template);
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const selection = useRef<{ start: number; end: number }>({ start: template.length, end: template.length });
  const caretAfter = useRef<number | null>(null);

  useEffect(() => {
    setText(template);
    setBase(template);
  }, [template]);

  // Depois de inserir, devolve o foco com o cursor logo após o marcador.
  useEffect(() => {
    if (caretAfter.current === null || !ref.current) return;
    const pos = caretAfter.current;
    caretAfter.current = null;
    ref.current.focus({ preventScroll: true });
    ref.current.setSelectionRange(pos, pos);
  }, [text]);

  const groups = useMemo(() => groupPlaceholders(placeholders ?? []), [placeholders]);
  const known = useMemo(() => new Set((placeholders ?? []).map((p) => p.key)), [placeholders]);
  const used = useMemo(() => [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]!), [text]);
  const unknown = placeholders ? [...new Set(used.filter((k) => !known.has(k)))] : [];
  const dirty = text !== base;

  function remember() {
    const el = ref.current;
    if (el) selection.current = { start: el.selectionStart, end: el.selectionEnd };
  }

  function insert(key: string) {
    const token = `{{${key}}}`;
    const { start, end } = selection.current;
    const s = Math.min(start, text.length);
    const e = Math.min(end, text.length);
    const next = text.slice(0, s) + token + text.slice(e);
    caretAfter.current = s + token.length;
    selection.current = { start: s + token.length, end: s + token.length };
    setText(next);
    setSheet(false);
    setError(null);
  }

  async function onSave() {
    if (text.trim().length < MIN_LENGTH) {
      setError('O modelo parece incompleto (muito curto). Confira o texto antes de salvar.');
      return;
    }
    setError(null);
    try {
      await save.mutateAsync({ contractTemplate: text });
      setBase(text);
      toast.success('Modelo de contrato salvo', { description: 'Vale para os próximos contratos gerados.' });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onRestore() {
    const ok = await confirm({
      title: 'Restaurar o texto padrão?',
      description: `O texto atual${dirty ? ' (inclusive o que não foi salvo)' : ''} será trocado pelo modelo original do sistema. Contratos já gerados não mudam.`,
      confirmText: 'Restaurar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      const out = await restore.mutateAsync();
      setText(out.contractTemplate);
      setBase(out.contractTemplate);
      toast.success('Modelo padrão restaurado');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="lg:hidden" onClick={() => (remember(), setSheet(true))}>
              <Braces /> Inserir campo
            </Button>
            <Button type="button" variant="ghost" onClick={onRestore} disabled={restore.isPending}>
              {restore.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              Restaurar o padrão
            </Button>
            <span className="ml-auto text-xs text-muted-foreground tabular">
              {text.length.toLocaleString('pt-BR')} caracteres · {used.length} {used.length === 1 ? 'campo' : 'campos'}
            </span>
          </div>
          <Textarea
            ref={ref}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            onSelect={remember}
            onKeyUp={remember}
            onClick={remember}
            onBlur={remember}
            spellCheck
            aria-label="Texto do modelo de contrato"
            className="min-h-[60vh] resize-y px-4 py-3 text-[15px] leading-relaxed sm:min-h-[65vh]"
          />
          {unknown.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-warning/12 p-3 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <p>
                {unknown.length === 1 ? 'Este campo não existe e vai sair' : 'Estes campos não existem e vão sair'} como “—” no contrato:{' '}
                {unknown.map((k) => (
                  <code key={k} className="mx-0.5 rounded bg-card px-1 text-xs">{`{{${k}}}`}</code>
                ))}
              </p>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            Linhas que começam com <strong>CLÁUSULA</strong> viram títulos no PDF. O texto padrão é um modelo de partida: vale a revisão de um advogado.
          </p>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-[5.5rem] rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Campos automáticos</p>
              <p className="text-xs text-muted-foreground">Clique para inserir onde está o cursor.</p>
            </div>
            <div className={cn('max-h-[calc(100dvh-12rem)] overflow-y-auto p-2')}>
              {loadingPh ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              ) : (
                <PlaceholderList groups={groups} onPick={insert} />
              )}
            </div>
          </div>
        </aside>
      </div>

      <StickyActions>
        <Button type="button" variant="outline" disabled={!dirty || save.isPending} onClick={() => (setText(base), setError(null))}>
          Desfazer
        </Button>
        <Button type="button" disabled={!dirty || save.isPending} onClick={onSave}>
          {save.isPending && <Loader2 className="animate-spin" />}
          Salvar modelo
        </Button>
      </StickyActions>

      <Dialog open={sheet} onOpenChange={setSheet}>
        <DialogHeader>
          <DialogTitle>Inserir campo</DialogTitle>
          <DialogDescription>Entra onde o cursor estava no texto.</DialogDescription>
        </DialogHeader>
        {loadingPh ? <Skeleton className="h-64 w-full" /> : <PlaceholderList groups={groups} onPick={insert} />}
      </Dialog>
    </div>
  );
}
