import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { PermissionsService } from '@auth/permissions.service';
import { LegalService, LegalDocument } from '../services/legal.service';
import {
  AuthenticationException,
  DomainNotFoundException,
  ErrorCodes,
} from '@common/exceptions';

interface RequestWithUser {
  user?: {
    id?: string | number;
    level?: string | number;
  };
}

/**
 * Accès :
 * - public : pages légales servies au site (`ariane`) ;
 * - client connecté : son acceptation d'un document et son historique ;
 * - administrateur : gestion des documents et de leurs versions, l'auteur
 *   étant pris de la session.
 */
@Controller('api/support/legal')
export class LegalController {
  private readonly logger = new Logger(LegalController.name);

  constructor(
    private readonly legalService: LegalService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Post()
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @HttpCode(HttpStatus.CREATED)
  async createDocument(
    @Body() documentData: Omit<LegalDocument, 'id' | 'lastUpdated'>,
  ): Promise<LegalDocument> {
    this.logger.log('Creating legal document');
    return this.legalService.createDocument(documentData);
  }

  @Get()
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
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
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
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

  // ==================== ENDPOINTS ARIANE (___META_TAGS_ARIANE) ====================
  // Déclarés avant `:identifier` : l'ordre de déclaration fixe l'ordre de
  // correspondance, et `GET ariane` serait sinon pris pour un identifiant.

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

  @Get(':identifier')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
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
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async updateDocument(
    @Req() req: RequestWithUser,
    @Param('documentId') documentId: string,
    @Body()
    body: {
      updates: Partial<Omit<LegalDocument, 'id' | 'lastUpdated'>>;
      changes?: string;
    },
  ): Promise<LegalDocument> {
    return this.legalService.updateDocument(
      documentId,
      body.updates,
      this.requireUserId(req),
      body.changes,
    );
  }

  @Put(':documentId/publish')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async publishDocument(
    @Param('documentId') documentId: string,
    @Body() body: { published: boolean },
  ): Promise<LegalDocument> {
    return this.legalService.publishDocument(documentId, body.published);
  }

  @Delete(':documentId')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDocument(@Param('documentId') documentId: string): Promise<void> {
    await this.legalService.deleteDocument(documentId);
  }

  @Get(':documentId/versions')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async getDocumentVersions(@Param('documentId') documentId: string) {
    return this.legalService.getDocumentVersions(documentId);
  }

  @Get(':documentId/versions/:versionId')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
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
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async restoreVersion(
    @Req() req: RequestWithUser,
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
  ): Promise<LegalDocument> {
    return this.legalService.restoreVersion(
      documentId,
      versionId,
      this.requireUserId(req),
    );
  }

  @Post('accept/:type')
  @UseGuards(AuthenticatedGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async acceptDocument(
    @Req() req: RequestWithUser,
    @Param('type') type: string,
  ): Promise<void> {
    await this.legalService.acceptDocument(
      type as LegalDocument['type'],
      this.requireUserId(req),
    );
  }

  @Get('users/:userId/acceptances')
  @UseGuards(AuthenticatedGuard)
  async getUserAcceptances(
    @Req() req: RequestWithUser,
    @Param('userId') userId: string,
  ) {
    if (userId !== this.requireUserId(req) && !this.isStaff(req)) {
      throw new ForbiddenException('Access denied');
    }
    return this.legalService.getUserAcceptances(userId);
  }

  private requireUserId(req: RequestWithUser): string {
    const id = req.user?.id;
    if (id === undefined || id === null || String(id) === '') {
      throw new AuthenticationException({ message: 'Non authentifié' });
    }
    return String(id);
  }

  private isStaff(req: RequestWithUser): boolean {
    const level = parseInt(String(req.user?.level ?? 0), 10) || 0;
    return this.permissionsService.hasPermission(
      level,
      'canSeeCustomerDetails',
    );
  }
}
