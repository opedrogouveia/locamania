import * as Sentry from '@sentry/node';

/**
 * Monitoramento de erro em produção.
 *
 * Sem DSN configurado, nada é inicializado e nada é enviado — em
 * desenvolvimento o log do terminal já basta, e não faz sentido mandar erro de
 * teste para um serviço externo.
 *
 * Precisa ser chamado ANTES de o Nest subir, para instrumentar o que carrega
 * no boot.
 */
export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    // Amostragem baixa: o plano gratuito tem cota, e o volume da Locamania não
    // exige trace de tudo.
    tracesSampleRate: 0.1,
    // Dado de cliente sob LGPD não vai para serviço externo.
    sendDefaultPii: false,
    beforeSend(event) {
      // Corpo de requisição carrega nome, e-mail e endereço do cliente.
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }
      return event;
    },
  });
  return true;
}

export { Sentry };
