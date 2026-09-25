import Link from 'next/link';

import { Brand } from '@/components/layout/brand';

export const metadata = { title: 'Aviso de privacidade' };

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Quais dados usamos',
    body: [
      'Dados de identificação e contato (nome, CPF, RG, data de nascimento, telefone, WhatsApp, e-mail e endereço), dados da CNH e documentos que você entrega, dados do contrato, pagamentos, quilometragem e ocorrências da moto alugada.',
      'Se a moto tiver rastreador, dados de localização e funcionamento do equipamento, usados para a segurança do patrimônio.',
    ],
  },
  {
    title: 'Para que usamos',
    body: [
      'Executar o contrato de locação: cadastro, cobrança, lembretes de pagamento, manutenção, avisos e suporte.',
      'Cumprir obrigações legais (por exemplo, indicação de condutor em multas de trânsito) e proteger o crédito e o patrimônio da Locamania.',
    ],
  },
  {
    title: 'Com quem compartilhamos',
    body: [
      'Somente com quem é necessário para o serviço: meios de pagamento, provedor de e-mail e mensagens, fornecedor do rastreador e órgãos públicos quando a lei exigir. Não vendemos seus dados.',
    ],
  },
  {
    title: 'Por quanto tempo guardamos',
    body: ['Durante o contrato e pelo prazo exigido pela legislação fiscal e civil depois do encerramento.'],
  },
  {
    title: 'Segurança',
    body: [
      'Acesso protegido por senha, cada cliente vê apenas os próprios dados, as senhas são guardadas de forma criptografada, e toda alteração fica registrada.',
    ],
  },
  {
    title: 'Seus direitos (LGPD)',
    body: [
      'Você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados (respeitadas as obrigações legais) e tirar dúvidas pelos canais de atendimento da Locamania, disponíveis em Suporte no aplicativo.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 pb-safe">
      <Link href="/login" aria-label="Locamania">
        <Brand />
      </Link>
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Aviso de privacidade</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Como a Locamania trata os dados pessoais de quem aluga uma moto, conforme a Lei nº 13.709/2018 (LGPD).
      </p>
      <div className="mt-8 space-y-7">
        {SECTIONS.map((s) => (
          <section key={s.title} className="space-y-2">
            <h2 className="text-base font-semibold">{s.title}</h2>
            {s.body.map((p) => (
              <p key={p} className="text-sm leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
      <p className="mt-10 text-xs text-muted-foreground">
        Texto-base do MVP — deve ser revisado pelo jurídico da Locamania antes do uso em produção.
      </p>
    </main>
  );
}
