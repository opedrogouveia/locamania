import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { PaginatedResponse, PaginationQuery } from '@locamania/shared';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Base de toda query de listagem. Os filtros específicos estendem esta classe.
 * (No SafeKeep cada controller montava a paginação à mão — aqui é um lugar só.)
 */
export class PaginationQueryDto implements PaginationQuery {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;

  @ApiPropertyOptional({ description: 'Busca textual.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export interface PageParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function pageParams(query: PaginationQuery, defaultSize = DEFAULT_PAGE_SIZE): PageParams {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? defaultSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paginated<T>(data: T[], total: number, params: Pick<PageParams, 'page' | 'pageSize'>): PaginatedResponse<T> {
  return {
    data,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

/** Busca vazia/espaços vira `undefined` (não filtra). */
export function searchTerm(value: string | undefined): string | undefined {
  const term = value?.trim();
  return term ? term : undefined;
}
