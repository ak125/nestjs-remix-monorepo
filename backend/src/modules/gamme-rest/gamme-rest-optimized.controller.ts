import { Controller, Get, Param, Query, Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { CacheService } from '../cache/cache.service';

/**
 * 🚀 GAMME REST CONTROLLER OPTIMISÉ - REPRODUCTION EXACTE DU FICHIER PHP ORIGINAL
 *
 * Version optimisée avec requêtes parallélisées pour réduire le temps de réponse
 * Reproduit fidèlement la logique du fichier PHP avec toutes les sections :
 * - SEO complet (__seo_gamme)
 * - Motorisations (__cross_gamme_car_new + auto_*)
 * - Équipementiers (__seo_equip_gamme + pieces_marque)
 * - Catalogue même famille (catalog_gamme + catalog_family)
 * - Conseils (__seo_gamme_conseil)
 * - Informations (__seo_gamme_info)
 * - Blog advice (__blog_advice)
 */
@Injectable()
@Controller('api/gamme-rest-optimized')
export class GammeRestOptimizedController extends SupabaseBaseService {
  
  constructor(private readonly cacheService: CacheService) {
    super();
  }
  
  /**
   * 🚀 VERSION ULTRA-OPTIMISÉE avec PostgreSQL Function (1 seul RPC au lieu de 7 requêtes)
   * Réduit 23s → <500ms en agrégeant toutes les données côté DB
   */
  @Get(':pgId/page-data-rpc')
  async getPageDataRpc(@Param('pgId') pgId: string) {
    const pgIdNum = parseInt(pgId, 10);
    console.log(`🚀 RPC OPTIMISÉ - PG_ID=${pgIdNum}`);

    const startTime = performance.now();

    // ========================================
    // 1. REDIRECTION (exactement comme PHP)
    // ========================================
    if (pgIdNum === 3940) {
      return {
        redirect: '/pieces/corps-papillon-158.html',
      };
    }

    try {
      // ========================================
      // 2. UN SEUL APPEL RPC POUR TOUT 🚀
      // ========================================
      const { data: aggregatedData, error: rpcError } = await this.client
        .rpc('get_gamme_page_data', { p_pg_id: pgIdNum });

      if (rpcError) {
        console.error('❌ Erreur RPC:', rpcError);
        throw rpcError;
      }

      const rpcTime = performance.now();
      console.log(`⚡ RPC unique: ${(rpcTime - startTime).toFixed(1)}ms`);

      // Extraire les données agrégées
      const {
        seo_gamme: seoData,
        catalog_gamme: catalogData,
        seo_conseil: conseilsData,
        seo_info: informationsData,
        cross_gamme: crossGammeData,
        seo_equip: equipGammeData,
        blog_advice: blogAdviceData,
      } = aggregatedData;

      // ========================================
      // 3. RÉCUPÉRATION CATALOG_FAMILY (si nécessaire)
      // ========================================
      let mfId = null;
      let catalogueMameFamille = null;

      if (catalogData?.mc_mf_prime) {
        const { data: familyData } = await this.client
          .from('catalog_family')
          .select('mf_id, mf_name, mf_name_meta')
          .eq('mf_id', catalogData.mc_mf_prime)
          .eq('mf_display', 1)
          .single();

        if (familyData) {
          mfId = familyData.mf_id;
          
          // Catalogue même famille
          const { data: catalogItems } = await this.client
            .from('catalog_gamme')
            .select(
              'mc_id, mc_pg_id, mc_name, mc_name_url, mc_description, mc_meta_description',
            )
            .eq('mc_mf_id', mfId)
            .eq('mc_display', 1)
            .neq('mc_pg_id', pgIdNum)
            .order('mc_sort')
            .limit(16);

          if (catalogItems?.length > 0) {
            catalogueMameFamille = {
              title: `Catalogue ${familyData.mf_name}`,
              items: catalogItems.map(item => ({
                name: item.mc_name,
                link: `/pieces/${item.mc_name_url}-${item.mc_pg_id}.html`,
                image: `/upload/articles/gammes-produits/catalogue/${item.mc_name_url}.webp`,
                description: item.mc_description,
                meta_description: item.mc_meta_description,
              })),
            };
          }
        }
      }

      // ========================================
      // 4. MOTORISATIONS (traitement identique)
      // ========================================
      console.log('🚗 Récupération motorisations ultra-optimisée...');
      const motorisationsStartTime = performance.now();

      let motorisations = { title: 'Les motorisations les plus consultées', items: [] };

      if (crossGammeData?.length > 0) {
        console.log(`✅ Trouvé ${crossGammeData.length} lignes cross_gamme_car_new`);

        // Extraire les IDs uniques
        const uniqueTypeIds = [...new Set(crossGammeData.map(item => item.cgc_type_id).filter(Boolean))];
        const uniqueModeleIds = [...new Set(crossGammeData.map(item => item.cgc_modele_id).filter(Boolean))];

        console.log(`🔍 [DEBUG] ${uniqueTypeIds.length} typeIds uniques:`, uniqueTypeIds.slice(0, 5));

        // Requêtes bulk pour types, modèles, marques + SEO switches
        const [typesResult, modelesResult, seoSwitchesResult] = await Promise.all([
          this.client.from('auto_type').select('*').in('type_id', uniqueTypeIds),
          this.client.from('auto_modele').select('*').in('modele_id', uniqueModeleIds),
          this.client
            .from('__seo_family_gamme_car_switch')
            .select('*')
            .eq('sfgcs_pg_id', pgIdNum.toString())
            .limit(50),
        ]);

        const types = typesResult.data || [];
        const modeles = modelesResult.data || [];
        const seoSwitches = seoSwitchesResult.data || [];
        
        console.log(`🔍 [DEBUG] ${seoSwitches.length} fragments SEO personnalisés trouvés`);

        console.log(`🔍 [DEBUG] ${types.length} types trouvés`);
        console.log(`🔍 [DEBUG] ${uniqueModeleIds.length} modeleIds uniques`);
        console.log(`🔍 [DEBUG] ${modeles.length} modèles trouvés`);

        const uniqueMarqueIds = [...new Set(modeles.map(m => m.modele_marque_id).filter(Boolean))];
        const { data: marques } = await this.client
          .from('auto_marque')
          .select('*')
          .in('marque_id', uniqueMarqueIds);

        console.log(`🔍 [DEBUG] ${marques?.length || 0} marques trouvées`);

        const motorisationsEndTime = performance.now();
        console.log(
          `⚡ Motorisations bulk queries: ${(motorisationsEndTime - motorisationsStartTime).toFixed(1)}ms`,
        );

        // Créer des Maps avec conversion String() pour éviter les mismatches
        const typesMap = new Map(types.map(t => [String(t.type_id), t]));
        const modelesMap = new Map(modeles.map(m => [String(m.modele_id), m]));
        const marquesMap = new Map((marques || []).map(m => [String(m.marque_id), m]));
        
        // Fonction pour obtenir un fragment SEO aléatoire
        const getRandomSeoFragment = (): string => {
          if (seoSwitches.length === 0) return '';
          const randomIndex = Math.floor(Math.random() * seoSwitches.length);
          return seoSwitches[randomIndex]?.sfgcs_content || '';
        };

        // Construire les motorisations
        const seen = new Set();
        let created = 0;
        let skippedNoType = 0;
        let skippedDuplicate = 0;
        let skippedNoModele = 0;
        let skippedNoMarque = 0;

        for (const item of crossGammeData) {
          const typeIdStr = String(item.cgc_type_id);
          const modeleIdStr = String(item.cgc_modele_id);

          const typeData = typesMap.get(typeIdStr);
          if (!typeData) {
            skippedNoType++;
            continue;
          }

          const modeleData = modelesMap.get(modeleIdStr);
          if (!modeleData) {
            skippedNoModele++;
            continue;
          }

          const marqueIdStr = String(modeleData.modele_marque_id);
          const marqueData = marquesMap.get(marqueIdStr);
          if (!marqueData) {
            skippedNoMarque++;
            continue;
          }

          const key = `${marqueIdStr}-${modeleIdStr}-${typeIdStr}`;
          if (seen.has(key)) {
            skippedDuplicate++;
            continue;
          }
          seen.add(key);
          created++;

          // Construire une description pertinente avec fragment SEO
          const seoFragment = getRandomSeoFragment();
          const description = seoFragment
            ? `Trouvez les ${catalogData?.mc_name || 'pièces'} ${marqueData.marque_name} ${modeleData.modele_name} ${typeData.type_name} ${typeData.type_puissance_ch} ch ${seoFragment}. ${typeData.type_periode || ''}`
            : `Trouvez les ${catalogData?.mc_name || 'pièces'} pour votre ${marqueData.marque_name} ${modeleData.modele_name} ${typeData.type_name} ${typeData.type_puissance_ch} ch. Livraison rapide et garantie constructeur.`;

          motorisations.items.push({
            title: `${catalogData?.mc_name || 'Pièce'} ${marqueData.marque_name} ${modeleData.modele_name} ${typeData.type_name}`,
            marque_name: marqueData.marque_name,
            modele_name: modeleData.modele_name,
            type_name: typeData.type_name,
            puissance: `${typeData.type_puissance_ch} ch`,
            periode: typeData.type_periode || 'N/A',
            image: `/upload/constructeurs-automobiles/marques-modeles/${marqueData.marque_name_url}/${modeleData.modele_name_url}.webp`,
            link: `/pieces/${catalogData?.mc_name_url || 'piece'}-${pgIdNum}/${marqueData.marque_name_url}-${modeleData.modele_name_url}/${typeData.type_name_url}.html`,
            description: description.trim(),
            advice: `${catalogData?.mc_name || 'Pièce'} ${marqueData.marque_name} ${modeleData.modele_name} ${typeData.type_name} ${typeData.type_puissance_ch} ch`,
          });
        }

        console.log(
          `📊 [DEBUG] Motorisations: ${created} créées, ${skippedNoType} sans type, ${skippedDuplicate} doublons, ${skippedNoModele} sans modèle, ${skippedNoMarque} sans marque`,
        );
      }

      console.log(`✅ Motorisations finales optimisées: ${motorisations.items.length}`);

      // ========================================
      // 5. CONSTRUCTION DE LA RÉPONSE FINALE
      // ========================================
      const totalTime = performance.now();
      console.log(`🚀 TEMPS TOTAL RPC: ${(totalTime - startTime).toFixed(1)}ms`);

      return {
        status: 200,
        meta: seoData ? {
          title: seoData.sg_title || '',
          description: seoData.sg_descrip || '',
          keywords: seoData.sg_keywords || '',
          robots: 'noindex, nofollow',
          canonical: `pieces/${catalogData?.mc_name_url || 'piece'}-${pgIdNum}.html`,
          relfollow: 0,
        } : {},
        content: {
          h1: seoData?.sg_h1 || '',
          content: seoData?.sg_content || '',
          pg_name: catalogData?.mc_name || '',
          pg_alias: catalogData?.mc_name_url || '',
          pg_pic: `${catalogData?.mc_name_url || 'piece'}.webp`,
          pg_wall: `${catalogData?.mc_name_url || 'piece'}s.jpg`,
        },
        catalogueMameFamille,
        motorisations,
        conseils: conseilsData ? {
          title: `Conseils pour ${catalogData?.mc_name || 'cette pièce'}`,
          content: conseilsData.map(c => c.sgc_content).join('\n'),
          items: conseilsData.map(c => ({
            id: String(c.sgc_id),
            title: c.sgc_title,
            content: c.sgc_content,
          })),
        } : null,
        informations: informationsData ? {
          title: `Informations sur les ${catalogData?.mc_name || 'pièces'}`,
          content: informationsData.map(i => `<p>${i.sgi_content}</p>`).join(''),
          items: informationsData.map(i => i.sgi_content),
        } : null,
        equipementiers: equipGammeData?.length > 0 ? {
          title: `Équipementiers ${catalogData?.mc_name || 'Pièce'}`,
          items: equipGammeData.map(e => ({
            pm_id: e.seg_pm_id,
            description: e.seg_content,
          })),
        } : null,
        guide: blogAdviceData?.[0] ? {
          id: String(blogAdviceData[0].ba_id),
          title: blogAdviceData[0].ba_h1,
          alias: blogAdviceData[0].ba_alias,
          preview: blogAdviceData[0].ba_preview,
          wall: blogAdviceData[0].ba_wall || 'no.jpg',
          date: blogAdviceData[0].ba_update,
        } : null,
        performance: {
          total_time_ms: totalTime - startTime,
          rpc_time_ms: rpcTime - startTime,
          motorisations_count: motorisations.items.length,
          method: 'postgres_rpc_aggregation',
        },
      };
    } catch (error) {
      console.error('❌ Erreur getPageDataRpc:', error);
      return {
        status: 500,
        error: 'Internal server error',
        message: error.message,
      };
    }
  }

  @Get(':pgId/page-data')
  async getPageData(@Param('pgId') pgId: string) {
    const pgIdNum = parseInt(pgId, 10);
    console.log(`🚀 OPTIMISÉ PHP - PG_ID=${pgIdNum}`);

    /**
     * 🔗 Génère une URL de pièce avec véhicule de manière robuste
     * Format: /pieces/{gamme-alias-id}/{marque-name-id}/{modele-name-id}/{type-name-id}.html
     * 
     * @example
     * buildPieceVehicleUrl({
     *   gammeAlias: 'plaquette-de-frein', gammeId: 402,
     *   marqueName: 'RENAULT', marqueId: 140,
     *   modeleName: 'MEGANE III', modeleId: 140049,
     *   typeName: '1.5 dCi', typeId: 100413
     * })
     * // => '/pieces/plaquette-de-frein-402/renault-140/megane-iii-140049/1-5-dci-100413.html'
     */
    const buildPieceVehicleUrl = (params: {
      gammeAlias: string;
      gammeId: number;
      marqueName: string;
      marqueId: number;
      modeleName: string;
      modeleId: number;
      typeName: string;
      typeId: number;
    }): string => {
      // Fonction pour normaliser un nom en slug URL-friendly
      const slugify = (text: string): string => {
        return text
          .toLowerCase()
          .normalize('NFD') // Décomposer les accents
          .replace(/[\u0300-\u036f]/g, '') // Supprimer les diacritiques
          .replace(/[^a-z0-9]+/g, '-') // Remplacer non-alphanumérique par -
          .replace(/^-+|-+$/g, ''); // Enlever - en début/fin
      };

      return [
        '/pieces',
        `${slugify(params.gammeAlias)}-${params.gammeId}`,
        `${slugify(params.marqueName)}-${params.marqueId}`,
        `${slugify(params.modeleName)}-${params.modeleId}`,
        `${slugify(params.typeName)}-${params.typeId}.html`
      ].join('/');
    };

    // Fonction pour décoder les entités HTML et remplacer les variables
    const cleanSeoText = (text: string, marqueName: string): string => {
      if (!text) return text;
      
      // Décoder les entités HTML
      const htmlEntities: Record<string, string> = {
        '&eacute;': 'é', '&egrave;': 'è', '&ecirc;': 'ê', '&euml;': 'ë',
        '&agrave;': 'à', '&acirc;': 'â', '&auml;': 'ä',
        '&ocirc;': 'ô', '&ouml;': 'ö', '&ograve;': 'ò',
        '&icirc;': 'î', '&iuml;': 'ï', '&igrave;': 'ì',
        '&ucirc;': 'û', '&ugrave;': 'ù', '&uuml;': 'ü',
        '&ccedil;': 'ç', '&rsquo;': "'", '&lsquo;': "'",
        '&rdquo;': '"', '&ldquo;': '"', '&nbsp;': ' ',
        '&amp;': '&', '&lt;': '<', '&gt;': '>',
      };
      
      let cleanedText = text;
      Object.entries(htmlEntities).forEach(([entity, char]) => {
        cleanedText = cleanedText.replace(new RegExp(entity, 'g'), char);
      });
      
      // Remplacer les variables
      cleanedText = cleanedText.replace(/#VMarque#/g, marqueName);
      
      return cleanedText;
    };

    // ⚡ CACHE REDIS - TTL 1 HEURE (3600s) pour éviter les timeouts
    const cacheKey = `gamme:page-data:${pgIdNum}`;
    
    try {
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === 'string') {
        console.log(`✅ Cache HIT pour PG_ID=${pgIdNum} (< 10ms)`);
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('⚠️ Erreur lecture cache Redis:', error);
    }

    console.log(`🔍 Cache MISS pour PG_ID=${pgIdNum} - Chargement depuis Supabase...`);
    const startTime = performance.now();

    // ========================================
    // 1. REDIRECTION (exactement comme PHP)
    // ========================================
    if (pgIdNum === 3940) {
      return {
        redirect: '/pieces/corps-papillon-158.html',
        status: 301,
      };
    }

    // ========================================
    // 2-3. VALIDATION INITIALE
    // ========================================
    const { data: selectorData, error: selectorError } = await this.client
      .from('pieces_gamme')
      .select('pg_display, pg_name')
      .eq('pg_id', pgIdNum)
      .in('pg_level', [1, 2])
      .single();

    if (selectorError || !selectorData || selectorData.pg_display != 1) {
      return {
        status: selectorError ? 410 : 412,
        error: selectorError ? 'Page not found' : 'Page disabled',
        debug: { selectorError, selectorData },
      };
    }

    const { data: pageData, error: pageError } = await this.client
      .from('pieces_gamme')
      .select('pg_alias, pg_name, pg_name_meta, pg_relfollow, pg_img, pg_wall')
      .eq('pg_id', pgIdNum)
      .eq('pg_display', 1)
      .in('pg_level', [1, 2])
      .single();

    if (pageError || !pageData) {
      return {
        status: 410,
        error: 'Page data not found',
        debug: { pageError },
      };
    }

    // ========================================
    // 4-11. RÉCUPÉRATION PARALLÉLISÉE DE TOUTES LES DONNÉES 🚀
    // + CACHE REDIS PAR SOUS-REQUÊTE (TTL 1h)
    // ========================================
    
    // ⚡ Fonction helper pour cache ou fetch
    const cachedQuery = async <T>(
      subKey: string,
      queryFn: () => Promise<T>,
      ttl = 3600,
    ): Promise<T> => {
      const key = `${cacheKey}:${subKey}`;
      try {
        const cached = await this.cacheService.get(key);
        if (cached) {
          console.log(`  ✅ Sub-cache HIT: ${subKey}`);
          return typeof cached === 'string' ? JSON.parse(cached) : (cached as T);
        }
      } catch (e) {
        console.warn(`  ⚠️ Cache read error for ${subKey}`);
      }
      
      const fresh = await queryFn();
      try {
        await this.cacheService.set(key, JSON.stringify(fresh), ttl);
        console.log(`  📦 Sub-cache SET: ${subKey} (TTL: ${ttl}s)`);
      } catch (e) {
        console.warn(`  ⚠️ Cache write error for ${subKey}`);
      }
      return fresh;
    };

    const [
      catalogDataResult,
      seoDataResult,
      conseilsDataResult,
      informationsDataResult,
      crossGammeDataResult,
      equipGammeDataResult,
      blogDataResult,
    ] = await Promise.all([
      // 4. MF DATA (CATALOG_GAMME) - Cachée 1h
      cachedQuery('catalog', async () => {
        const result = await this.client
          .from('catalog_gamme')
          .select('mc_mf_prime')
          .eq('mc_pg_id', pgIdNum)
          .single();
        return result;
      }),

      // 5. SEO & CONTENT (__SEO_GAMME) - Cachée 1h
      cachedQuery('seo', async () => {
        const result = await this.client
          .from('__seo_gamme')
          .select('sg_title, sg_descrip, sg_keywords, sg_h1, sg_content')
          .eq('sg_pg_id', pgIdNum)
          .single();
        return result;
      }),

      // 6. CONSEILS (__SEO_GAMME_CONSEIL) - Cachée 1h
      cachedQuery('conseils', async () => {
        const result = await this.client
          .from('__seo_gamme_conseil')
          .select('sgc_id, sgc_title, sgc_content')
          .eq('sgc_pg_id', pgIdNum);
        return result;
      }),

      // 7. INFORMATIONS (__SEO_GAMME_INFO) - Cachée 1h
      cachedQuery('informations', async () => {
        const result = await this.client
          .from('__seo_gamme_info')
          .select('sgi_content')
          .eq('sgi_pg_id', pgIdNum);
        return result;
      }),

      // 9. MOTORISATIONS (__CROSS_GAMME_CAR_NEW) - Cachée 2h (données stables)
      cachedQuery(
        'motorisations',
        async () => {
          const result = await this.client
            .from('__cross_gamme_car_new')
            .select('cgc_type_id, cgc_id, cgc_modele_id')
            .eq('cgc_pg_id', pgIdNum.toString())
            .eq('cgc_level', '1');
          return result;
        },
        7200,
      ),

      // 10. ÉQUIPEMENTIERS (__SEO_EQUIP_GAMME) - Cachée 2h
      cachedQuery(
        'equipementiers',
        async () => {
          const result = await this.client
            .from('__seo_equip_gamme')
            .select('seg_pm_id, seg_content')
            .eq('seg_pg_id', pgIdNum)
            .not('seg_content', 'is', null)
            .limit(4);
          return result;
        },
        7200,
      ),

      // 11. BLOG ADVICE (__BLOG_ADVICE) - Cachée 1h
      cachedQuery('blog', async () => {
        const result = await this.client
          .from('__blog_advice')
          .select('ba_id, ba_h1, ba_alias, ba_preview, ba_wall, ba_update')
          .eq('ba_pg_id', pgIdNum)
          .order('ba_update', { ascending: false })
          .order('ba_create', { ascending: false })
          .limit(1)
          .single();
        return result;
      }),
    ]);

    const parallelTime = performance.now();
    console.log(
      `⚡ Requêtes parallèles: ${(parallelTime - startTime).toFixed(1)}ms`,
    );

    // Traitement des résultats
    const { data: catalogData } = catalogDataResult;
    const { data: seoData } = seoDataResult;
    const { data: conseilsData } = conseilsDataResult;
    const { data: informationsData } = informationsDataResult;
    const { data: crossGammeData } = crossGammeDataResult;
    const { data: equipGammeData } = equipGammeDataResult;
    const { data: blogData, error: blogError } = blogDataResult;

    // ========================================
    // RÉCUPÉRATION MF_ID ET TRAITEMENT DES DONNÉES - PARALLÉLISÉE
    // ========================================
    let mfId = null;
    if (catalogData) {
      const { data: familyData } = await this.client
        .from('catalog_family')
        .select('mf_id, mf_name, mf_name_meta')
        .eq('mf_id', catalogData.mc_mf_prime)
        .eq('mf_display', 1)
        .single();

      if (familyData) {
        mfId = familyData.mf_id;
      }
    }

    // Variables principales exactement comme PHP
    const pgNameSite = pageData.pg_name;
    const pgNameMeta = pageData.pg_name_meta;
    const pgAlias = pageData.pg_alias;
    const pgRelfollow = pageData.pg_relfollow;
    const pgPic = pageData.pg_img;
    const pgWall = pageData.pg_wall;

    // ========================================
    // TRAITEMENT SEO & CONTENT
    // ========================================
    let pageTitle, pageDescription, pageKeywords, pageH1, pageContent;

    if (seoData) {
      pageTitle = this.contentCleaner(seoData.sg_title || '');
      pageDescription = this.contentCleaner(seoData.sg_descrip || '');
      pageKeywords = this.contentCleaner(seoData.sg_keywords || '');
      pageH1 = this.contentCleaner(seoData.sg_h1 || '');
      pageContent = this.contentCleaner(seoData.sg_content || '');
    } else {
      pageTitle = pgNameMeta + ' neuf & à prix bas';
      pageDescription = `Votre ${pgNameMeta} au meilleur tarif, de qualité & à prix pas cher pour toutes marques et modèles de voitures.`;
      pageKeywords = pgNameMeta;
      pageH1 = `Choisissez ${pgNameSite} pas cher pour votre véhicule`;
      pageContent = `Le(s) <b>${pgNameSite}</b> commercialisés sur ${pgNameSite} sont disponibles pour tous les modèles de véhicules et dans plusieurs marques d'équipementiers de pièces détachées automobile.<br>Identifier la marque, l'année, le modèle et la motorisation de votre véhicule sélectionnez le <b>${pgNameSite}</b> compatible avec votre voiture.<br>Nous commercialisons des <b>${pgNameSite}</b> de différentes qualités : qualité d'origine, première monte et équivalente à l'origine avec des prix pas cher.`;
    }

    const relfollow = pgRelfollow === 1 ? 1 : 0;
    const pageRobots = relfollow === 1 ? 'index, follow' : 'noindex, nofollow';
    const canonicalLink = `pieces/${pgAlias}-${pgIdNum}.html`;

    // ========================================
    // TRAITEMENT CONSEILS
    // ========================================
    const conseils =
      conseilsData?.map((conseil) => ({
        id: conseil.sgc_id,
        title: this.contentCleaner(conseil.sgc_title || ''),
        content: this.contentCleaner(conseil.sgc_content || ''),
      })) || [];

    // ========================================
    // TRAITEMENT INFORMATIONS
    // ========================================
    const informations =
      informationsData?.map((info) => info.sgi_content) || [];

    // ========================================
    // CATALOGUE MÊME FAMILLE - VERSION SIMPLIFIÉE + INFO FAMILLE
    // ========================================
    const catalogueFiltres = [];
    let familleInfo = null; // 🎨 Nouvelle info famille avec couleur
    
    if (mfId && catalogData) {
      console.log(
        `🔍 Recherche catalogue pour mfId=${mfId}, pgIdNum=${pgIdNum}`,
      );

      // 🎨 Récupérer les informations de la famille (nom + image pour couleur)
      const { data: familyData } = await this.client
        .from('catalog_family')
        .select('mf_id, mf_name, mf_name_system, mf_pic')
        .eq('mf_id', mfId)
        .single();

      if (familyData) {
        familleInfo = {
          mf_id: familyData.mf_id,
          mf_name: familyData.mf_name_system || familyData.mf_name,
          mf_pic: familyData.mf_pic,
        };
        console.log(`🎨 Famille trouvée: ${familleInfo.mf_name} (ID: ${familleInfo.mf_id})`);
      }

      // Première étape : récupérer tous les pg_id de la même famille
      const { data: catalogItems } = await this.client
        .from('catalog_gamme')
        .select('mc_pg_id, mc_sort')
        .eq('mc_mf_prime', mfId) // 🎯 Utiliser mc_mf_prime au lieu de mc_mf_id pour cohérence avec homepage
        .neq('mc_pg_id', pgIdNum);

      console.log(`📊 Catalogue items trouvés: ${catalogItems?.length || 0}`);

      if (catalogItems && catalogItems.length > 0) {
        // Deuxième étape : récupérer les détails des pièces
        const pgIds = catalogItems.map((item) => item.mc_pg_id);
        const { data: piecesItems } = await this.client
          .from('pieces_gamme')
          .select('pg_id, pg_name, pg_alias, pg_img')
          .in('pg_id', pgIds)
          .eq('pg_display', 1)
          .in('pg_level', [1, 2]);

        console.log(`📋 Pièces trouvées: ${piecesItems?.length || 0}`);

        if (piecesItems && piecesItems.length > 0) {
          // Créer un map pour les sorts
          const sortMap = new Map();
          catalogItems.forEach((item) => {
            sortMap.set(item.mc_pg_id, item.mc_sort || 0);
          });

          piecesItems.forEach((piece) => {
            catalogueFiltres.push({
              id: piece.pg_id,
              name: piece.pg_name,
              alias: piece.pg_alias,
              image: piece.pg_img,
              link: `/pieces/${piece.pg_alias}-${piece.pg_id}.html`,
              sort: sortMap.get(piece.pg_id) || 0,
            });
          });

          catalogueFiltres.sort((a, b) => a.sort - b.sort);
        }
      }
    }

    // ========================================
    // MOTORISATIONS - ULTRA-OPTIMISÉ AVEC BULK QUERIES
    // ========================================
    console.log('🚗 Récupération motorisations ultra-optimisée...');
    const motorisations = [];

    if (crossGammeData?.length > 0) {
      console.log(
        `✅ Trouvé ${crossGammeData.length} lignes cross_gamme_car_new`,
      );

      const startMotor = performance.now();

      // 🚀 OPTIMISATION: Récupérer TOUTES les données en 3 requêtes PARALLÈLES au lieu de N*3 requêtes
      const uniqueTypeIds = [...new Set(crossGammeData.map(c => c.cgc_type_id))];
      console.log(`🔍 [DEBUG] ${uniqueTypeIds.length} typeIds uniques:`, uniqueTypeIds.slice(0, 5));
      
      // ⚡ PHASE 1: Requête types en parallèle
      const typesResult = await this.client
        .from('auto_type')
        .select('type_id, type_name, type_power_ps, type_month_from, type_year_from, type_year_to, type_modele_id')
        .in('type_id', uniqueTypeIds)
        .eq('type_display', '1');

      const { data: allTypes } = typesResult;
      console.log(`🔍 [DEBUG] ${allTypes?.length || 0} types trouvés`);

      if (allTypes && allTypes.length > 0) {
        // Créer des Maps pour accès O(1) - CONVERSION EN STRING OBLIGATOIRE
        const typesMap = new Map(allTypes.map((t) => [String(t.type_id), t]));
        const uniqueModeleIds = [
          ...new Set(allTypes.map((t) => t.type_modele_id)),
        ];
        const uniqueMarqueIds = new Set<number>();
        console.log(`🔍 [DEBUG] ${uniqueModeleIds.length} modeleIds uniques`);

        // ⚡ PHASE 2: Requêtes modèles ET marques ET fragments SEO EN PARALLÈLE
        const [modelesResult, marquesResult, seoFragments1Result, seoFragments2Result] = await Promise.all([
          this.client
            .from('auto_modele')
            .select('modele_id, modele_name, modele_marque_id')
            .in('modele_id', uniqueModeleIds)
            .eq('modele_display', '1'),
          this.client
            .from('auto_marque')
            .select('marque_id, marque_name')
            .eq('marque_display', '1'),
          this.client
            .from('__seo_item_switch')
            .select('*')
            .eq('sis_pg_id', pgIdNum.toString())
            .eq('sis_alias', '1')
            .order('sis_id'),
          this.client
            .from('__seo_item_switch')
            .select('*')
            .eq('sis_pg_id', pgIdNum.toString())
            .eq('sis_alias', '2')
            .order('sis_id')
            .limit(50),
        ]);

        const { data: allModeles } = modelesResult;
        const { data: allMarques } = marquesResult;
        const seoFragments1 = seoFragments1Result.data || [];
        const seoFragments2 = seoFragments2Result.data || [];
        
        console.log(`🔍 [DEBUG] ${seoFragments1.length} fragments SEO trouvés (sis_alias=1)`);
        console.log(`🔍 [DEBUG] ${seoFragments2.length} fragments SEO trouvés (sis_alias=2)`);

        console.log(`🔍 [DEBUG] ${allModeles?.length || 0} modèles trouvés`);
        console.log(`🔍 [DEBUG] ${allMarques?.length || 0} marques trouvées`);
        
        // Fonction pour obtenir des fragments SEO basés sur type_id (logique PHP exacte)
    const getSeoFragmentsByTypeId = (typeId: number) => {
      // Logique PHP:
      // TITLE: $comp_switch_debut_2 = $this_type_id % $request_seo_item_switch_num_rows;
      // CONTENT: $comp_switch_debut = ($this_type_id+1) % $request_seo_item_switch_num_rows;
      const fragment1 = seoFragments1.length > 0 
        ? seoFragments1[(typeId + 1) % seoFragments1.length]?.sis_content || ''
        : '';
      const fragment2 = seoFragments2.length > 0
        ? seoFragments2[typeId % seoFragments2.length]?.sis_content || ''
        : '';
      return { fragment1, fragment2 };
    };
        
        if (allModeles && allModeles.length > 0) {
          const modelesMap = new Map(
            allModeles.map((m) => [String(m.modele_id), m]),
          );
          
          // Construire un Set des marques utilisées
          allModeles.forEach((m) => uniqueMarqueIds.add(m.modele_marque_id));
          
          const marquesMap = new Map(
            allMarques
              ?.filter((m) => uniqueMarqueIds.has(m.marque_id))
              .map((m) => [String(m.marque_id), m]) || [],
          );

          const motorTime = performance.now();
          console.log(
            `⚡ Motorisations bulk queries: ${(motorTime - startMotor).toFixed(1)}ms`,
          );

          // Maintenant construire les motorisations en mémoire (ultra rapide)
          const processedModeles = new Set();
          let skippedNoType = 0;
          let skippedDuplicate = 0;
          let skippedNoModele = 0;
          let skippedNoMarque = 0;

          for (const cross of crossGammeData) {
            const typeData = typesMap.get(String(cross.cgc_type_id));
            if (!typeData) {
              skippedNoType++;
              continue;
            }

            if (processedModeles.has(String(typeData.type_modele_id))) {
              skippedDuplicate++;
              continue;
            }
            processedModeles.add(String(typeData.type_modele_id));

            const modeleData = modelesMap.get(String(typeData.type_modele_id));
            if (!modeleData) {
              skippedNoModele++;
              continue;
            }

            const marqueData = marquesMap.get(String(modeleData.modele_marque_id));
            if (!marqueData) {
              skippedNoMarque++;
              continue;
            }

            let typeDate = '';
            if (!typeData.type_year_to) {
              typeDate = `du ${typeData.type_month_from}/${typeData.type_year_from}`;
            } else {
              typeDate = `de ${typeData.type_year_from} à ${typeData.type_year_to}`;
            }
            
            // Obtenir des fragments SEO basés sur type_id (logique PHP exacte)
            const { fragment1, fragment2 } = getSeoFragmentsByTypeId(cross.cgc_type_id);

            motorisations.push({
              title: `${marqueData.marque_name} ${modeleData.modele_name} ${typeData.type_name}`,
              motorisation: typeData.type_name,
              puissance: `${typeData.type_power_ps} ch`,
              description: typeDate,
              seoFragment1: fragment1, // Premier fragment (action principale)
              seoFragment2: fragment2, // Second fragment (objectif/détail)
              advice: `Pièces compatibles ${pgNameSite}`,
              marque_name: marqueData.marque_name,
              modele_name: modeleData.modele_name,
              // IDs nécessaires pour générer le lien correct
              marque_id: marqueData.marque_id,
              modele_id: modeleData.modele_id,
              type_id: typeData.type_id,
            });
          }

          console.log(
            `📊 [DEBUG] Motorisations: ${motorisations.length} créées, ${skippedNoType} sans type, ${skippedDuplicate} doublons, ${skippedNoModele} sans modèle, ${skippedNoMarque} sans marque`,
          );
        }
      }
    }

    console.log(`✅ Motorisations finales optimisées: ${motorisations.length}`);

    // ========================================
    // ÉQUIPEMENTIERS - OPTIMISÉ AVEC JOINTURE
    // ========================================
    const equipementiers = [];
    if (equipGammeData?.length > 0) {
      const marquePromises = equipGammeData.map((equip) =>
        this.client
          .from('pieces_marque')
          .select('pm_id, pm_name, pm_logo')
          .eq('pm_id', equip.seg_pm_id)
          .eq('pm_display', 1)
          .single()
          .then(({ data }) => ({ data, content: equip.seg_content })),
      );

      const marqueResults = await Promise.all(marquePromises);

      marqueResults.forEach(({ data: marqueData, content }) => {
        if (marqueData) {
          equipementiers.push({
            pm_id: marqueData.pm_id,
            pm_name: marqueData.pm_name,
            pm_logo: marqueData.pm_logo,
            description: this.contentCleaner(content || ''),
          });
        }
      });
    }

    // ========================================
    // GUIDE/BLOG
    // ========================================
    let guide = null;
    if (blogData && !blogError) {
      const { data: h2Data } = await this.client
        .from('__blog_advice_h2')
        .select('ba2_content')
        .eq('ba2_ba_id', blogData.ba_id)
        .order('ba2_id', { ascending: true })
        .limit(1);

      guide = {
        id: blogData.ba_id,
        title: blogData.ba_h1,
        alias: blogData.ba_alias,
        preview: blogData.ba_preview,
        wall: blogData.ba_wall,
        date: blogData.ba_update,
        h2_content: h2Data?.[0]?.ba2_content || null,
      };
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    console.log(`🚀 TEMPS TOTAL OPTIMISÉ: ${totalTime.toFixed(1)}ms`);

    // ========================================
    // 12. STRUCTURE FINALE EXACTEMENT COMME PHP HTML OPTIMISÉE
    // ========================================
    const responseData = {
      status: 200,
      meta: {
        title: pageTitle,
        description: pageDescription,
        keywords: pageKeywords,
        robots: pageRobots,
        canonical: canonicalLink,
        relfollow,
      },
      breadcrumbs: {
        items: [
          { label: 'Accueil', href: '/' },
          { label: 'Pièces Auto', href: '/pieces' },
          {
            label: pgNameSite,
            href: `/pieces/${pgAlias}-${pgIdNum}.html`,
          },
        ],
      },
      content: {
        h1: pageH1,
        content: pageContent,
        pg_name: pgNameSite,
        pg_alias: pgAlias,
        pg_pic: pgPic,
        pg_wall: pgWall,
      },
      // 🎨 Informations de la famille (pour couleur du hero)
      famille: familleInfo,
      // Section Guide/Blog
      guide: guide
        ? {
            id: guide.id,
            title: guide.title,
            alias: guide.alias,
            preview: guide.preview,
            wall: guide.wall,
            date: guide.date,
            image: `/upload/articles/gammes-produits/catalogue/${pgAlias}.webp`,
            link: `/blog-pieces-auto/conseils/${pgAlias}`,
            h2_content: guide.h2_content,
          }
        : null,
      // Section "Catalogue [Nom Gamme]"
      catalogueMameFamille:
        catalogueFiltres.length > 0
          ? {
              title: `Catalogue ${pgNameSite}s`,
              items: catalogueFiltres.map((item) => ({
                name: item.name,
                link: item.link,
                image: `/upload/articles/gammes-produits/catalogue/${item.alias}.webp`,
                description: `Automecanik vous conseils de contrôlez l'état du ${item.name.toLowerCase()} de votre véhicule et de le changer en respectant les périodes de remplacement du constructeur`,
                meta_description: `${item.name} pas cher à contrôler régulièrement, changer si encrassé`,
                sort: item.sort, // 🔢 Ajout du champ sort pour le frontend
              })),
            }
          : null,
      // Section "Les motorisations les plus consultées"
      motorisations:
        motorisations.length > 0
          ? {
              title: 'Les motorisations les plus consultées',
              items: motorisations.map((moto) => ({
                title: `${pgNameSite} ${moto.marque_name} ${moto.modele_name} ${moto.motorisation}`,
                marque_name: moto.marque_name,
                modele_name: moto.modele_name,
                type_name: moto.motorisation,
                puissance: moto.puissance,
                periode: moto.description,
                image: `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-modeles/${moto.marque_name.toLowerCase()}/${moto.modele_name.toLowerCase().replace(/\s+/g, '-')}.webp`,
                link: buildPieceVehicleUrl({
                  gammeAlias: pgAlias,
                  gammeId: pgIdNum,
                  marqueName: moto.marque_name,
                  marqueId: moto.marque_id,
                  modeleName: moto.modele_name,
                  modeleId: moto.modele_id,
                  typeName: moto.motorisation,
                  typeId: moto.type_id,
                }),
                description: moto.seoFragment1 && moto.seoFragment2
                  ? `${pgNameSite} petit prix ${moto.marque_name} ${moto.modele_name} ${moto.motorisation}, ${cleanSeoText(moto.seoFragment2, moto.marque_name)}. ${cleanSeoText(moto.seoFragment1, moto.marque_name)} et ${cleanSeoText(moto.seoFragment2, moto.marque_name)} les ${pgNameSite} ${moto.marque_name} ${moto.modele_name} ${moto.motorisation} ${moto.puissance}, ${moto.description}.`
                  : moto.seoFragment1
                  ? `${pgNameSite} petit prix ${moto.marque_name} ${moto.modele_name} ${moto.motorisation}. ${cleanSeoText(moto.seoFragment1, moto.marque_name)} les ${pgNameSite} ${moto.marque_name} ${moto.modele_name} ${moto.motorisation} ${moto.puissance}, ${moto.description}.`
                  : `${pgNameSite} petit prix pour votre ${moto.marque_name} ${moto.modele_name} ${moto.motorisation} ${moto.puissance}. Disponibles ${moto.description}.`,
                advice: `${pgNameSite} ${moto.marque_name} ${moto.modele_name} ${moto.motorisation} ${moto.puissance}`,
              })),
            }
          : null,
      // Section "Équipementiers [Nom Gamme]"
      equipementiers:
        equipementiers.length > 0
          ? {
              title: `Équipementiers ${pgNameSite}`,
              items: equipementiers.map((eq) => ({
                pm_id: eq.pm_id,
                pm_name: eq.pm_name,
                pm_logo: eq.pm_logo,
                title: `${pgNameSite} ${eq.pm_name}`,
                image: `/upload/equipementiers-automobiles/${eq.pm_name.toLowerCase()}.webp`,
                description: eq.description,
              })),
            }
          : null,
      // Section "Conseils pour [Nom Gamme]"
      conseils:
        conseils.length > 0
          ? {
              title: `Conseils pour ${pgNameSite}`,
              content: conseils
                .map((c) => `<h3>${c.title}</h3><p>${c.content}</p>`)
                .join(''),
              items: conseils,
            }
          : null,
      // Section "Informations sur les [Nom Gamme]"
      informations:
        informations.length > 0
          ? {
              title: `Informations sur les ${pgNameSite}`,
              content: informations.map((info) => `<p>- ${info}</p>`).join(''),
              items: informations,
            }
          : null,
      // Stats pour affichage frontend
      performance: {
        total_time_ms: totalTime,
        parallel_time_ms: parallelTime - startTime,
        motorisations_count: motorisations.length,
        catalogue_famille_count: catalogueFiltres.length,
        equipementiers_count: equipementiers.length,
        conseils_count: conseils.length,
        informations_count: informations.length,
        guide_available: guide ? 1 : 0,
      },
      debug: {
        pgIdNum,
        mfId,
        optimization: 'parallel_queries_v2',
        found_sections: {
          conseils: conseils.length,
          informations: informations.length,
          catalogueFiltres: catalogueFiltres.length,
          motorisations: motorisations.length,
          equipementiers: equipementiers.length,
          guide: guide ? 1 : 0,
        },
      },
    };

    // ⚡ MISE EN CACHE REDIS - TTL 1 heure (3600s)
    try {
      await this.cacheService.set(cacheKey, JSON.stringify(responseData), 3600);
      console.log(`✅ Cache MISS - Données mises en cache pour PG_ID=${pgIdNum} (TTL: 1h)`);
    } catch (error) {
      console.warn('⚠️ Erreur écriture cache Redis:', error);
    }

    return responseData;
  }

  @Get(':pgId')
  async getGammeDetails(@Param('pgId') pgId: string) {
    return this.getPageData(pgId);
  }

  private contentCleaner(content: string): string {
    if (!content) return '';
    return this.cleanHtmlContent(content);
  }

  private cleanHtmlContent(content: string): string {
    if (!content) return '';
    const withoutTags = content.replace(/<[^>]*>/g, '');
    const decoded = withoutTags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
    return decoded.replace(/\s+/g, ' ').trim();
  }
}
