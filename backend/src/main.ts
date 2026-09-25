import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import type { AppConfig } from './shared/config/configuration';
import { initSentry } from './shared/observability/sentry';
import { validationExceptionFactory } from './shared/http/validation-messages';

async function bootstrap(): Promise<void> {
  // Antes de tudo: erro no boot também precisa ser reportado.
  const sentryOn = initSentry();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get(ConfigService<AppConfig, true>);
  const logger = new Logger('Bootstrap');
  if (sentryOn) logger.log('Sentry ativo — erros de produção serão reportados.');

  // Documentos e fotos chegam em base64 no JSON (a imagem já vem reduzida pelo navegador).
  // Pelo Nest (e não `import 'express'`): express é dependência transitiva e
  // não existe no node_modules isolado da imagem Docker.
  app.useBodyParser('json', { limit: '12mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '1mb' });
  app.use(cookieParser());

  // IP correto atrás do proxy do Render (rate limit e auditoria).
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Content-Disposition exposto: o download usa o nome de arquivo que a API define.
  app.enableCors({ origin: config.get('corsOrigin', { infer: true }), credentials: true, exposedHeaders: ['Content-Disposition'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: validationExceptionFactory,
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
