# Manual da administração — Locamania

> Guia prático para a proprietária e a equipe. Cada tarefa em poucos passos.
> Funciona igual no computador e no celular (no celular, o menu completo fica em **Menu**, no
> canto de baixo; as telas mais usadas ficam na barra inferior).

## Entrar

- Endereço do sistema: o link enviado pelo Pedro (ex.: `https://locamania.vercel.app`).
- **Equipe** entra com o **e-mail**; **clientes** entram com o **CPF** — é a mesma tela.
- Esqueceu a senha? *Esqueci minha senha* na tela de entrada.
- No celular, instale como aplicativo: no navegador, **Compartilhar → Adicionar à tela de início**
  (iPhone) ou **⋮ → Instalar aplicativo** (Android).
- Pesquisa rápida em qualquer tela: 🔍 no topo (no computador, **Ctrl + K**). Digite nome, CPF,
  telefone, placa ou número do contrato. **Placa completa abre direto a ficha da moto.**

## O dia a dia

**Painel** (tela inicial) mostra: motos alugadas e livres, quanto entrou no mês, o que vence nos
próximos dias, o que está atrasado, e a lista de **alertas** (pagamentos atrasados, manutenção,
documentos vencendo, contratos terminando). Toque num alerta para ir direto ao que precisa.

Cores: 🔴 urgente · 🟡 atenção · 🟢 tudo certo · 🔵 informação.

## Novo aluguel (do cadastro à entrega)

1. **Clientes → Novo cliente**: nome e CPF são obrigatórios; o CEP preenche o endereço sozinho.
   Preencha a **CNH** (número, categoria A e validade) — sem ela o sistema não deixa alugar.
2. Na ficha do cliente → **Documentos** → *Anexar*: foto da CNH, comprovante de residência, RG.
   Pode tirar a foto na hora pelo celular.
3. **Novo aluguel** (na ficha do cliente, ou Contratos → Nova locação): escolha o cliente, a moto
   (só aparecem as disponíveis), a periodicidade (semanal, quinzenal, mensal), o valor, o início, o
   término e a caução. Confira a **prévia das parcelas** e confirme. A moto fica **Reservada**.
4. No contrato: **Ver PDF** para imprimir, ou **Enviar ao cliente** (WhatsApp/e-mail).
5. **Assinatura**: registre a assinatura presencial (anexando o contrato assinado, se quiser) ou
   peça para o cliente aceitar pelo aplicativo.
6. **Entregar moto**: informe a quilometragem de saída e tire as fotos. Nesse momento o sistema:
   gera todas as cobranças do período e a caução, muda a moto para **Alugada** e o cliente para
   **Ativo**.
7. Na ficha do cliente → **⋯ → Enviar acesso ao app**: manda o link para ele criar a senha
   (botão do WhatsApp com a mensagem pronta).

## Pagamentos

- **Pagamentos**: abas *A vencer*, *Próximos do vencimento*, *Em atraso*, *Pagos*, *Cancelados*.
- **Dar baixa** (dinheiro, cartão, transferência…): na cobrança → **⋯ → Registrar pagamento**.
  Se estiver atrasado, a multa e os juros já vêm calculados — pode ajustar ou dar desconto.
- **PIX pelo aplicativo**: o cliente paga pelo app e a baixa é **automática** (quando o banco
  confirma). Enquanto o gateway real não estiver contratado, o PIX é de **teste**.
- Lançou errado? **⋯ → Estornar pagamento** (pede o motivo; fica registrado).
- **Cobrança avulsa** (multa, avaria, taxa): Pagamentos → *Nova cobrança*.
- **Recibo**: nas cobranças pagas, **⋯ → Ver recibo** (PDF).

## Atrasos (inadimplência)

- Todo dia às 8h o sistema marca os atrasos, calcula encargos e manda lembretes (antes do
  vencimento, no dia e depois). Os prazos ficam em **Configurações → Parâmetros**.
- **Inadimplência**: lista de quem está devendo, há quantos dias e quanto (com encargos). Ações:
  **Cobrar no WhatsApp** (mensagem pronta), **Bloquear** o cliente, **Encaminhar para cobrança**.
- Depois de X dias de atraso (configurável) o sistema **sugere** o bloqueio — quem decide é você (ou ligue o bloqueio automático nos Parâmetros).

## Motos e manutenção

- **Motos → Nova moto**: placa, marca/modelo (se não existir na lista, cadastre ali mesmo), ano,
  cor, RENAVAM, chassi, quilometragem. O sistema cria sozinho o plano de manutenção padrão (troca
  de óleo, relação, pneus, freios, revisão…) — ajuste na aba **Manutenção** da moto.
- **Quilometragem**: atualize na ficha da moto (*Registrar km*); o cliente também pode informar
  pelo app. É ela que dispara os alertas por km.
- **Manutenção**: abas *Próximas*, *Vencidas*, *Em andamento*, *Realizadas*. *Nova manutenção*
  registra o serviço (custo, oficina, fotos); ao concluir, o próximo prazo é recalculado.
- Moto na oficina: mude a situação para **Em manutenção** (pede o motivo) — ela sai da lista de
  disponíveis.
- **Documentos da moto** (CRLV, seguro): na aba *Documentos*, com validade; marque *Visível para o
  cliente* para o CRLV aparecer no app dele.

## Devolução e encerramento

No contrato → **Devolução**: data, quilometragem final, estado da moto, combustível, avarias,
pendências e fotos. Decida a **caução** (devolver, reter parte ou tudo) e o destino da moto
(disponível ou manutenção). O contrato é encerrado e a moto volta para a frota.

## Ocorrências e multas

**Ocorrências e multas → Nova**: tipo (multa, acidente, avaria, furto/roubo, problema mecânico…), data, moto, cliente,
valor, fotos. **Cobrar do cliente** gera a cobrança avulsa ligada à ocorrência.

## Financeiro e relatórios

- **Financeiro**: escolha o período (hoje, semana, mês…) para ver recebido, pendente, atrasado,
  despesas e resultado; receita por moto e por cliente. **Lançamentos** para despesas (oficina,
  seguro, IPVA…) e receitas avulsas.
- **Relatórios**: frota, clientes, financeiro, manutenção e aluguéis — **Exportar PDF ou Excel**.

## Comunicação

- **Avisos aos clientes**: mande um aviso para todos (ou um grupo) — aparece no app deles.
- **Suporte**: mensagens que os clientes mandam pelo app; responda por ali (ele vê no app) ou pelo
  WhatsApp.
- 🔔 no topo: as notificações da equipe (atrasos, pagamentos confirmados, mensagens novas).

## Equipe e permissões (só a proprietária)

- **Configurações → Usuários**: crie a conta de cada pessoa com o perfil certo:
  - **Administrador**: tudo, menos gerenciar usuários.
  - **Financeiro**: pagamentos, financeiro e relatórios.
  - **Funcionário**: cadastros, motos, manutenção, documentos — **sem ver valores**.
- **Configurações → Permissões**: ajuste o que cada perfil pode fazer.
- Alguém saiu da empresa? Desative o usuário — ele perde o acesso na hora.

## Configurações

**Empresa** (dados, chave PIX, horário de atendimento — aparecem no app e no contrato) ·
**Parâmetros** (prazos de aviso, tolerância, multa, juros, bloqueio, alertas de manutenção e de
documentos) · **Cadastros** (marcas, modelos, tipos de documento, categorias) · **Tipos de
manutenção** · **Modelo de contrato** (o texto do contrato, com campos automáticos como
`{{cliente.nome}}`) · **Integrações** · **Sistema** (rotinas automáticas e backup).

## Histórico

**Histórico** mostra tudo o que foi feito, por quem e quando, em frases simples ("Marina registrou o
pagamento da cobrança PAG-002804"). Cada ficha também tem a aba *Histórico*. Nada é apagado:
**Arquivar** tira da lista, mas mantém o registro.

## O que o cliente vê no app

Início (situação, próximo pagamento com botão **PAGAR**), Pagamentos (PIX, histórico, recibos),
Minha moto (dados, informar km, documentos liberados), Meu contrato (PDF e aceite), Manutenção,
Avisos, Perfil e Suporte. Ele **nunca** vê custos, dados de outros clientes, anotações internas ou
informações da equipe.

## Sem internet

Se a conexão cair, aparece **"Sem conexão com a internet."** e nada é salvo até voltar — o sistema
não finge que salvou.
