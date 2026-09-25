import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';

import { AppModule } from './app.module';
import type { AppConfig } from './shared/config/configuration';
import { initSentry } from './shared/observability/sentry';

async function bootstrap(): Promise<void> {
  // Antes de tudo: erro no boot também precisa ser reportado.
  const sentryOn = initSentry();

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService<AppConfig, true>);
  const logger = new Logger('Bootstrap');
  if (sentryOn) logger.log('Sentry ativo — erros de produção serão reportados.');

  // Documentos e fotos chegam em base64 no JSON (a imagem já vem reduzida pelo navegador).
  app.use(json({ limit: '12mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // IP correto atrás do proxy do Render (rate limit e auditoria).
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.enableCors({ origin: config.get('corsOrigin', { infer: true }), credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Locamania API')
    .setDescription('API do sistema de locação de motos Locamania (painel e app do cliente).')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  app.enableShutdownHooks();

  const port = config.get('port', { infer: true });
  await app.listen(port);
  logger.log(`Locamania API ouvindo em http://localhost:${port} (Swagger: /docs)`);
}

void bootstrap();
