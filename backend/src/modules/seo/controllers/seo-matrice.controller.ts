import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  SeoMatriceService,
  ValidationResult,
  GammeWithRules,
} from '../services/seo-matrice.service';

interface ValidateContentDto {
  content: string;
  pg_id?: number;
  slug?: string;
  zones?: {
    title?: string;
    intro?: string;
    body?: string;
  };
}

/**
 * SEO Matrice Controller
 *
 * Expose la matrice SEO Lexique pour n8n et autres consommateurs.
 *
 * Endpoints:
 * - GET /api/seo/matrice/info - Info sur la matrice (version, stats)
 * - GET /api/seo/matrice/gammes - Liste toutes les gammes
 * - GET /api/seo/matrice/gamme/:pgId - Règles pour une gamme (par pg_id)
 * - GET /api/seo/matrice/gamme/slug/:slug - Règles pour une gamme (par slug)
 * - POST /api/seo/matrice/validate - Valider un contenu contre les règles
 * - GET /api/seo/matrice/confusion-pairs - Liste des paires de confusion
 * - GET /api/seo/matrice/ambiguous-terms - Liste des termes ambigus
 * - POST /api/seo/matrice/reload - Recharger la matrice depuis le fichier
 */
@Controller('api/seo/matrice')
export class SeoMatriceController {
  private readonly logger = new Logger(SeoMatriceController.name);

  constructor(private readonly matriceService: SeoMatriceService) {}

  /**
   * GET /api/seo/matrice/info
   *
   * Retourne les informations sur la matrice (version, stats)
   */
  @Get('info')
  getInfo(): {
    version: string;
    updated_at: string;
    total_gammes: number;
    total_familles: number;
    confusion_pairs_count: number;
    ambiguous_terms_count: number;
  } {
    const info = this.matriceService.getMatriceInfo();
    if (!info) {
      throw new NotFoundException('Matrice non chargée');
    }
    return info;
  }

  /**
   * GET /api/seo/matrice/gammes
   *
   * Liste toutes les gammes avec leurs informations de base
   *
   * Query params:
   * - famille: Filtrer par code famille (ex: freinage, eclairage)
   */
  @Get('gammes')
  getAllGammes(
    @Query('famille') famille?: string,
  ): Array<{ pg_id: number; slug: string; nom_fr: string; famille: string }> {
    const gammes = this.matriceService.getAllGammes();

    if (famille) {
      return gammes.filter((g) => g.famille === famille);
    }

    return gammes;
  }

  /**
   * GET /api/seo/matrice/gamme/:pgId
   *
   * Retourne les règles SEO complètes pour une gamme identifiée par pg_id
   *
   * Inclut:
   * - Lexique autorisé/interdit
   * - Verbes autorisés/interdits
   * - Claims interdits
   * - Pièces associées (pour cross-sell)
   * - Symptômes (pour SEO)
   * - Termes globaux interdits
   * - Paires de confusion liées
   * - Termes ambigus liés
   */
  @Get('gamme/:pgId')
  getGammeByPgId(@Param('pgId') pgId: string): GammeWithRules {
    const pgIdNum = parseInt(pgId, 10);
    if (isNaN(pgIdNum)) {
      throw new BadRequestException('pg_id doit être un nombre');
    }

    const gamme = this.matriceService.getGammeByPgId(pgIdNum);
    if (!gamme) {
      throw new NotFoundException(`Gamme avec pg_id ${pgIdNum} non trouvée`);
    }

    return gamme;
  }

  /**
   * GET /api/seo/matrice/gamme/slug/:slug
   *
   * Retourne les règles SEO complètes pour une gamme identifiée par slug
   */
  @Get('gamme/slug/:slug')
  getGammeBySlug(@Param('slug') slug: string): GammeWithRules {
    const gamme = this.matriceService.getGammeBySlug(slug);
    if (!gamme) {
      throw new NotFoundException(`Gamme avec slug "${slug}" non trouvée`);
    }

    return gamme;
  }

  /**
   * POST /api/seo/matrice/validate
   *
   * Valide un contenu contre les règles SEO pour une gamme spécifique
   *
   * Body:
   * - content: string - Le contenu à valider
   * - pg_id?: number - ID de la gamme (ou utiliser slug)
   * - slug?: string - Slug de la gamme (ou utiliser pg_id)
   * - zones?: object - Contenu par zone (title, intro, body)
   *
   * Retourne:
   * - valid: boolean - true si aucune erreur bloquante
   * - issues: array - Liste des problèmes détectés
   * - stats: object - Compteurs (total, bloquants, warnings)
   */
  @Post('validate')
  validateContent(@Body() dto: ValidateContentDto): ValidationResult {
    if (!dto.content && !dto.zones) {
      throw new BadRequestException('content ou zones requis');
    }

    if (!dto.pg_id && !dto.slug) {
      throw new BadRequestException('pg_id ou slug requis');
    }

    let pgId: number;

    if (dto.pg_id) {
      pgId = dto.pg_id;
    } else if (dto.slug) {
      const gamme = this.matriceService.getGammeBySlug(dto.slug);
      if (!gamme) {
        throw new NotFoundException(
          `Gamme avec slug "${dto.slug}" non trouvée`,
        );
      }
      pgId = gamme.pg_id;
    } else {
      throw new BadRequestException('pg_id ou slug requis');
    }

    const result = this.matriceService.validateContent(
      pgId,
      dto.content || '',
      dto.zones,
    );

    this.logger.log(
      `Validation gamme ${pgId}: ${result.valid ? 'VALID' : 'INVALID'} (${result.stats.blockingCount} blocking, ${result.stats.warningCount} warning)`,
    );

    return result;
  }

  /**
   * GET /api/seo/matrice/confusion-pairs
   *
   * Liste toutes les paires de confusion
   *
   * Query params:
   * - severity: Filtrer par sévérité (minor, medium, major, critical)
   * - category: Filtrer par catégorie
   */
  @Get('confusion-pairs')
  getConfusionPairs(
    @Query('severity') severity?: string,
    @Query('category') category?: string,
  ): Array<{
    piece_a: string;
    piece_b: string;
    severity: string;
    category: string;
    message_fr: string;
  }> {
    let pairs = this.matriceService.getConfusionPairs();

    if (severity) {
      pairs = pairs.filter((p) => p.severity === severity);
    }

    if (category) {
      pairs = pairs.filter((p) => p.category === category);
    }

    // Map to ensure all required properties are present
    return pairs.map((p) => ({
      piece_a: p.piece_a,
      piece_b: p.piece_b,
      severity: p.severity,
      category: p.category,
      message_fr: p.message_fr,
    }));
  }

  /**
   * GET /api/seo/matrice/ambiguous-terms
   *
   * Liste tous les termes ambigus
   *
   * Query params:
   * - category: Filtrer par catégorie
   */
  @Get('ambiguous-terms')
  getAmbiguousTerms(@Query('category') category?: string): Array<{
    term: string;
    required_contexts: string[];
    category: string;
    message_fr: string;
  }> {
    let terms = this.matriceService.getAmbiguousTerms();

    if (category) {
      terms = terms.filter((t) => t.category === category);
    }

    // Map to ensure all required properties are present
    return terms.map((t) => ({
      term: t.term,
      required_contexts: t.required_contexts,
      category: t.category,
      message_fr: t.message_fr,
    }));
  }

  /**
   * POST /api/seo/matrice/reload
   *
   * Recharge la matrice depuis le fichier JSON
   * Utile après une mise à jour manuelle du fichier
   */
  @Post('reload')
  async reloadMatrice(): Promise<{ success: boolean; message: string }> {
    try {
      await this.matriceService.reloadMatrice();
      const info = this.matriceService.getMatriceInfo();
      return {
        success: true,
        message: `Matrice v${info?.version} rechargée avec ${info?.total_gammes} gammes`,
      };
    } catch (error) {
      this.logger.error('Failed to reload matrice:', error);
      throw new BadRequestException(
        `Erreur lors du rechargement: ${error.message}`,
      );
    }
  }
}
