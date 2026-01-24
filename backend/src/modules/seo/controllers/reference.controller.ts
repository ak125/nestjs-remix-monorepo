import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  NotFoundException,
  Logger,
  Header,
  UseGuards,
} from '@nestjs/common';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import {
  ReferenceService,
  SeoReference,
  SeoReferenceListItem,
} from '../services/reference.service';

/**
 * Interface de réponse API pour une référence
 */
interface ReferenceResponse {
  slug: string;
  title: string;
  metaDescription: string | null;
  definition: string;
  roleMecanique: string | null;
  composition: string[] | null;
  confusionsCourantes: string[] | null;
  symptomesAssocies: string[] | null;
  contentHtml: string | null;
  schemaJson: Record<string, unknown> | null;
  gamme: {
    pgId: number | null;
    name: string | null;
    url: string | null;
  };
  relatedReferences: number[] | null;
  blogSlugs: string[] | null;
  canonicalUrl: string;
  updatedAt: string;
}

/**
 * Interface de réponse API pour la liste des références
 */
interface ReferenceListResponse {
  references: Array<{
    slug: string;
    title: string;
    metaDescription: string | null;
    definition: string;
    gamme: {
      pgId: number | null;
      name: string | null;
      url: string | null;
    };
  }>;
  total: number;
}

/**
 * Contrôleur API pour les pages Référence (R4)
 * Endpoints pour récupérer les définitions canoniques des pièces auto
 *
 * IMPORTANT: L'ordre des routes compte en NestJS!
 * Les routes statiques doivent être AVANT les routes dynamiques (:slug)
 */
@Controller('api/seo/reference')
export class ReferenceController {
  private readonly logger = new Logger(ReferenceController.name);

  constructor(private readonly referenceService: ReferenceService) {}

  // ============================================
  // ROUTES STATIQUES (AVANT les routes avec :slug)
  // ============================================

  /**
   * Liste toutes les références publiées
   * GET /api/seo/reference
   */
  @Get()
  @Header('Cache-Control', 'public, max-age=3600') // Cache 1 heure
  async listReferences(): Promise<ReferenceListResponse> {
    this.logger.debug('📚 GET /api/seo/reference - List all');

    const references = await this.referenceService.getAll();

    return {
      references: references.map((ref) => ({
        slug: ref.slug,
        title: ref.title,
        metaDescription: ref.metaDescription,
        definition: ref.definition,
        gamme: {
          pgId: ref.pgId,
          name: ref.gammeName,
          url: ref.gammeSlug ? `/pieces/${ref.gammeSlug}.html` : null,
        },
      })),
      total: references.length,
    };
  }

  /**
   * Liste tous les drafts (références non publiées)
   * GET /api/seo/reference/drafts
   * ADMIN ONLY
   */
  @Get('drafts')
  @UseGuards(IsAdminGuard)
  async getDrafts(): Promise<{
    drafts: SeoReferenceListItem[];
    total: number;
  }> {
    this.logger.debug('📝 GET /api/seo/reference/drafts');
    const drafts = await this.referenceService.getDrafts();
    return { drafts, total: drafts.length };
  }

  /**
   * Génère des références R4 depuis les gammes existantes
   * POST /api/seo/reference/generate
   * Crée les entrées en mode DRAFT (is_published: false)
   * ADMIN ONLY
   */
  @Post('generate')
  @UseGuards(IsAdminGuard)
  async generateFromGammes(): Promise<{ created: number; skipped: number }> {
    this.logger.log('🏭 POST /api/seo/reference/generate');
    return this.referenceService.generateFromGammes();
  }

  /**
   * Récupère le slug de référence pour une gamme donnée
   * GET /api/seo/reference/by-gamme/:pgId
   */
  @Get('by-gamme/:pgId')
  @Header('Cache-Control', 'public, max-age=86400') // Cache 24h
  async getReferenceByGamme(
    @Param('pgId') pgId: string,
  ): Promise<{ slug: string | null; url: string | null }> {
    const pgIdNum = parseInt(pgId, 10);

    if (isNaN(pgIdNum)) {
      return { slug: null, url: null };
    }

    const slug = await this.referenceService.getReferenceSlugByGammeId(pgIdNum);

    return {
      slug,
      url: slug ? `/reference-auto/${slug}` : null,
    };
  }

  // ============================================
  // ROUTES AVEC :slug (sous-routes d'abord)
  // ============================================

  /**
   * Vérifie si une référence existe (pour préchargement)
   * GET /api/seo/reference/:slug/exists
   */
  @Get(':slug/exists')
  @Header('Cache-Control', 'public, max-age=86400') // Cache 24h
  async checkExists(@Param('slug') slug: string): Promise<{ exists: boolean }> {
    const exists = await this.referenceService.exists(slug);
    return { exists };
  }

  /**
   * Récupère les références liées
   * GET /api/seo/reference/:slug/related
   */
  @Get(':slug/related')
  @Header('Cache-Control', 'public, max-age=3600')
  async getRelatedReferences(
    @Param('slug') slug: string,
  ): Promise<{ related: SeoReferenceListItem[] }> {
    const reference = await this.referenceService.getBySlug(slug);

    if (!reference) {
      throw new NotFoundException(`Référence non trouvée: ${slug}`);
    }

    const related = await this.referenceService.getRelatedReferences(
      reference.id,
    );

    return { related };
  }

  /**
   * Publie une référence (is_published: true)
   * PATCH /api/seo/reference/:slug/publish
   * ADMIN ONLY
   */
  @Patch(':slug/publish')
  @UseGuards(IsAdminGuard)
  async publishReference(
    @Param('slug') slug: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`📢 PATCH /api/seo/reference/${slug}/publish`);
    return this.referenceService.publish(slug);
  }

  /**
   * Met à jour une référence (draft ou publiée)
   * PATCH /api/seo/reference/:slug
   * ADMIN ONLY
   */
  @Patch(':slug')
  @UseGuards(IsAdminGuard)
  async updateReference(
    @Param('slug') slug: string,
    @Body()
    body: Partial<{
      title: string;
      meta_description: string;
      definition: string;
      role_mecanique: string;
      role_negatif: string;
      composition: string[];
      confusions_courantes: string[];
      symptomes_associes: string[];
      regles_metier: string[];
      scope_limites: string;
      content_html: string;
    }>,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`✏️ PATCH /api/seo/reference/${slug}`);
    return this.referenceService.update(slug, body);
  }

  /**
   * Supprime un draft (non publié uniquement)
   * DELETE /api/seo/reference/:slug
   * ADMIN ONLY
   */
  @Delete(':slug')
  @UseGuards(IsAdminGuard)
  async deleteDraft(
    @Param('slug') slug: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`🗑️ DELETE /api/seo/reference/${slug}`);
    return this.referenceService.deleteDraft(slug);
  }

  // ============================================
  // ROUTE GÉNÉRIQUE :slug (EN DERNIER!)
  // ============================================

  /**
   * Récupère une référence par son slug
   * GET /api/seo/reference/:slug
   *
   * IMPORTANT: Cette route doit être EN DERNIER car elle capture tout!
   */
  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=3600') // Cache 1 heure
  async getReference(@Param('slug') slug: string): Promise<ReferenceResponse> {
    this.logger.debug(`📖 GET /api/seo/reference/${slug}`);

    const reference = await this.referenceService.getBySlug(slug);

    if (!reference) {
      throw new NotFoundException(`Référence non trouvée: ${slug}`);
    }

    return this.mapToResponse(reference);
  }

  /**
   * Mappe une SeoReference vers la réponse API
   */
  private mapToResponse(ref: SeoReference): ReferenceResponse {
    return {
      slug: ref.slug,
      title: ref.title,
      metaDescription: ref.metaDescription,
      definition: ref.definition,
      roleMecanique: ref.roleMecanique,
      composition: ref.composition,
      confusionsCourantes: ref.confusionsCourantes,
      symptomesAssocies: ref.symptomesAssocies,
      contentHtml: ref.contentHtml,
      schemaJson:
        ref.schemaJson || this.referenceService.generateSchemaJson(ref),
      gamme: {
        pgId: ref.pgId,
        name: ref.gammeName,
        url: ref.gammeSlug ? `/pieces/${ref.gammeSlug}.html` : null,
      },
      relatedReferences: ref.relatedReferences,
      blogSlugs: ref.blogSlugs,
      canonicalUrl: `/reference-auto/${ref.slug}`,
      updatedAt: ref.updatedAt.toISOString(),
    };
  }
}
