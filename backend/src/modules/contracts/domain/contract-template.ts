/**
 * Modelo padrão do contrato de locação de motocicleta.
 *
 * ⚠️ É um MODELO de partida, redigido para o MVP: precisa ser revisado por um
 * advogado antes do uso real. A administradora edita o texto em
 * Configurações › Contrato; o que foi gerado para um contrato fica congelado
 * (Contract.renderedText) e não muda se o modelo mudar depois.
 *
 * Marcadores `{{...}}` são substituídos na geração. Linhas que começam com
 * "CLÁUSULA" viram títulos no PDF.
 */
export const DEFAULT_CONTRACT_TEMPLATE = `CONTRATO DE LOCAÇÃO DE MOTOCICLETA Nº {{contrato.numero}}

LOCADORA: {{empresa.razaoSocial}}, inscrita no CNPJ sob o nº {{empresa.cnpj}}, com sede em {{empresa.endereco}}, doravante denominada LOCADORA.

LOCATÁRIO(A): {{cliente.nome}}, inscrito(a) no CPF sob o nº {{cliente.cpf}}, RG nº {{cliente.rg}}, residente em {{cliente.endereco}}, telefone {{cliente.telefone}}, portador(a) da CNH nº {{cliente.cnh}}, categoria {{cliente.cnhCategoria}}, válida até {{cliente.cnhValidade}}, doravante denominado(a) LOCATÁRIO(A).

As partes acima identificadas celebram o presente contrato de locação de motocicleta, que se regerá pelas cláusulas a seguir.

CLÁUSULA 1ª — DO OBJETO
1.1. A LOCADORA aluga ao(à) LOCATÁRIO(A) a motocicleta {{moto.descricao}}, placa {{moto.placa}}, ano {{moto.ano}}, cor {{moto.cor}}, RENAVAM {{moto.renavam}}, chassi {{moto.chassi}}, entregue com {{moto.kmInicial}} rodados, em perfeito estado de funcionamento e conservação, com a documentação obrigatória.

CLÁUSULA 2ª — DO PRAZO
2.1. A locação tem início em {{contrato.inicio}} e término em {{contrato.termino}}, podendo ser prorrogada por acordo entre as partes, registrado no sistema da LOCADORA.
2.2. Ao final do prazo, o(a) LOCATÁRIO(A) deverá devolver a motocicleta na sede da LOCADORA, nas mesmas condições em que a recebeu, ressalvado o desgaste natural pelo uso normal.

CLÁUSULA 3ª — DO VALOR E DO PAGAMENTO
3.1. O valor da locação é de {{contrato.valor}} por {{contrato.periodo}}, com pagamento {{contrato.periodicidade}} e primeiro vencimento em {{contrato.primeiroVencimento}}, antecipadamente ao período de uso.
3.2. Os pagamentos serão feitos pelos meios disponibilizados pela LOCADORA, inclusive PIX pelo aplicativo. O pagamento só será considerado efetuado após a confirmação do recebimento pela LOCADORA.
3.3. O atraso no pagamento, após a tolerância de {{regras.tolerancia}} dia(s), sujeitará o(a) LOCATÁRIO(A) a multa de {{regras.multa}} sobre o valor devido e juros de {{regras.juros}} ao mês, calculados por dia de atraso.
3.4. O atraso poderá implicar, além dos encargos, o bloqueio administrativo do cadastro e o encaminhamento do débito para cobrança, na forma prevista neste contrato.

CLÁUSULA 4ª — DA CAUÇÃO
4.1. O(A) LOCATÁRIO(A) entrega à LOCADORA, a título de caução, o valor de {{contrato.caucao}}, que será devolvido ao término da locação, deduzidos eventuais débitos, multas, avarias ou valores pendentes apurados na vistoria de devolução.

CLÁUSULA 5ª — DAS OBRIGAÇÕES DO(A) LOCATÁRIO(A)
5.1. Utilizar a motocicleta com cuidado, conforme a legislação de trânsito, sendo o único responsável por sua condução.
5.2. Não sublocar, emprestar ou ceder a motocicleta a terceiros, nem permitir que seja conduzida por pessoa não habilitada.
5.3. Manter a CNH válida durante toda a locação e comunicar imediatamente qualquer suspensão ou cassação.
5.4. Levar a motocicleta às manutenções programadas quando avisado pela LOCADORA, informando corretamente a quilometragem sempre que solicitado.
5.5. Comunicar imediatamente à LOCADORA qualquer acidente, avaria, furto, roubo ou problema mecânico, registrando boletim de ocorrência quando cabível.
5.6. Arcar com as multas de trânsito e demais penalidades cometidas durante o período de locação, autorizando a indicação do condutor junto aos órgãos de trânsito.
5.7. Arcar com os danos causados à motocicleta ou a terceiros por uso inadequado, negligência ou imprudência.

CLÁUSULA 6ª — DAS OBRIGAÇÕES DA LOCADORA
6.1. Entregar a motocicleta em condições de uso, com documentação regular.
6.2. Realizar as manutenções preventivas programadas, sem custo ao(à) LOCATÁRIO(A), salvo as decorrentes de mau uso.
6.3. Manter canal de atendimento ao(à) LOCATÁRIO(A) pelo aplicativo, telefone e WhatsApp.

CLÁUSULA 7ª — DO RASTREAMENTO
7.1. A motocicleta poderá possuir equipamento de rastreamento, utilizado para segurança do patrimônio e localização em caso de furto, roubo ou inadimplência, respeitada a legislação aplicável. Eventual bloqueio seguirá as funcionalidades e limitações de segurança do equipamento, nunca com a motocicleta em movimento.

CLÁUSULA 8ª — DA DEVOLUÇÃO E DA RESCISÃO
8.1. Na devolução será feita vistoria, com registro de quilometragem, estado de conservação, fotos e pendências.
8.2. O contrato poderá ser rescindido por qualquer das partes mediante aviso prévio, ou imediatamente pela LOCADORA em caso de descumprimento das obrigações deste contrato, especialmente atraso de pagamento, uso indevido ou sublocação.

CLÁUSULA 9ª — REGRAS ESPECÍFICAS DESTA LOCAÇÃO
{{contrato.regras}}

CLÁUSULA 10ª — DA PROTEÇÃO DE DADOS (LGPD)
10.1. Os dados pessoais do(a) LOCATÁRIO(A) serão tratados pela LOCADORA exclusivamente para a execução deste contrato, cumprimento de obrigações legais e proteção do crédito e do patrimônio, nos termos da Lei nº 13.709/2018, podendo o(a) titular exercer seus direitos pelos canais de atendimento da LOCADORA.

CLÁUSULA 11ª — DO FORO
11.1. Fica eleito o foro da comarca de {{empresa.cidade}} para dirimir quaisquer dúvidas oriundas deste contrato.

Observações: {{contrato.observacoes}}

E, por estarem de acordo, as partes assinam o presente contrato.

{{empresa.cidade}}, {{data.hoje}}.`;

export type ContractTemplateValues = Record<string, string>;

/** Substitui os marcadores; o que não existir fica como "—" (nunca "{{...}}" no contrato). */
export function renderContractTemplate(template: string, values: ContractTemplateValues): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const value = values[key];
    return value && value.trim() ? value : '—';
  });
}

/** Marcadores disponíveis — mostrados ao lado do editor do modelo. */
export const CONTRACT_PLACEHOLDERS: { key: string; description: string }[] = [
  { key: 'contrato.numero', description: 'Número do contrato (LOC-AAAA-NNNN)' },
  { key: 'contrato.inicio', description: 'Data de início' },
  { key: 'contrato.termino', description: 'Data de término' },
  { key: 'contrato.valor', description: 'Valor do aluguel (R$)' },
  { key: 'contrato.periodo', description: 'semana / quinzena / mês' },
  { key: 'contrato.periodicidade', description: 'semanal / quinzenal / mensal' },
  { key: 'contrato.primeiroVencimento', description: 'Data do 1º vencimento' },
  { key: 'contrato.caucao', description: 'Valor da caução' },
  { key: 'contrato.regras', description: 'Regras específicas do contrato' },
  { key: 'contrato.observacoes', description: 'Observações do contrato' },
  { key: 'cliente.nome', description: 'Nome do cliente' },
  { key: 'cliente.cpf', description: 'CPF' },
  { key: 'cliente.rg', description: 'RG' },
  { key: 'cliente.endereco', description: 'Endereço completo' },
  { key: 'cliente.telefone', description: 'Telefone / WhatsApp' },
  { key: 'cliente.cnh', description: 'Número da CNH' },
  { key: 'cliente.cnhCategoria', description: 'Categoria da CNH' },
  { key: 'cliente.cnhValidade', description: 'Validade da CNH' },
  { key: 'moto.descricao', description: 'Marca e modelo' },
  { key: 'moto.placa', description: 'Placa' },
  { key: 'moto.ano', description: 'Ano' },
  { key: 'moto.cor', description: 'Cor' },
  { key: 'moto.renavam', description: 'RENAVAM' },
  { key: 'moto.chassi', description: 'Chassi' },
  { key: 'moto.kmInicial', description: 'Quilometragem na entrega' },
  { key: 'regras.tolerancia', description: 'Dias de tolerância' },
  { key: 'regras.multa', description: 'Multa por atraso (%)' },
  { key: 'regras.juros', description: 'Juros ao mês (%)' },
  { key: 'empresa.nome', description: 'Nome fantasia' },
  { key: 'empresa.razaoSocial', description: 'Razão social' },
  { key: 'empresa.cnpj', description: 'CNPJ' },
  { key: 'empresa.endereco', description: 'Endereço da empresa' },
  { key: 'empresa.cidade', description: 'Cidade da empresa (foro)' },
  { key: 'data.hoje', description: 'Data de geração' },
];
