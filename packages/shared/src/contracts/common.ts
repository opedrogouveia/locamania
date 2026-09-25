/** Parâmetros padrão de listagem paginada (query string). */
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  /** Busca textual livre. */
  search?: string;
}

/** Envelope padrão de resposta paginada. */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Envelope padrão de erro (exception filter). `code` é estável e serve para o
 * frontend decidir comportamento; `message` já vem em pt-BR para exibir.
 */
export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  code?: string;
  error?: string;
  path?: string;
  timestamp?: string;
  correlationId?: string;
}

/** Referência curta a outra entidade, para listas e fichas. */
export interface EntityRef {
  id: string;
  label: string;
}

/** Item de catálogo exibível. */
export interface OptionDto {
  code: string;
  label: string;
}
