import { plainToInstance, Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Schema das variáveis de ambiente, validado no boot (fail-fast): se faltar
 * algo essencial, a API não sobe — melhor do que subir e falhar no meio de uma
 * cobrança. Ver `.env.example` para o porquê de cada uma.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT = 3201;

  @IsString()
  @IsOptional()
  APP_TIMEZONE = 'America/Sao_Paulo';

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsOptional()
  DIRECT_URL?: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_STAFF_EXPIRES_IN = '12h';

  @IsString()
  @IsOptional()
  JWT_CUSTOMER_EXPIRES_IN = '30d';

  @IsString()
  @IsOptional()
  CORS_ORIGIN = 'http://localhost:3200';

  @IsString()
  @IsOptional()
  APP_PUBLIC_URL = 'http://localhost:3200';

  @IsString()
  @IsOptional()
  JOBS_SECRET?: string;

  @IsString()
  @IsOptional()
  JOBS_CRON_ENABLED = 'true';

  @IsIn(['sandbox', 'disabled'])
  @IsOptional()
  PAYMENT_GATEWAY = 'sandbox';

  @IsString()
  @IsOptional()
  PAYMENT_WEBHOOK_SECRET = 'dev-webhook-secret';

  @IsIn(['disabled'])
  @IsOptional()
  WHATSAPP_PROVIDER = 'disabled';

  @IsIn(['sandbox', 'disabled'])
  @IsOptional()
  TRACKER_PROVIDER = 'sandbox';
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false, whitelist: false });
  if (errors.length > 0) {
    const details = errors
      .map((e) => `- ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${details}`);
  }
  if (validated.NODE_ENV === NodeEnv.Production) assertProductionSecrets(validated);
  return validated;
}

/**
 * Em produção, segredo de exemplo é o mesmo que nenhum (está no repositório
 * público). Melhor a API não subir do que subir aceitando token forjado.
 */
function assertProductionSecrets(env: EnvironmentVariables): void {
  const problems: string[] = [];
  const weak = (v: string | undefined) => !v || v.length < 32 || /troque|changeme|dev-/i.test(v);
  if (weak(env.JWT_SECRET)) problems.push('JWT_SECRET: use um segredo forte (openssl rand -base64 48).');
  if (weak(env.JOBS_SECRET)) problems.push('JOBS_SECRET: obrigatório e forte em produção (o GitHub Actions usa para rodar as rotinas).');
  if (env.PAYMENT_GATEWAY !== 'disabled' && weak(env.PAYMENT_WEBHOOK_SECRET)) problems.push('PAYMENT_WEBHOOK_SECRET: segredo forte do webhook de pagamento.');
  if (/localhost/.test(env.CORS_ORIGIN) || /localhost/.test(env.APP_PUBLIC_URL)) problems.push('CORS_ORIGIN / APP_PUBLIC_URL: use o endereço público do frontend.');
  if (problems.length) throw new Error(`Configuração de produção insegura:\n- ${problems.join('\n- ')}`);
}
