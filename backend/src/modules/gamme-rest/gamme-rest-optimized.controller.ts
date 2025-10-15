import { Controller, Get, Param } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

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
@Controller('api/gamme-rest-optimized')
export class GammeRestOptimizedController extends SupabaseBaseService {
  @Get(':pgId/page-data')
  async getPageData(@Param('pgId') pgId: string) {
    const pgIdNum = parseInt(pgId, 10);
    console.log(`🚀 OPTIMISÉ PHP - PG_ID=${pgIdNum}`);

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
    // ========================================
    const [
      catalogDataResult,
      seoDataResult,
      conseilsDataResult,
      informationsDataResult,
      crossGammeDataResult,
      equipGammeDataResult,
      blogDataResult,
    ] = await Promise.all([
      // 4. MF DATA (CATALOG_GAMME)
      this.client
        .from('catalog_gamme')
        .select('mc_mf_prime')
        .eq('mc_pg_id', pgIdNum)
        .single(),

      // 5. SEO & CONTENT (__SEO_GAMME)
      this.client
        .from('__seo_gamme')
        .select('sg_title, sg_descrip, sg_keywords, sg_h1, sg_content')
        .eq('sg_pg_id', pgIdNum)
        .single(),

      // 6. CONSEILS (__SEO_GAMME_CONSEIL)
      this.client
        .from('__seo_gamme_conseil')
        .select('sgc_id, sgc_title, sgc_content')
        .eq('sgc_pg_id', pgIdNum)
        .order('sgc_id', { ascending: true }),

      // 7. INFORMATIONS (__SEO_GAMME_INFO)
      this.client
        .from('__seo_gamme_info')
        .select('sgi_content')
        .eq('sgi_pg_id', pgIdNum)
        .order('sgi_id', { ascending: true }),

      // 9. MOTORISATIONS (__CROSS_GAMME_CAR_NEW)
      this.client
        .from('__cross_gamme_car_new')
        .select('cgc_type_id, cgc_id, cgc_modele_id')
        .eq('cgc_pg_id', pgIdNum.toString())
        .eq('cgc_level', '1')
        .order('cgc_id', { ascending: true }),

      // 10. ÉQUIPEMENTIERS (__SEO_EQUIP_GAMME)
      this.client
        .from('__seo_equip_gamme')
        .select('seg_pm_id, seg_content')
        .eq('seg_pg_id', pgIdNum)
        .not('seg_content', 'is', null)
        .order('seg_id', { ascending: true })
        .limit(4),

      // 11. BLOG ADVICE (__BLOG_ADVICE)
      this.client
        .from('__blog_advice')
        .select('ba_id, ba_h1, ba_alias, ba_preview, ba_wall, ba_update')
        .eq('ba_pg_id', pgIdNum)
        .order('ba_update', { ascending: false })
        .order('ba_create', { ascending: false })
        .limit(1)
        .single(),
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
    // RÉCUPÉRATION MF_ID ET TRAITEMENT DES DONNÉES
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
    // CATALOGUE MÊME FAMILLE - VERSION SIMPLIFIÉE
    // ========================================
    const catalogueFiltres = [];
    if (mfId && catalogData) {
      console.log(
        `🔍 Recherche catalogue pour mfId=${mfId}, pgIdNum=${pgIdNum}`,
      );

      // Première étape : récupérer tous les pg_id de la même famille
      const { data: catalogItems, error: catalogItemsError } = await this.client
        .from('catalog_gamme')
        .select('mc_pg_id, mc_sort')
        .eq('mc_mf_id', mfId)
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
    // MOTORISATIONS - OPTIMISÉ AVEC JOINTURES
    // ========================================
    console.log('🚗 Récupération motorisations optimisée...');
    const motorisations = [];

    if (crossGammeData?.length > 0) {
      console.log(
        `✅ Trouvé ${crossGammeData.length} lignes cross_gamme_car_new`,
      );

      // GROUP BY comme PHP mais optimisé
      const processedModeles = new Set();
      const typePromises = [];

      for (const cross of crossGammeData) {
        if (processedModeles.has(cross.cgc_modele_id)) continue;
        processedModeles.add(cross.cgc_modele_id);

        // Jointure complète en une seule requête - CORRIGÉE
        const typePromise = this.client
          .from('auto_type')
          .select(
            `
            type_id, 
            type_name, 
            type_power_ps, 
            type_month_from, 
            type_year_from, 
            type_year_to,
            type_modele_id
          `,
          )
          .eq('type_id', cross.cgc_type_id)
          .eq('type_display', '1')
          .single()
          .then(async ({ data: typeData, error: typeError }) => {
            if (typeError || !typeData) return null;

            // Récupération du modèle séparément
            const { data: modeleData } = await this.client
              .from('auto_modele')
              .select('modele_id, modele_name, modele_marque_id')
              .eq('modele_id', typeData.type_modele_id)
              .eq('modele_display', '1')
              .single();

            if (!modeleData) return null;

            // Récupération de la marque séparément
            const { data: marqueData } = await this.client
              .from('auto_marque')
              .select('marque_id, marque_name')
              .eq('marque_id', modeleData.modele_marque_id)
              .eq('marque_display', '1')
              .single();

            if (!marqueData) return null;

            return {
              type: typeData,
              modele: modeleData,
              marque: marqueData,
            };
          });

        typePromises.push(typePromise);
      }

      // Exécution parallèle des requêtes de motorisations
      const typeResults = await Promise.all(typePromises);

      typeResults.forEach((result) => {
        if (result && result.type && result.modele && result.marque) {
          const {
            type: typeData,
            modele: modeleData,
            marque: marqueData,
          } = result;

          let typeDate = '';
          if (!typeData.type_year_to) {
            typeDate = `du ${typeData.type_month_from}/${typeData.type_year_from}`;
          } else {
            typeDate = `de ${typeData.type_year_from} à ${typeData.type_year_to}`;
          }

          motorisations.push({
            title: `${marqueData.marque_name} ${modeleData.modele_name} ${typeData.type_name}`,
            motorisation: typeData.type_name,
            puissance: `${typeData.type_power_ps} ch`,
            description: typeDate,
            advice: `Pièces compatibles ${pgNameSite}`,
            marque_name: marqueData.marque_name,
            modele_name: modeleData.modele_name,
          });
        }
      });
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
    return {
      status: 200,
      meta: {
        title: pageTitle,
        description: pageDescription,
        keywords: pageKeywords,
        robots: pageRobots,
        canonical: canonicalLink,
        relfollow,
      },
      content: {
        h1: pageH1,
        content: pageContent,
        pg_name: pgNameSite,
        pg_alias: pgAlias,
        pg_pic: pgPic,
        pg_wall: pgWall,
      },
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
              })),
            }
          : null,
      // Section "Les motorisations les plus consultées"
      motorisations:
        motorisations.length > 0
          ? {
              title: 'Les motorisations les plus consultées',
              items: motorisations.map((moto) => ({
                title: `${pgNameSite} prix bas ${moto.marque_name} ${moto.modele_name} ${moto.motorisation}, changer si encrassé`,
                marque_name: moto.marque_name,
                modele_name: moto.modele_name,
                type_name: moto.motorisation,
                puissance: moto.puissance,
                periode: moto.description,
                image: `/upload/constructeurs-automobiles/marques-modeles/${moto.marque_name.toLowerCase()}/${moto.modele_name.toLowerCase().replace(/\s+/g, '-')}.webp`,
                link: `/pieces/${pgAlias}-${pgIdNum}/${moto.marque_name.toLowerCase()}-${moto.marque_name.toLowerCase()}-${moto.modele_name.toLowerCase().replace(/\s+/g, '-')}/${moto.motorisation.toLowerCase().replace(/\s+/g, '-')}.html`,
                description: `contrôler si témoin allumé les ${pgNameSite} ${moto.marque_name} ${moto.modele_name} ${moto.motorisation} ${moto.puissance} et changer si encrassé, pour assurer une bonne qualité d'huile lubrifiante afin de garantir le bon fonctionnement du moteur.`,
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
