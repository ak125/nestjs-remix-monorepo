import {
  Controller,
  Get,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AdviceService } from '../services/advice.service';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';

/**
 * 🏗️ Contrôleur pour la hiérarchie des conseils par famille
 */
@Controller('api/blog/advice-hierarchy')
export class AdviceHierarchyController {
  private readonly logger = new Logger(AdviceHierarchyController.name);

  constructor(
    private readonly adviceService: AdviceService,
    private readonly supabaseService: SupabaseIndexationService,
  ) {}

  /**
   * 📦 Récupérer tous les conseils groupés par famille du catalogue
   * GET /api/blog/advice-hierarchy
   */
  @Get()
  async getAdviceByFamily() {
    try {
      this.logger.log('📦 Récupération conseils par famille...');

      // 1. Récupérer tous les conseils
      const adviceResult = await this.adviceService.getAllAdvice({
        limit: 500,
        offset: 0,
      });

      if (!adviceResult.success || !adviceResult.articles) {
        throw new Error('Erreur récupération conseils');
      }

      const articles = adviceResult.articles;
      this.logger.log(`✅ ${articles.length} conseils récupérés`);

      // 2. Récupérer le mapping pg_id → famille depuis catalog_gamme
      const pgIds = [
        ...new Set(
          articles
            .map((a: any) => a.ba_pg_id || a.pg_id?.toString())
            .filter((id) => id),
        ),
      ];

      // Optimisation: Exécuter les 2 requêtes en parallèle
      const [catalogResult, familiesResult] = await Promise.all([
        this.supabaseService.client
          .from('catalog_gamme')
          .select('mc_pg_id, mc_mf_prime')
          .in('mc_pg_id', pgIds),
        this.supabaseService.client
          .from('catalog_family')
          .select('mf_id, mf_name, mf_sort')
          .order('mf_sort'),
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

      // 3. Créer des Maps pour accès O(1)
      const familyMap = new Map();
      if (familiesResult.data) {
        for (const f of familiesResult.data) {
          familyMap.set(f.mf_id, {
            id: f.mf_id,
            name: f.mf_name,
            sort: f.mf_sort,
          });
        }
      }

      const pgToFamily = new Map<
        string,
        { id: number; name: string; sort: number }
      >();
      if (catalogResult.data) {
        for (const mapping of catalogResult.data) {
          const family = familyMap.get(mapping.mc_mf_prime);
          if (family) {
            pgToFamily.set(mapping.mc_pg_id.toString(), family);
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
          articles: any[];
        }
      >();

      articles.forEach((article: any) => {
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
          familyGroups.get(family.name)!.articles.push(article);
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

      // 6. Convertir en array et trier par mf_sort (ordre database)
      const result = Array.from(familyGroups.values())
        .map((group) => ({
          ...group,
          count: group.articles.length,
          totalViews: group.articles.reduce(
            (sum, a) => sum + (a.viewsCount || 0),
            0,
          ),
        }))
        .sort((a, b) => a.familySort - b.familySort);

      this.logger.log(`✅ ${result.length} familles trouvées`);

      return {
        success: true,
        data: {
          families: result,
          totalArticles: articles.length,
          totalFamilies: result.length,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur advice-hierarchy: ${(error as Error).message}`,
      );
      throw new HttpException(
        'Erreur lors de la récupération de la hiérarchie',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
