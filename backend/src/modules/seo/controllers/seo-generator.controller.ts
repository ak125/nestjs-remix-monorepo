import {
  Controller,
  Get,
  Post,
  Body,
  Logger,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import {
  SeoGeneratorService,
  GeneratedR4,
  GeneratedR5,
} from '../services/seo-generator.service';

/**
 * DTO pour la génération de contenu SEO
 */
interface GenerateDto {
  pg_id: number;
  slug: string;
  content_types: ('r4' | 'r5')[];
  save_draft?: boolean; // Si true, sauvegarde directement en draft
}

/**
 * Réponse de génération
 */
interface GenerateResponse {
  success: boolean;
  r4: GeneratedR4 | null;
  r5: GeneratedR5[];
  sourcesUsed: string[];
  keywordsMatched: string[];
  errors: string[];
  saved?: {
    r4: boolean;
    r5: number;
  };
}

/**
 * Contrôleur Admin pour la génération de contenu SEO
 * Utilise les fichiers RAG pour générer R4 Reference et R5 Diagnostic
 *
 * Endpoints:
 * - POST /api/admin/seo/generate - Génère du contenu depuis RAG
 * - POST /api/admin/seo/generate-and-save - Génère et sauvegarde en draft
 * - GET /api/admin/seo/rag-files - Liste les fichiers RAG disponibles
 *
 * ADMIN ONLY - Toutes les routes sont protégées
 */
@Controller('api/admin/seo')
@UseGuards(IsAdminGuard)
export class SeoGeneratorController {
  private readonly logger = new Logger(SeoGeneratorController.name);

  constructor(private readonly generatorService: SeoGeneratorService) {}

  /**
   * Génère du contenu SEO depuis un fichier RAG gamme
   * POST /api/admin/seo/generate
   *
   * Body:
   * - pg_id: number - L'ID de la gamme
   * - slug: string - Le slug de la gamme (ex: "filtre-a-huile")
   * - content_types: ('r4' | 'r5')[] - Types de contenu à générer
   * - save_draft?: boolean - Sauvegarder en draft (optionnel)
   *
   * @returns Le contenu généré (R4 et/ou R5)
   */
  @Post('generate')
  async generate(@Body() dto: GenerateDto): Promise<GenerateResponse> {
    this.logger.log(
      `🏭 POST /api/admin/seo/generate - pg_id=${dto.pg_id}, slug=${dto.slug}`,
    );

    // Validation
    if (!dto.pg_id || dto.pg_id <= 0) {
      throw new BadRequestException('pg_id is required and must be positive');
    }

    if (!dto.slug || dto.slug.length < 2) {
      throw new BadRequestException('slug is required');
    }

    if (!dto.content_types || dto.content_types.length === 0) {
      throw new BadRequestException(
        'content_types must include at least one of: r4, r5',
      );
    }

    // Valider content_types
    const validTypes = ['r4', 'r5'];
    for (const type of dto.content_types) {
      if (!validTypes.includes(type)) {
        throw new BadRequestException(`Invalid content_type: ${type}`);
      }
    }

    // Générer
    if (dto.save_draft) {
      // Générer et sauvegarder
      const result = await this.generatorService.generateAndSave(
        dto.pg_id,
        dto.slug,
        dto.content_types,
      );

      return {
        success: result.errors.length === 0,
        r4: result.generated.r4,
        r5: result.generated.r5,
        sourcesUsed: result.generated.sourcesUsed,
        keywordsMatched: result.generated.keywordsMatched,
        errors: result.errors,
        saved: result.saved,
      };
    }

    // Générer seulement (preview)
    const result = await this.generatorService.generateFromGamme(
      dto.pg_id,
      dto.slug,
      dto.content_types,
    );

    return {
      success: result.errors.length === 0,
      r4: result.r4,
      r5: result.r5,
      sourcesUsed: result.sourcesUsed,
      keywordsMatched: result.keywordsMatched,
      errors: result.errors,
    };
  }

  /**
   * Génère et sauvegarde en draft en une seule opération
   * POST /api/admin/seo/generate-and-save
   *
   * Équivalent à POST /generate avec save_draft=true
   */
  @Post('generate-and-save')
  async generateAndSave(@Body() dto: GenerateDto): Promise<GenerateResponse> {
    this.logger.log(
      `🏭 POST /api/admin/seo/generate-and-save - pg_id=${dto.pg_id}, slug=${dto.slug}`,
    );

    // Forcer save_draft à true
    return this.generate({ ...dto, save_draft: true });
  }

  /**
   * Liste les fichiers RAG gammes disponibles
   * GET /api/admin/seo/rag-files
   *
   * @returns Liste des slugs de gammes avec fichier RAG
   */
  @Get('rag-files')
  async listRagFiles(): Promise<{ files: string[]; count: number }> {
    this.logger.log('📁 GET /api/admin/seo/rag-files');

    const files = await this.generatorService.listAvailableRagFiles();

    return {
      files,
      count: files.length,
    };
  }

  /**
   * Sauvegarde une R4 générée en draft
   * POST /api/admin/seo/save-r4
   */
  @Post('save-r4')
  async saveR4(
    @Body() r4: GeneratedR4,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`💾 POST /api/admin/seo/save-r4 - slug=${r4.slug}`);

    if (!r4.slug || !r4.title || !r4.definition) {
      throw new BadRequestException('slug, title, and definition are required');
    }

    return this.generatorService.saveR4Draft(r4);
  }

  /**
   * Sauvegarde une R5 générée en draft
   * POST /api/admin/seo/save-r5
   */
  @Post('save-r5')
  async saveR5(
    @Body() r5: GeneratedR5,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`💾 POST /api/admin/seo/save-r5 - slug=${r5.slug}`);

    if (!r5.slug || !r5.title || !r5.symptom_description) {
      throw new BadRequestException(
        'slug, title, and symptom_description are required',
      );
    }

    return this.generatorService.saveR5Draft(r5);
  }
}
