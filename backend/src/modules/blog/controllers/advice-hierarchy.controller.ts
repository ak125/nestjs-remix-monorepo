import { Controller, Get, Logger, Query } from '@nestjs/common';
import { AdviceService } from '../services/advice.service';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import { BlogCacheService } from '../services/blog-cache.service';
import {
  DatabaseException,
  OperationFailedException,
  ErrorCodes,
} from '../../../common/exceptions';

/**
 * 🏗️ Contrôleur pour la hiérarchie des conseils par famille
 * ⚡ Avec cache optimisé (TTL: 5 min)
 */
@Controller('api/blog/advice-hierarchy')
export class AdviceHierarchyController {
  private readonly logger = new Logger(AdviceHierarchyController.name);
  private readonly CACHE_KEY = 'advice_hierarchy:all';
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly adviceService: AdviceService,
    private readonly supabaseService: SupabaseIndexationService,
    private readonly cacheService: BlogCacheService,
  ) {}

  /**
   * 📦 Récupérer tous les conseils groupés par famille du catalogue
   * GET /api/blog/advice-hierarchy
   * ⚡ Avec cache Redis (5 min TTL)
   */
  @Get()
  async getAdviceByFamily(@Query('type') contentType?: string) {
    try {
      const cacheKey = contentType
        ? `${this.CACHE_KEY}:type:${contentType}`
        : this.CACHE_KEY;

      // Check cache first
      const cached = await this.cacheService.get<unknown>(
        cacheKey,
        this.CACHE_TTL,
      );
      if (cached) {
        this.logger.log(
          `Cache HIT - hierarchy${contentType ? ` (type=${contentType})` : ''}`,
        );
        return cached;
      }

      this.logger.log('Cache MISS - Récupération conseils par famille...');

      // 1. Récupérer tous les conseils
      const adviceResult = await this.adviceService.getAllAdvice({
        limit: 500,
        offset: 0,
      });

      if (!adviceResult.success || !adviceResult.articles) {
        throw new DatabaseException({
          code: ErrorCodes.BLOG.FETCH_FAILED,
          message: 'Erreur récupération conseils',
        });
      }

      let articles = adviceResult.articles;

      // Server-side filtering by content type
      if (contentType) {
        const validTypes = ['HOWTO', 'DIAGNOSTIC', 'BUYING_GUIDE', 'GLOSSARY'];
        if (validTypes.includes(contentType.toUpperCase())) {
          articles = articles.filter(
            (a) => a.contentType === contentType.toUpperCase(),
          );
        }
      }

      this.logger.log(
        `${articles.length} conseils récupérés${contentType ? ` (type=${contentType})` : ''}`,
      );

      // 2. Récupérer le mapping pg_id → famille depuis catalog_gamme
      const pgIds = [
        ...new Set(
          articles
            .map((a) => a.ba_pg_id || a.pg_id?.toString())
            .filter((id) => id),
        ),
      ];

      // Optimisation: Exécuter les 2 requêtes en parallèle
      const [catalogResult, familiesResult] = await Promise.all([
        this.supabaseService.client
          .from('catalog_gamme')
          .select('mc_pg_id, mc_mf_prime, mc_sort')
          .in('mc_pg_id', pgIds),
        this.supabaseService.client
          .from('catalog_family')
          .select('mf_id, mf_name, mf_sort'),
      ]);

      if (catalogResult.error) {
        this.logger.error('Erreur catalog_gamme:', catalogResult.error.message);
      }

      if (familiesResult.error) {
        this.logger.error(
          'Erreur catalog_family:',
          familiesResult.error.message,
        );
      }

      // 3. Créer des Maps pour accès O(1) — tri numérique (mf_sort est TEXT en DB)
      const familyMap = new Map();
      if (familiesResult.data) {
        for (const f of familiesResult.data) {
          familyMap.set(f.mf_id, {
            id: f.mf_id,
            name: f.mf_name,
            sort: Number(f.mf_sort || 0),
          });
        }
      }

      const pgToFamily = new Map<
        string,
        { id: number; name: string; sort: number; gammeSort: number }
      >();
      if (catalogResult.data) {
        for (const mapping of catalogResult.data) {
          const family = familyMap.get(mapping.mc_mf_prime);
          if (family) {
            pgToFamily.set(mapping.mc_pg_id.toString(), {
              ...family,
              gammeSort: Number(mapping.mc_sort || 999),
            });
          }
        }
      }

      // 5. Grouper les articles par famille
      const familyGroups = new Map<
        string,
        {
          familyId: number;
          familyName: string;
          familySort: number;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          articles: any[];
        }
      >();

      articles.forEach((article) => {
        const pgId = article.ba_pg_id || article.pg_id?.toString() || '';
        const family = pgToFamily.get(pgId);

        if (family) {
          if (!familyGroups.has(family.name)) {
            familyGroups.set(family.name, {
              familyId: family.id,
              familyName: family.name,
              familySort: family.sort,
              articles: [],
            });
          }
          // Ajouter gammeSort à l'article pour tri ultérieur
          familyGroups.get(family.name)!.articles.push({
            ...article,
            gammeSort: family.gammeSort,
          });
        } else {
          // Famille "Autres" pour articles sans famille
          if (!familyGroups.has('Autres')) {
            familyGroups.set('Autres', {
              familyId: 999,
              familyName: 'Autres',
              familySort: 999,
              articles: [],
            });
          }
          familyGroups.get('Autres')!.articles.push(article);
        }
      });

      // 6. Convertir en array et trier familles + articles
      const result = Array.from(familyGroups.values())
        .map((group) => ({
          ...group,
          // Trier les articles par mc_sort (ordre du catalogue)
          articles: group.articles.sort((a, b) => {
            const sortA = a.gammeSort || 999;
            const sortB = b.gammeSort || 999;
            return sortA - sortB;
          }),
          count: group.articles.length,
          totalViews: group.articles.reduce(
            (sum, a) => sum + (a.viewsCount || 0),
            0,
          ),
        }))
        .sort((a, b) => a.familySort - b.familySort);

      this.logger.log(`✅ ${result.length} familles trouvées`);

      const response = {
        success: true,
        data: {
          families: result,
          totalArticles: articles.length,
          totalFamilies: result.length,
        },
      };

      // Store in cache (5 minutes)
      await this.cacheService.set(cacheKey, response, this.CACHE_TTL);
      this.logger.log('Hierarchy cached for 5 minutes');

      return response;
    } catch (error) {
      this.logger.error(
        `❌ Erreur advice-hierarchy: ${(error as Error).message}`,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération de la hiérarchie',
      });
    }
  }

  /**
   * 🗑️ Invalider le cache de la hiérarchie
   * Utilisé après création/modification d'un conseil
   */
  async invalidateCache(): Promise<void> {
    try {
      await this.cacheService.del(this.CACHE_KEY);
      this.logger.log('🗑️ Cache hierarchy invalidé');
    } catch (error) {
      this.logger.warn('⚠️ Erreur invalidation cache:', error);
    }
  }
}
