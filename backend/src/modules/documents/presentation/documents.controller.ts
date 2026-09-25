import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import {
  DOCUMENT_OWNER_TYPES,
  Permission,
  type DocumentDto,
  type DocumentOwnerType,
  type ExpiringItemDto,
  type ListDocumentsQuery,
  type PaginatedResponse,
  type UpdateDocumentRequest,
  type UploadDocumentRequest,
} from '@locamania/shared';

import { CurrentStaff, RequirePermissions } from '../../../shared/auth/decorators';
import type { StaffPrincipal } from '../../../shared/auth/principal';
import { PaginationQueryDto } from '../../../shared/http/pagination';
import { IsYmd } from '../../../shared/http/validators';
import { DocumentsService } from '../application/documents.service';

class UploadDto implements UploadDocumentRequest {
  @ApiProperty({ enum: DOCUMENT_OWNER_TYPES }) @IsIn(DOCUMENT_OWNER_TYPES) ownerType!: DocumentOwnerType;
  @ApiProperty() @IsString() @IsNotEmpty() ownerId!: string;
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Escolha o tipo de documento.' }) typeCode!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) title?: string | null;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) fileName!: string;
  @ApiProperty() @IsString() @IsNotEmpty() mimeType!: string;
  @ApiProperty({ description: 'Conteúdo em base64 (até 8 MB).' }) @IsString() @IsNotEmpty() @MaxLength(12_000_000) dataBase64!: string;
  @ApiPropertyOptional() @IsOptional() @IsYmd() expiresAt?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() visibleToCustomer?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string | null;
}

class UpdateDto implements UpdateDocumentRequest {
  @ApiPropertyOptional() @IsOptional() @IsString() typeCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsYmd() expiresAt?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() visibleToCustomer?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string | null;
}

class ListDto extends PaginationQueryDto implements ListDocumentsQuery {
  @ApiPropertyOptional({ enum: DOCUMENT_OWNER_TYPES }) @IsOptional() @IsIn(DOCUMENT_OWNER_TYPES) ownerType?: DocumentOwnerType;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() typeCode?: string;
  @ApiPropertyOptional({ enum: ['EXPIRING', 'EXPIRED'] }) @IsOptional() @IsIn(['EXPIRING', 'EXPIRED']) expiry?: 'EXPIRING' | 'EXPIRED';
}

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @RequirePermissions(Permission.DOCUMENTS_VIEW)
  list(@Query() query: ListDto): Promise<PaginatedResponse<DocumentDto>> {
    return this.documents.list(query);
  }

  @Get('expiring')
  @RequirePermissions(Permission.DOCUMENTS_VIEW)
  @ApiOperation({ summary: 'Documentos e CNHs vencendo ou vencidos (§20, §21).' })
  expiring(): Promise<ExpiringItemDto[]> {
    return this.documents.expiring();
  }

  @Get(':id/file')
  @RequirePermissions(Permission.DOCUMENTS_VIEW)
  async file(@Param('id') id: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const f = await this.documents.file(id);
    res.set({ 'Content-Type': f.mimeType, 'Content-Disposition': `inline; filename="${encodeURIComponent(f.fileName)}"`, 'Cache-Control': 'private, max-age=300' });
    return new StreamableFile(f.data);
  }

  @Post()
  @RequirePermissions(Permission.DOCUMENTS_MANAGE)
  @ApiOperation({ summary: 'Anexa documento/foto a uma ficha (base64; imagens chegam reduzidas).' })
  upload(@Body() dto: UploadDto, @CurrentStaff() actor: StaffPrincipal): Promise<DocumentDto> {
    return this.documents.upload(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(Permission.DOCUMENTS_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateDto): Promise<DocumentDto> {
    return this.documents.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.DOCUMENTS_MANAGE)
  async archive(@Param('id') id: string): Promise<void> {
    await this.documents.archive(id);
  }
}
