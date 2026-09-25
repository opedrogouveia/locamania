# Design System — Locamania (frontend)

> Convenções de UI. **Reusar sempre; nunca hardcodar cor.** Next.js 16 + Tailwind v4 (CSS-first, sem
> `tailwind.config`) + primitivos próprios estilo shadcn (sem Radix). Ícones: `lucide-react`.
> Base herdada do SafeKeep (primitivos acessíveis), adaptada para pt-BR e para o celular.

## 1. Tokens e tema

- Em `frontend/src/app/globals.css`, em **OKLCH**, `:root` (claro) e `.dark` (escuro), mapeados por
  `@theme inline`. Dark mode por classe, aplicado antes da pintura (`themeInitScript`).
- **Semânticos** (use só estes): `bg-background/card/popover/primary/secondary/muted/accent`,
  `text-foreground/muted-foreground/primary`, `border-border`, `ring-ring`, e os estados
  `success`, `warning`, `destructive`, `info` (+ `-foreground`).
- **Marca provisória**: `--brand`, `--brand-strong`, `--brand-accent` (logo, login, destaques do app do
  cliente). A cor de interface é o azul de `--primary`. Quando a identidade da Locamania chegar,
  troca-se `--primary`, `--ring`, `--accent`, `--chart-1` e os `--brand-*` — **os neutros continuam
  cinza** (lição do SafeKeep: marca que invade o fundo pesa).
- Nunca `bg-blue-500`, `#hex` ou `slate-*` em tela.

## 2. Primitivos (`components/ui/`)

button (default/secondary/outline/ghost/destructive/link; sm/default/lg/icon/icon-sm; `asChild`),
input, password-input, label, textarea, select, select-menu, switch, card, badge
(default/secondary/outline/success/warning/destructive/info/muted), table, **data-table**
(tabela no desktop, cartões no celular), skeleton, separator, avatar, spinner, tooltip,
dropdown-menu, dialog (**folha de baixo no celular**), confirm-dialog (`useConfirm()`), toaster
(`toast.success/error/warning/info`), theme-toggle, empty-state, page-header, back-link, form-error,
pagination, tabs (controláveis; **rolam de lado no celular**), lookup (busca que só seleciona, com
"Cadastrar" no rodapé), save-indicator, stat-card, filter-chips, field, masked/money inputs.

## 3. Cascas

- **Painel** (`admin-shell.tsx`): sidebar agrupada e recolhível (desktop); no celular, barra superior
  com título + busca + sino, **barra inferior** (Painel, Clientes, Motos, Pagamentos, Menu) e gaveta
  com o menu completo. Menu filtrado pelas permissões (`admin-nav.ts`).
- **App do cliente** (`customer-shell.tsx`): conteúdo centralizado (máx. 768 px); barra inferior
  (Início, Pagamentos, Moto, Avisos, Mais) no celular; itens no topo no desktop.
- **Acesso** (`auth-layout.tsx`): uma coluna no celular; painel de marca à esquerda no desktop.

## 4. Padrões de tela

- **Lista**: `PageHeader` (título + ação principal) → `FilterChips`/busca → `DataTable` → `Pagination`.
  `Skeleton` no carregamento, `EmptyState` no vazio. Linha/cartão clicável abre a ficha.
- **Ficha** (cliente, moto, contrato): cabeçalho com nome, situação (badge) e ações rápidas → cartões
  de resumo → **abas** (Resumo, Contratos, Pagamentos, Documentos, Histórico…), com a aba na URL
  (`?tab=`) para o link abrir nela.
- **Formulário de cadastro**: seções em `Card` com `Field` (rótulo, dica, erro), máscaras (CPF, CEP,
  telefone, placa, dinheiro), CEP preenchendo o endereço, um botão principal no fim (no celular, largo).
- **Edição**: mesma tela do cadastro, com os dados preenchidos (um salvar por seção).
- **Assistente** (novo aluguel): passos numerados, resumo lateral no desktop / no fim no celular.
- **Ação rápida** (registrar pagamento, concluir manutenção): `Dialog` — folha de baixo no celular.
- **Destrutivo**: `useConfirm({ variant: 'destructive' })`. Arquivar, nunca "excluir".
- **Feedback**: `toast` (nunca `alert`).

## 5. Responsividade (regra do projeto — "impecável")

1. Desenhar para **390 px primeiro**; conferir em 390 px e 1440 px antes de dar por pronto.
2. **Zero rolagem horizontal** da página. Tabela larga vira cartão no celular (`DataTable`).
3. Alvos de toque ≥ **44 px**; ação principal ao alcance do polegar (barra inferior, botão largo no fim).
4. Campo com fonte **16 px** no celular (o iOS dá zoom se for menor — já no `globals.css`).
5. Teclado certo: `inputMode="numeric"` (CPF, CEP, km), `"decimal"` (dinheiro), `"tel"`, `"email"`.
6. Diálogo vira folha de baixo com rolagem própria; rodapé de ações fixo.
7. Abas e filtros rolam de lado; nada quebra em três linhas.
8. Área segura do iPhone (`pt-safe`, `pb-safe`) nas barras fixas.
9. Números em colunas com `tabular` (alinhamento de valores).

## 6. Status e cores de domínio

Rótulo vem do shared (`labels.ts`); variante do Badge vem de `lib/<domínio>/meta.ts`:

| Situação | Variante |
|---|---|
| Moto: Disponível / Alugada / Reservada / Manutenção / Bloqueada / Inativa | success / info / default / warning / destructive / muted |
| Cobrança: Pago / A vencer / Próximo / Em atraso / Cancelado | success / muted / warning / destructive / outline |
| Cliente: Ativo / Em atraso / Bloqueado / Contrato encerrado / Inativo | success / destructive / destructive / muted / muted |
| Manutenção: Em dia / Próxima / Vencida | success / warning / destructive |

Alertas (dashboard e notificações): 🔴 `destructive` (atraso, vencido), 🟡 `warning` (próximo),
🟢 `success` (pagamento recebido), 🔵 `info`.

## 7. Verificação de tela

`next dev` + Chromium headless (script em `scripts/` / scratchpad) fotografando cada rota em 390×844 e
1440×900 e acusando rolagem horizontal e erros de console. Conferir o CSS servido depois de mudar
`globals.css` (o Turbopack só recompila com mudança real de conteúdo).
