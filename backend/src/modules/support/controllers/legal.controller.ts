import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { LegalService, LegalDocument } from '../services/legal.service';
import {
  DomainNotFoundException,
  ErrorCodes,
} from '../../../common/exceptions';

@Controller('api/support/legal')
export class LegalController {
  private readonly logger = new Logger(LegalController.name);

  constructor(private legalService: LegalService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createDocument(
    @Body() documentData: Omit<LegalDocument, 'id' | 'lastUpdated'>,
  ): Promise<LegalDocument> {
    this.logger.log('Creating legal document');
    return this.legalService.createDocument(documentData);
  }

  @Get()
  async getAllDocuments(
    @Query('type') type?: string,
    @Query('published') published?: string,
    @Query('language') language?: string,
  ): Promise<LegalDocument[]> {
    const filters = {
      type: type as LegalDocument['type'],
      published: published !== undefined ? published === 'true' : undefined,
      language,
    };

    return this.legalService.getAllDocuments(filters);
  }

  @Get('by-type/:type')
  async getDocumentByType(@Param('type') type: string): Promise<LegalDocument> {
    const document = await this.legalService.getDocumentByType(
      type as LegalDocument['type'],
    );
    if (!document) {
      throw new DomainNotFoundException({
        message: `No published document found for type ${type}`,
        code: ErrorCodes.SUPPORT.LEGAL_NOT_FOUND,
      });
    }
    return document;
  }

  @Get(':identifier')
  async getDocument(
    @Param('identifier') identifier: string,
  ): Promise<LegalDocument> {
    const document = await this.legalService.getDocument(identifier);
    if (!document) {
      throw new DomainNotFoundException({
        message: `Document ${identifier} not found`,
        code: ErrorCodes.SUPPORT.LEGAL_NOT_FOUND,
      });
    }
    return document;
  }

  @Put(':documentId')
  async updateDocument(
    @Param('documentId') documentId: string,
    @Body()
    body: {
      updates: Partial<Omit<LegalDocument, 'id' | 'lastUpdated'>>;
      updatedBy: string;
      changes?: string;
    },
  ): Promise<LegalDocument> {
    return this.legalService.updateDocument(
      documentId,
      body.updates,
      body.updatedBy,
      body.changes,
    );
  }

  @Put(':documentId/publish')
  async publishDocument(
    @Param('documentId') documentId: string,
    @Body() body: { published: boolean },
  ): Promise<LegalDocument> {
    return this.legalService.publishDocument(documentId, body.published);
  }

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDocument(@Param('documentId') documentId: string): Promise<void> {
    await this.legalService.deleteDocument(documentId);
  }

  @Get(':documentId/versions')
  async getDocumentVersions(@Param('documentId') documentId: string) {
    return this.legalService.getDocumentVersions(documentId);
  }

  @Get(':documentId/versions/:versionId')
  async getDocumentVersion(
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
  ) {
    const version = await this.legalService.getDocumentVersion(
      documentId,
      versionId,
    );
    if (!version) {
      throw new DomainNotFoundException({
        message: `Version ${versionId} not found for document ${documentId}`,
        code: ErrorCodes.SUPPORT.LEGAL_NOT_FOUND,
      });
    }
    return version;
  }

  @Put(':documentId/versions/:versionId/restore')
  async restoreVersion(
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
    @Body() body: { restoredBy: string },
  ): Promise<LegalDocument> {
    return this.legalService.restoreVersion(
      documentId,
      versionId,
      body.restoredBy,
    );
  }

  @Post('accept/:type')
  @HttpCode(HttpStatus.NO_CONTENT)
  async acceptDocument(
    @Param('type') type: string,
    @Body() body: { userId: string },
  ): Promise<void> {
    await this.legalService.acceptDocument(
      type as LegalDocument['type'],
      body.userId,
    );
  }

  @Get('users/:userId/acceptances')
  async getUserAcceptances(@Param('userId') userId: string) {
    return this.legalService.getUserAcceptances(userId);
  }

  // ==================== ENDPOINTS ARIANE (___META_TAGS_ARIANE) ====================

  /**
   * 📄 Liste toutes les pages légales disponibles dans ___META_TAGS_ARIANE
   * GET /api/support/legal/ariane
   */
  @Get('ariane')
  async getAllArianePages() {
    this.logger.log('📄 Fetching all ARIANE legal pages');
    return this.legalService.getAllLegalPagesFromAriane();
  }

  /**
   * 📄 Récupère une page légale depuis ___META_TAGS_ARIANE par alias
   * GET /api/support/legal/ariane/:alias
   * Alias disponibles: cgv, cdu, cpuc, liv, gcrg, faq, contact, concept, us
   */
  @Get('ariane/:alias')
  async getArianePage(@Param('alias') alias: string) {
    this.logger.log(`📄 Fetching ARIANE page: ${alias}`);
    const page = await this.legalService.getLegalPageFromAriane(alias);

    if (!page) {
      throw new DomainNotFoundException({
        message: `Page légale "${alias}" non trouvée dans ARIANE`,
        code: ErrorCodes.SUPPORT.LEGAL_NOT_FOUND,
      });
    }

    return page;
  }
}
