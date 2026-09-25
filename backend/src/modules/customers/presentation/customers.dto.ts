import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  CNH_CATEGORIES,
  CUSTOMER_STATUSES,
  type CnhCategory,
  type CreateCustomerRequest,
  type CustomerManualStatus,
  type CustomerStatus,
  type ListCustomersQuery,
  type SetCollectionRequest,
  type SetCustomerStatusRequest,
  type UpdateCustomerRequest,
} from '@locamania/shared';

import { PaginationQueryDto } from '../../../shared/http/pagination';
import { IsYmd } from '../../../shared/http/validators';

/** Campos comuns (todos opcionais); o cadastro exige nome e CPF. */
class CustomerFieldsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) rg?: string | null;
  @ApiPropertyOptional({ example: '1990-05-20' }) @IsOptional() @IsYmd() birthDate?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) phone?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) whatsapp?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) email?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) postalCode?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) street?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) streetNumber?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) complement?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) district?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) city?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2) state?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) cnhNumber?: string | null;
  @ApiPropertyOptional({ enum: CNH_CATEGORIES }) @IsOptional() @IsIn([...CNH_CATEGORIES, null], { message: 'Categoria de CNH inválida.' }) cnhCategory?: CnhCategory | null;
  @ApiPropertyOptional() @IsOptional() @IsYmd() cnhExpiresAt?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) notes?: string | null;
}

export class CreateCustomerDto extends CustomerFieldsDto implements CreateCustomerRequest {
  @ApiProperty({ example: 'João da Silva' }) @IsString() @IsNotEmpty({ message: 'Informe o nome.' }) @MaxLength(160) name!: string;
  @ApiProperty({ example: '529.982.247-25' }) @IsString() @IsNotEmpty({ message: 'Informe o CPF.' }) @MaxLength(20) cpf!: string;
}

export class UpdateCustomerDto extends CustomerFieldsDto implements UpdateCustomerRequest {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(160) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) cpf?: string;
}

export class ListCustomersQueryDto extends PaginationQueryDto implements ListCustomersQuery {
  @ApiPropertyOptional({ enum: CUSTOMER_STATUSES }) @IsOptional() @IsIn(CUSTOMER_STATUSES) status?: CustomerStatus;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  inCollection?: boolean;
}

export class SetCustomerStatusDto implements SetCustomerStatusRequest {
  @ApiProperty({ enum: ['BLOCKED', 'INACTIVE', null], nullable: true })
  @IsIn(['BLOCKED', 'INACTIVE', null], { message: 'Situação inválida.' })
  manualStatus!: CustomerManualStatus | null;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) reason?: string | null;
}

export class SetCollectionDto implements SetCollectionRequest {
  @ApiProperty() @IsBoolean() inCollection!: boolean;
}
