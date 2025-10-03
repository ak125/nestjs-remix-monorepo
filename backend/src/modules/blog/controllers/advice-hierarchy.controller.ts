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

      const { data: catalogMapping, error: catalogError } =
        await this.supabaseService.client
          .from('catalog_gamme')
          .select('mc_pg_id, mc_mf_prime')
          .in('mc_pg_id', pgIds);

      if (catalogError) {
        this.logger.error('Erreur catalog_gamme:', catalogError.message);
      }

      // 3. Récupérer les noms des familles
      const mfIds = [
        ...new Set(catalogMapping?.map((m) => m.mc_mf_prime) || []),
      ];
      const { data: families, error: familiesError } =
        await this.supabaseService.client
          .from('catalog_family')
          .select('mf_id, mf_name, mf_sort')
          .in('mf_id', mfIds)
          .order('mf_sort');

      if (familiesError) {
        this.logger.error('Erreur catalog_family:', familiesError.message);
      }

      // 4. Créer un mapping pg_id → famille
      const pgToFamily = new Map<string, { id: number; name: string }>();
      catalogMapping?.forEach((mapping) => {
        const family = families?.find((f) => f.mf_id === mapping.mc_mf_prime);
        if (family) {
          pgToFamily.set(mapping.mc_pg_id.toString(), {
            id: family.mf_id,
            name: family.mf_name,
          });
        }
      });

      // 5. Grouper les articles par famille
      const familyGroups = new Map<
        string,
        { familyId: number; familyName: string; articles: any[] }
      >();

      articles.forEach((article: any) => {
        const pgId = article.ba_pg_id || article.pg_id?.toString() || '';
        const family = pgToFamily.get(pgId);

        if (family) {
          if (!familyGroups.has(family.name)) {
            familyGroups.set(family.name, {
              familyId: family.id,
              familyName: family.name,
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
              articles: [],
            });
          }
          familyGroups.get('Autres')!.articles.push(article);
        }
      });

      // 6. Convertir en array et trier par nombre d'articles
      const result = Array.from(familyGroups.values())
        .map((group) => ({
          ...group,
          count: group.articles.length,
          totalViews: group.articles.reduce(
            (sum, a) => sum + (a.viewsCount || 0),
            0,
          ),
        }))
        .sort((a, b) => b.totalViews - a.totalViews);

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
