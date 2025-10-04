import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { GuideService, GuideFilters } from '../services/guide.service';
import {
  ConstructeurService,
  ConstructeurFilters,
} from '../services/constructeur.service';
import { GlossaryService, GlossaryFilters } from '../services/glossary.service';

/**
 * 📚 ContentController - Contrôleur pour guides, constructeurs et glossaire
 *
 * Endpoints centralisés pour les différents types de contenu blog
 * autres que les conseils (advice).
 */
@Controller('api/blog')
export class ContentController {
  private readonly logger = new Logger(ContentController.name);

  constructor(
    private readonly guideService: GuideService,
    private readonly constructeurService: ConstructeurService,
    private readonly glossaryService: GlossaryService,
  ) {}

  // =====================================
  // 📖 GUIDES
  // =====================================

  /**
   * 📖 Liste des guides
   * GET /api/blog/guides?type=achat&limit=20
   */
  @Get('guides')
  async getAllGuides(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
    @Query('type') type?: 'achat' | 'technique' | 'entretien' | 'réparation',
    @Query('difficulty') difficulty?: 'débutant' | 'intermédiaire' | 'expert',
    @Query('minViews', new DefaultValuePipe(0), ParseIntPipe) minViews?: number,
  ) {
    try {
      const offset = (page - 1) * limit;

      const filters: GuideFilters = {};
      if (type) filters.type = type;
      if (difficulty) filters.difficulty = difficulty;
      if (minViews && minViews > 0) filters.minViews = minViews;

      const result = await this.guideService.getAllGuides({
        limit,
        offset,
        filters,
      });

      return {
        success: true,
        data: {
          guides: result.articles,
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
          filters,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Erreur liste guides: ${(error as Error).message}`);
      throw new HttpException(
        'Erreur lors de la récupération des guides',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📖 Récupérer un guide par slug
   * GET /api/blog/guides/slug/pieces-auto-comment-s-y-retrouver
   */
  @Get('guides/slug/:slug')
  async getGuideBySlug(@Param('slug') slug: string) {
    try {
      const guide = await this.guideService.getGuideBySlug(slug);

      if (!guide) {
        throw new HttpException('Guide non trouvé', HttpStatus.NOT_FOUND);
      }

      // Incrémenter les vues (utiliser l'ID du guide)
      if (guide.id) {
        await this.guideService.incrementGuideViews(parseInt(guide.id));
      }

      return {
        success: true,
        data: guide,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `❌ Erreur récupération guide ${slug}: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Erreur lors de la récupération',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📖 Récupérer un guide par ID
   * GET /api/blog/guides/123
   */
  @Get('guides/:id')
  async getGuideById(@Param('id', ParseIntPipe) id: number) {
    try {
      const guide = await this.guideService.getGuideById(id);

      if (!guide) {
        throw new HttpException('Guide non trouvé', HttpStatus.NOT_FOUND);
      }

      // Incrémenter les vues
      await this.guideService.incrementGuideViews(id);

      return {
        success: true,
        data: { guide },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `❌ Erreur récupération guide ${id}: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Erreur lors de la récupération',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🛒 Guides d'achat
   * GET /api/blog/guides/purchase
   */
  @Get('guides/category/purchase')
  async getPurchaseGuides() {
    try {
      const guides = await this.guideService.getPurchaseGuides();

      return {
        success: true,
        data: {
          guides,
          category: 'achat',
          total: guides.length,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Erreur guides achat: ${(error as Error).message}`);
      throw new HttpException(
        'Erreur lors de la récupération',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔧 Guides techniques
   * GET /api/blog/guides/technical
   */
  @Get('guides/category/technical')
  async getTechnicalGuides() {
    try {
      const guides = await this.guideService.getTechnicalGuides();

      return {
        success: true,
        data: {
          guides,
          category: 'technique',
          total: guides.length,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur guides techniques: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Erreur lors de la récupération',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // =====================================
  // 🏭 CONSTRUCTEURS
  // =====================================

  /**
   * 🏭 Liste des constructeurs
   * GET /api/blog/constructeurs?page=1&limit=20
   */
  @Get('constructeurs')
  async getAllConstructeurs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number = 30,
    @Query('brand') brand?: string,
    @Query('minViews', new DefaultValuePipe(0), ParseIntPipe) minViews?: number,
  ) {
    try {
      const offset = (page - 1) * limit;

      const filters: ConstructeurFilters = {};
      if (brand) filters.brand = brand;
      if (minViews && minViews > 0) filters.minViews = minViews;

      const result = await this.constructeurService.getAllConstructeurs({
        limit,
        offset,
        filters,
      });

      return {
        success: true,
        items: result.articles || [], // Format attendu par le frontend
        total: result.total || 0, // Protection contre null
        page,
        limit,
        totalPages: Math.ceil((result.total || 0) / limit),
        filters,
        // Rétrocompatibilité
        data: {
          constructeurs: result.articles,
          total: result.total,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur liste constructeurs: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Erreur lors de la récupération des constructeurs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🏭 Récupérer un constructeur par ID
   * GET /api/blog/constructeurs/123
   */
  @Get('constructeurs/:id')
  async getConstructeurById(@Param('id', ParseIntPipe) id: number) {
    try {
      const constructeur =
        await this.constructeurService.getConstructeurById(id);

      if (!constructeur) {
        throw new HttpException(
          'Constructeur non trouvé',
          HttpStatus.NOT_FOUND,
        );
      }

      // Récupérer les modèles associés
      const models = await this.constructeurService.getConstructeurModels(id);

      // Incrémenter les vues
      await this.constructeurService.incrementConstructeurViews(id);

      return {
        success: true,
        data: {
          constructeur,
          models,
          modelCount: models.length,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `❌ Erreur récupération constructeur ${id}: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Erreur lors de la récupération',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🏭 Constructeur par marque/nom
   * GET /api/blog/constructeurs/brand/peugeot
   */
  @Get('constructeurs/brand/:brand')
  async getConstructeurByBrand(@Param('brand') brand: string) {
    try {
      const constructeur =
        await this.constructeurService.getConstructeurByBrand(brand);

      if (!constructeur) {
        throw new HttpException(
          'Constructeur non trouvé',
          HttpStatus.NOT_FOUND,
        );
      }

      // Récupérer les modèles associés
      const models = await this.constructeurService.getConstructeurModels(
        constructeur.legacy_id!,
      );

      return {
        success: true,
        data: {
          constructeur,
          models,
          modelCount: models.length,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `❌ Erreur constructeur par marque ${brand}: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Erreur lors de la récupération',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔤 Constructeurs par ordre alphabétique
   * GET /api/blog/constructeurs/alphabetical
   */
  @Get('constructeurs/alphabetical')
  async getConstructeursByAlpha() {
    try {
      const constructeursByLetter =
        await this.constructeurService.getConstructeursByAlpha();

      return {
        success: true,
        data: {
          byLetter: constructeursByLetter,
          letters: Object.keys(constructeursByLetter).sort(),
          totalLetters: Object.keys(constructeursByLetter).length,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur constructeurs alphabétique: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Erreur lors de la récupération',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // =====================================
  // 📚 GLOSSAIRE
  // =====================================

  /**
   * 📚 Liste des termes du glossaire
   * GET /api/blog/glossaire?page=1&limit=50&letter=A
   */
  @Get('glossaire')
  async getAllTerms(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number = 50,
    @Query('letter') letter?: string,
    @Query('minViews', new DefaultValuePipe(0), ParseIntPipe) minViews?: number,
  ) {
    try {
      const offset = (page - 1) * limit;

      const filters: GlossaryFilters = {};
      if (letter) filters.letter = letter.toUpperCase();
      if (minViews && minViews > 0) filters.minViews = minViews;

      const result = await this.glossaryService.getAllTerms({
        limit,
        offset,
        filters,
      });

      return {
        success: true,
        data: {
          terms: result.articles,
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
          filters,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur liste glossaire: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Erreur lors de la récupération du glossaire',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📚 Récupérer un terme par ID
   * GET /api/blog/glossaire/123
   */
  @Get('glossaire/:id')
  async getTermById(@Param('id', ParseIntPipe) id: number) {
    try {
      const term = await this.glossaryService.getTermById(id);

      if (!term) {
        throw new HttpException('Terme non trouvé', HttpStatus.NOT_FOUND);
      }

      // Incrémenter les vues
      await this.glossaryService.incrementTermViews(id);

      return {
        success: true,
        data: { term },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `❌ Erreur récupération terme ${id}: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Erreur lors de la récupération',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔍 Recherche dans le glossaire
   * GET /api/blog/glossaire/search?q=moteur&limit=20
   */
  @Get('glossaire/search')
  async searchTerms(
    @Query('q') query: string = '',
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ) {
    try {
      if (!query.trim()) {
        throw new HttpException(
          'Terme de recherche requis',
          HttpStatus.BAD_REQUEST,
        );
      }

      const terms = await this.glossaryService.searchTerms(query, limit);

      return {
        success: true,
        data: {
          query,
          terms,
          total: terms.length,
          limit,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `❌ Erreur recherche glossaire: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Erreur lors de la recherche',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔤 Termes par lettre
   * GET /api/blog/glossaire/letter/A
   */
  @Get('glossaire/letter/:letter')
  async getTermsByLetter(@Param('letter') letter: string) {
    try {
      if (!letter || letter.length !== 1) {
        throw new HttpException(
          'Lettre valide requise (A-Z)',
          HttpStatus.BAD_REQUEST,
        );
      }

      const terms = await this.glossaryService.getTermsByLetter(
        letter.toUpperCase(),
      );

      return {
        success: true,
        data: {
          letter: letter.toUpperCase(),
          terms,
          total: terms.length,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `❌ Erreur termes lettre ${letter}: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Erreur lors de la récupération',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔤 Vue alphabétique complète
   * GET /api/blog/glossaire/alphabetical
   */
  @Get('glossaire/alphabetical')
  async getGlossaryAlphabetical() {
    try {
      const termsByLetter = await this.glossaryService.getTermsAlphabetical();

      return {
        success: true,
        data: {
          byLetter: termsByLetter,
          letters: Object.keys(termsByLetter).sort(),
          totalLetters: Object.keys(termsByLetter).length,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur glossaire alphabétique: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Erreur lors de la récupération',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🎲 Termes aléatoires pour découverte
   * GET /api/blog/glossaire/random?count=10
   */
  @Get('glossaire/random')
  async getRandomTerms(
    @Query('count', new DefaultValuePipe(10), ParseIntPipe) count: number = 10,
  ) {
    try {
      const terms = await this.glossaryService.getRandomTerms(count);

      return {
        success: true,
        data: {
          terms,
          count,
          total: terms.length,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur termes aléatoires: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Erreur lors de la récupération',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
