import { NodeEnv } from './env.validation';

/**
 * Config tipada, derivada das variáveis já validadas. Ler com
 * `ConfigService<AppConfig, true>` e `config.get('jwt', { infer: true })`.
 */
export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  timezone: string;
  corsOrigin: string[];
  appPublicUrl: string;
  jwt: { secret: string; staffExpiresIn: string; customerExpiresIn: string };
  jobs: { secret: string | null; cronEnabled: boolean };
  payments: { gateway: 'sandbox' | 'disabled'; webhookSecret: string };
  whatsapp: { provider: 'disabled' };
  tracker: { provider: 'sandbox' | 'disabled' };
}

export function configuration(): AppConfig {
  const env = process.env;
  return {
    nodeEnv: (env.NODE_ENV as NodeEnv) ?? NodeEnv.Development,
    port: parseInt(env.PORT ?? '3201', 10),
    timezone: env.APP_TIMEZONE ?? 'America/Sao_Paulo',
    // Aceita várias origens separadas por vírgula (ex.: domínio próprio + *.vercel.app).
    corsOrigin: (env.CORS_ORIGIN ?? 'http://localhost:3200')
      .split(',')
      .map((s) => s.trim().replace(/\/$/, ''))
      .filter(Boolean),
    appPublicUrl: (env.APP_PUBLIC_URL ?? 'http://localhost:3200').replace(/\/$/, ''),
    jwt: {
      secret: env.JWT_SECRET as string,
      staffExpiresIn: env.JWT_STAFF_EXPIRES_IN ?? '12h',
      customerExpiresIn: env.JWT_CUSTOMER_EXPIRES_IN ?? '30d',
    },
    jobs: { secret: env.JOBS_SECRET || null, cronEnabled: env.JOBS_CRON_ENABLED !== 'false' },
    payments: {
      gateway: (env.PAYMENT_GATEWAY as 'sandbox' | 'disabled') ?? 'sandbox',
      webhookSecret: env.PAYMENT_WEBHOOK_SECRET ?? 'dev-webhook-secret',
    },
    whatsapp: { provider: 'disabled' },
    tracker: { provider: (env.TRACKER_PROVIDER as 'sandbox' | 'disabled') ?? 'sandbox' },
  };
}
