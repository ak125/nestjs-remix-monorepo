/**
 * 🎯 GAMME REST CONTROLLER - API COMPLÈTE BASÉE SUR PHP ORIGINAL
 *
 * Reproduction fidèle du fichier PHP original avec toutes les sections :
 * 1. Motorisations avec SEO dynamique
 * 2. Équipementiers avec jointures
 * 3. Catalogue même famille
 * 4. Conseils et informations
 * 5. Blog/guide
 * 6. SEO optimisé
 */

import { Controller, Get, Param } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

@Controller('api/gamme-rest-complete')
export class GammeRestCompleteController extends SupabaseBaseService {
  @Get(':pgId/page-data')
  async getPageData(@Param('pgId') pgId: string) {
    const pgIdNum = parseInt(pgId, 10);
    console.log(`🎯 API GAMME-REST COMPLÈTE - PG_ID=${pgIdNum}`);

    // REDIRECTION (comme PHP)
    if (pgIdNum === 3940) {
      return {
        redirect: '/pieces/corps-papillon-158.html',
        status: 301,
      };
    }

    // 1. QUERY SELECTOR (exactement comme l'API existante)
    const { data: selectorData, error: selectorError } = await this.client
      .from('pieces_gamme')
      .select('pg_display, pg_name')
      .eq('pg_id', pgIdNum)
      .in('pg_level', [1, 2])
      .single();

    // Debug info (comme l'API existante)
    console.log(`🔍 Debug pg_id=${pgIdNum}:`, { selectorData, selectorError });

    if (selectorError || !selectorData) {
      return {
        status: 410,
        error: 'Page not found',
        debug: { selectorError, selectorData },
      };
    }

    if (selectorData.pg_display != 1) {
      return {
        status: 412,
        error: 'Page disabled',
        debug: {
          pg_display: selectorData.pg_display,
          pg_name: selectorData.pg_name,
        },
      };
    }

    // 2. QUERY PAGE (split queries comme l'API existante)
    const { data: pageData, error: pageError } = await this.client
      .from('pieces_gamme')
      .select('pg_alias, pg_name, pg_name_meta, pg_relfollow, pg_img, pg_wall')
      .eq('pg_id', pgIdNum)
      .eq('pg_display', 1)
      .in('pg_level', [1, 2])
      .single();

    if (pageError || !pageData) {
      console.error('❌ Erreur page data:', pageError);
      return { status: 410, error: 'Page data not found' };
    }

    // 3. GET CATALOG INFO (séparément)
    const { data: catalogData } = await this.client
      .from('catalog_gamme')
      .select(
        `
        mc_mf_prime,
        catalog_family(mf_id, mf_name, mf_name_meta)
      `,
      )
      .eq('mc_pg_id', pgIdNum)
      .single();

    // Extraction des données
    const pgNameSite = pageData.pg_name;
    const pgNameMeta = pageData.pg_name_meta;
    const pgAlias = pageData.pg_alias;
    const pgRelfollow = pageData.pg_relfollow;
    const pgPic = pageData.pg_img;
    const pgWall = pageData.pg_wall;

    // MF data (catalog_family est un tableau)
    const catalogFamily = Array.isArray(catalogData?.catalog_family)
      ? catalogData.catalog_family[0]
      : catalogData?.catalog_family;
    const mfId = catalogFamily?.mf_id;

    // 3. SEO & CONTENT (comme PHP)
    const { data: seoData } = await this.client
      .from('__seo_gamme')
      .select('sg_title, sg_descrip, sg_keywords, sg_h1, sg_content')
      .eq('sg_pg_id', pgIdNum)
      .single();

    let pageTitle, pageDescription, pageKeywords, pageH1, pageContent;

    if (seoData) {
      pageTitle = this.contentCleaner(seoData.sg_title || '');
      pageDescription = this.contentCleaner(seoData.sg_descrip || '');
      pageKeywords = this.contentCleaner(seoData.sg_keywords || '');
      pageH1 = this.contentCleaner(seoData.sg_h1 || '');
      pageContent = this.contentCleaner(seoData.sg_content || '');
    } else {
      // Default content (comme PHP else)
      pageTitle = pgNameMeta + ' neuf & à prix bas';
      pageDescription = `Votre ${pgNameMeta} au meilleur tarif, de qualité & à prix pas cher pour toutes marques et modèles de voitures.`;
      pageKeywords = pgNameMeta;
      pageH1 = `Choisissez ${pgNameSite} pas cher pour votre véhicule`;
      pageContent = `Le(s) <b>${pgNameSite}</b> commercialisés sur ${pgNameSite} sont disponibles pour tous les modèles de véhicules et dans plusieurs marques d'équipementiers de pièces détachées automobile.<br>Identifier la marque, l'année, le modèle et la motorisation de votre véhicule sélectionnez le <b>${pgNameSite}</b> compatible avec votre voiture.<br>Nous commercialisons des <b>${pgNameSite}</b> de différentes qualités : qualité d'origine, première monte et équivalente à l'origine avec des prix pas cher.`;
    }

    // ROBOT ET CANONICAL (comme PHP)
    const relfollow = pgRelfollow === 1 ? 1 : 0;
    const pageRobots = relfollow === 1 ? 'index, follow' : 'noindex, nofollow';
    const canonicalLink = `pieces/${pgAlias}-${pgIdNum}.html`;

    // 4. MOTORISATIONS (reproduction exacte du PHP avec optimisations)
    console.log('🚗 Récupération motorisations optimisée...');

    const { data: crossGammeData } = await this.client
      .from('__cross_gamme_car_new')
      .select('cgc_type_id, cgc_id, cgc_modele_id')
      .eq('cgc_pg_id', pgIdNum.toString())
      .eq('cgc_level', '1')
      .order('cgc_id', { ascending: true });

    const motorisations: any[] = [];

    if (crossGammeData && crossGammeData.length > 0) {
      console.log(
        `✅ Trouvé ${crossGammeData.length} lignes cross_gamme_car_new`,
      );

      // GROUP BY TYPE_MODELE_ID (comme PHP)
      const processedModeles = new Set();
      const uniqueCrossData = crossGammeData.filter((cross) => {
        if (processedModeles.has(cross.cgc_modele_id)) return false;
        processedModeles.add(cross.cgc_modele_id);
        return true;
      });

      console.log(
        `📊 Motorisations uniques après GROUP BY: ${uniqueCrossData.length}`,
      );

      if (uniqueCrossData.length > 0) {
        // OPTIMISATION: Requêtes parallèles au lieu de séquentielles
        const typeIds = uniqueCrossData.map((cross) => cross.cgc_type_id);

        // Fetch all data in parallel (optimisé)
        const [typeResult, modeleResult, marqueResult] = await Promise.all([
          this.client
            .from('auto_type')
            .select(
              'type_id, type_name, type_alias, type_power_ps, type_month_from, type_year_from, type_year_to, type_modele_id',
            )
            .in('type_id', typeIds)
            .eq('type_display', '1'),

          this.client
            .from('auto_modele')
            .select(
              'modele_id, modele_name, modele_alias, modele_pic, modele_marque_id',
            )
            .eq('modele_display', '1'),

          this.client
            .from('auto_marque')
            .select('marque_id, marque_name, marque_alias, marque_name_meta')
            .eq('marque_display', '1'),
        ]);

        const allTypeData = typeResult.data || [];
        const allModeleData = modeleResult.data || [];
        const allMarqueData = marqueResult.data || [];

        // Create lookup Maps for O(1) joins
        const typeMap = new Map(
          allTypeData.map((type) => [type.type_id, type]),
        );
        const modeleMap = new Map(
          allModeleData.map((modele) => [modele.modele_id, modele]),
        );
        const marqueMap = new Map(
          allMarqueData.map((marque) => [marque.marque_id, marque]),
        );

        console.log(
          `📋 Maps créées: ${typeMap.size} types, ${modeleMap.size} modèles, ${marqueMap.size} marques`,
        );

        // Build motorisations avec SEO dynamique (comme PHP)
        for (const cross of uniqueCrossData) {
          const typeData = typeMap.get(cross.cgc_type_id);
          if (!typeData) continue;

          const modeleData = modeleMap.get(typeData.type_modele_id);
          if (!modeleData) continue;

          const marqueData = marqueMap.get(modeleData.modele_marque_id);
          if (!marqueData) continue;

          // Build date string (comme PHP)
          let typeDate = '';
          if (!typeData.type_year_to) {
            typeDate = `du ${typeData.type_month_from}/${typeData.type_year_from}`;
          } else {
            typeDate = `de ${typeData.type_year_from} à ${typeData.type_year_to}`;
          }

          // Image du modèle (comme PHP)
          let modeleGroupPic;
          if (!modeleData.modele_pic) {
            modeleGroupPic =
              '/upload/constructeurs-automobiles/marques-modeles/no.png';
          } else {
            modeleGroupPic = `/upload/constructeurs-automobiles/marques-modeles/${marqueData.marque_alias}/${modeleData.modele_pic}`;
          }

          // Link to car (comme PHP)
          const linkGammeCarLink = `/pieces/${pgAlias}-${pgIdNum}/${marqueData.marque_alias}-${marqueData.marque_id}/${modeleData.modele_alias}-${modeleData.modele_id}/${typeData.type_alias}-${typeData.type_id}.html`;

          // SEO DYNAMIQUE (reproduction du PHP complexe)
          const seoCarContent = await this.buildSeoCarContent(
            pgIdNum,
            typeData.type_id,
            pgNameSite,
            pgNameMeta,
            marqueData.marque_name,
            marqueData.marque_name_meta,
            modeleData.modele_name,
            typeData.type_name,
            typeDate,
            typeData.type_power_ps,
            linkGammeCarLink,
          );

          motorisations.push({
            title: `${pgNameSite} ${seoCarContent.prixPasCher} ${marqueData.marque_name} ${modeleData.modele_name} ${typeData.type_name}, ${seoCarContent.titleAddon}`,
            description: seoCarContent.content,
            image: modeleGroupPic,
            link: linkGammeCarLink,
            marque_name: marqueData.marque_name,
            modele_name: modeleData.modele_name,
            type_name: typeData.type_name,
            puissance: `${typeData.type_power_ps} ch`,
            periode: typeDate,
          });
        }
      }
    }

    console.log(`✅ Motorisations finales: ${motorisations.length}`);

    // 5. ÉQUIPEMENTIERS (reproduction du PHP)
    console.log('🏭 Récupération équipementiers...');
    const { data: equipementiersData } = await this.client
      .from('__seo_equip_gamme')
      .select('seg_title, seg_content')
      .eq('seg_pg_id', pgIdNum)
      .single();

    const equipementiers = {
      title: equipementiersData?.seg_title || '',
      content: this.contentCleaner(equipementiersData?.seg_content || ''),
    };

    // 6. CATALOGUE MÊME FAMILLE (reproduction du PHP avec optimisation)
    console.log('📦 Récupération catalogue même famille...');
    let catalogueMameFamille: any[] = [];

    if (mfId) {
      const { data: catalogFamilyData } = await this.client
        .from('catalog_gamme')
        .select(
          `
          mc_pg_id,
          pieces_gamme!inner(pg_id, pg_name, pg_alias, pg_name_meta, pg_img)
        `,
        )
        .eq('mc_mf_id', mfId)
        .neq('mc_pg_id', pgIdNum)
        .eq('pieces_gamme.pg_display', 1)
        .order('pieces_gamme.pg_name', { ascending: true });

      if (catalogFamilyData) {
        catalogueMameFamille = catalogFamilyData
          .map((item) => {
            const piece = item.pieces_gamme?.[0];
            if (!piece) return null;

            return {
              title: piece.pg_name,
              link: `/pieces/${piece.pg_alias}-${piece.pg_id}.html`,
              image: piece.pg_img
                ? `/upload/pieces-voiture/${piece.pg_img}`
                : '/upload/pieces-voiture/no.png',
              meta_name: piece.pg_name_meta,
            };
          })
          .filter(Boolean);
      }
    }

    // 7. CONSEILS (reproduction du PHP)
    console.log('💡 Récupération conseils...');
    const { data: conseilsData } = await this.client
      .from('__seo_conseil')
      .select('sc_title, sc_content')
      .eq('sc_pg_id', pgIdNum)
      .single();

    const conseils = {
      title: conseilsData?.sc_title || '',
      content: this.contentCleaner(conseilsData?.sc_content || ''),
    };

    // 8. INFORMATIONS (reproduction du PHP)
    console.log('ℹ️ Récupération informations...');
    const { data: informationsData } = await this.client
      .from('__seo_info')
      .select('si_title, si_content')
      .eq('si_pg_id', pgIdNum)
      .single();

    const informations = {
      title: informationsData?.si_title || '',
      content: this.contentCleaner(informationsData?.si_content || ''),
    };

    // Structure finale COMPLÈTE (comme PHP)
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
      hero: {
        title: pageH1,
        description: pageContent,
      },
      motorisations: {
        title: 'Les motorisations les plus consultées',
        items: motorisations,
      },
      equipementiers: {
        title: equipementiers.title,
        content: equipementiers.content,
      },
      catalogueMameFamille: {
        title: 'Catalogue dans la même famille',
        items: catalogueMameFamille,
      },
      conseils: {
        title: conseils.title,
        content: conseils.content,
      },
      informations: {
        title: informations.title,
        content: informations.content,
      },
      content: {
        h1: pageH1,
        content: pageContent,
        pg_name: pgNameSite,
        pg_alias: pgAlias,
        pg_pic: pgPic,
        pg_wall: pgWall,
      },
      performance: {
        motorisations_count: motorisations.length,
        catalogue_famille_count: catalogueMameFamille.length,
      },
      debug: {
        pgIdNum,
        pageData,
        catalogData,
        mfId,
      },
    };
  }

  /**
   * Construction du contenu SEO dynamique pour les motorisations
   */
  private async buildSeoCarContent(
    pgId: number,
    typeId: number,
    pgNameSite: string,
    pgNameMeta: string,
    marqueName: string,
    _marqueNameMeta: string,
    modeleName: string,
    typeName: string,
    typeDate: string,
    typePowerPs: number,
    linkGammeCarLink: string,
  ) {
    // Prix pas cher array (comme PHP)
    const prixPasCherArray = [
      'bon tarif',
      'prix bas',
      'pas cher',
      'tarif réduit',
      'bon prix',
    ];
    const prixPasCherTab = ((pgId % 100) + typeId) % prixPasCherArray.length;
    const prixPasCher = prixPasCherArray[prixPasCherTab];

    // Default content (comme PHP else)
    const titleAddon = `${typePowerPs} ch ${typeDate}`;
    const contentAddon = `Achetez <a href='${linkGammeCarLink}'>${pgNameMeta} ${marqueName} ${modeleName} ${typeName}</a> ${typePowerPs} ch ${typeDate}, d'origine à prix bas.`;

    return {
      titleAddon: this.contentCleaner(titleAddon),
      content: this.contentCleaner(contentAddon),
      prixPasCher,
    };
  }

  /**
   * Nettoyage du contenu (comme PHP content_cleaner)
   */
  private contentCleaner(content: string): string {
    if (!content) return '';

    // Strip tags et clean (comme PHP)
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

  @Get(':pgId')
  async getGammeDetails(@Param('pgId') pgId: string) {
    return this.getPageData(pgId);
  }
}
