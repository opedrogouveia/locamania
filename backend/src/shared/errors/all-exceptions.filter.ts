import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ApiErrorResponse } from '@locamania/shared';
import type { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';

import { CLS_KEYS, type AppClsStore } from '../cls/cls-store';
import { Sentry } from '../observability/sentry';
import { DomainError, type DomainErrorCode } from './domain-errors';

const DOMAIN_CODE_TO_STATUS: Record<DomainErrorCode, HttpStatus> = {
  VALIDATION: HttpStatus.BAD_REQUEST,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  CONFLICT: HttpStatus.CONFLICT,
};

/** Mensagens padrão (pt-BR) para erros HTTP do framework. */
const HTTP_DEFAULT_MESSAGES: Record<number, string> = {
  400: 'Dados inválidos.',
  401: 'Sua sessão expirou. Entre novamente.',
  403: 'Você não tem permissão para esta ação.',
  404: 'Não encontrado.',
  413: 'Arquivo grande demais.',
  429: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
};

/**
 * Filtro global: traduz qualquer erro num envelope único (`ApiErrorResponse`),
 * sem vazar detalhe interno. Erro inesperado vai para o log (stack) e para o
 * Sentry; erro de negócio não — 404 e validação são fluxo normal.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly cls: ClsService<AppClsStore>) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Algo deu errado do nosso lado. Tente de novo em instantes.';
    let code = 'INTERNAL';

    if (exception instanceof DomainError) {
      status = DOMAIN_CODE_TO_STATUS[exception.code];
      message = exception.message;
      code = exception.reason ?? exception.code;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      const body = typeof res === 'string' ? { message: res } : (res as { message?: string | string[] });
      // Mensagens do ValidationPipe chegam como lista; as demais, em inglês do framework.
      message = Array.isArray(body.message)
        ? body.message
        : status in HTTP_DEFAULT_MESSAGES && /^[A-Z][a-z]+( [A-Za-z]+)*$/.test(String(body.message ?? ''))
          ? HTTP_DEFAULT_MESSAGES[status]!
          : (body.message ?? HTTP_DEFAULT_MESSAGES[status] ?? exception.message);
      code = status === 400 ? 'VALIDATION' : status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : `HTTP_${status}`;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === 'P2002') {
      // Violação de unicidade que escapou da checagem da aplicação (corrida).
      status = HttpStatus.CONFLICT;
      message = 'Já existe um registro com estes dados.';
      code = 'CONFLICT';
    } else {
      Sentry.captureException(exception, {
        tags: { path: request.url, method: request.method },
        extra: { correlationId: this.cls.get(CLS_KEYS.correlationId) },
      });
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      );
    }

    const payload: ApiErrorResponse = {
      statusCode: status,
      message,
      code,
      path: request.url,
      timestamp: new Date().toISOString(),
      correlationId: this.cls.get(CLS_KEYS.correlationId),
    };
    response.status(status).json(payload);
  }
}
