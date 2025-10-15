import { Controller, Get, Param } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

/**
 * 🔥 GAMME REST CONTROLLER - REPRODUCTION EXACTE DU FICHIER PHP ORIGINAL
 *
 * Reproduit fidèlement la logique du fichier PHP avec toutes les sections :
 * - SEO complet (__seo_gamme)
 * - Motorisations (__cross_gamme_car_new + auto_*)
 * - Équipementiers (__seo_equip_gamme + pieces_marque)
 * - Catalogue même famille (catalog_gamme + catalog_family)
 * - Conseils (__seo_gamme_conseil)
 * - Informations (__seo_gamme_info)
 * - Blog advice (__blog_advice)
 */
@Controller('api/gamme-rest')
export class GammeRestPhpExactController extends SupabaseBaseService {
  @Get(':pgId/page-data')
  async getPageData(@Param('pgId') pgId: string) {
    const pgIdNum = parseInt(pgId, 10);
    console.log(`🔥 REPRODUCTION EXACTE PHP - PG_ID=${pgIdNum}`);

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
    // 2. QUERY SELECTOR (exactement comme PHP)
    // ========================================
    const { data: selectorData, error: selectorError } = await this.client
      .from('pieces_gamme')
      .select('pg_display, pg_name')
      .eq('pg_id', pgIdNum)
      .in('pg_level', [1, 2])
      .single();

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

    // ========================================
    // 3. QUERY PAGE DATA (exactement comme PHP)
    // ========================================
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
    // 4. MF DATA (CATALOG_GAMME + CATALOG_FAMILY)
    // ========================================
    const { data: catalogData } = await this.client
      .from('catalog_gamme')
      .select('mc_mf_prime')
      .eq('mc_pg_id', pgIdNum)
      .single();

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
    // 5. SEO & CONTENT (__SEO_GAMME) - exactement comme PHP
    // ========================================
    const { data: seoData } = await this.client
      .from('__seo_gamme')
      .select('sg_title, sg_descrip, sg_keywords, sg_h1, sg_content')
      .eq('sg_pg_id', pgIdNum)
      .single();

    let pageTitle, pageDescription, pageKeywords, pageH1, pageContent;

    if (seoData) {
      // Utiliser les données SEO (exactement comme PHP)
      pageTitle = this.contentCleaner(seoData.sg_title || '');
      pageDescription = this.contentCleaner(seoData.sg_descrip || '');
      pageKeywords = this.contentCleaner(seoData.sg_keywords || '');
      pageH1 = this.contentCleaner(seoData.sg_h1 || '');
      pageContent = this.contentCleaner(seoData.sg_content || '');
    } else {
      // Contenu par défaut (exactement comme PHP else)
      pageTitle = pgNameMeta + ' neuf & à prix bas';
      pageDescription =
        'Votre ' +
        pgNameMeta +
        ' au meilleur tarif, de qualité & à prix pas cher pour toutes marques et modèles de voitures.';
      pageKeywords = pgNameMeta;
      pageH1 = 'Choisissez ' + pgNameSite + ' pas cher pour votre véhicule';
      pageContent =
        'Le(s) <b>' +
        pgNameSite +
        '</b> commercialisés sur ' +
        pgNameSite +
        " sont disponibles pour tous les modèles de véhicules et dans plusieurs marques d'équipementiers de pièces détachées automobile.<br>Identifier la marque, l'année, le modèle et la motorisation de votre véhicule sélectionnez le <b>" +
        pgNameSite +
        '</b> compatible avec votre voiture.<br>Nous commercialisons des <b>' +
        pgNameSite +
        "</b> de différentes qualités : qualité d'origine, première monte et équivalente à l'origine avec des prix pas cher.";
    }

    // Robot et canonical (exactement comme PHP)
    const relfollow = pgRelfollow === 1 ? 1 : 0;
    const pageRobots = relfollow === 1 ? 'index, follow' : 'noindex, nofollow';
    const canonicalLink = 'pieces/' + pgAlias + '-' + pgIdNum + '.html';

    // ========================================
    // 6. CONSEILS (__SEO_GAMME_CONSEIL) - exactement comme PHP
    // ========================================
    const { data: conseilsData } = await this.client
      .from('__seo_gamme_conseil')
      .select('sgc_id, sgc_title, sgc_content')
      .eq('sgc_pg_id', pgIdNum)
      .order('sgc_id', { ascending: true });

    const conseils = conseilsData
      ? conseilsData.map((conseil) => ({
          id: conseil.sgc_id,
          title: this.contentCleaner(conseil.sgc_title || ''),
          content: this.contentCleaner(conseil.sgc_content || ''),
        }))
      : [];

    // ========================================
    // 7. INFORMATIONS (__SEO_GAMME_INFO) - exactement comme PHP
    // ========================================
    const { data: informationsData } = await this.client
      .from('__seo_gamme_info')
      .select('sgi_content')
      .eq('sgi_pg_id', pgIdNum)
      .order('sgi_id', { ascending: true });

    const informations = informationsData
      ? informationsData.map((info) => info.sgi_content)
      : [];

    // ========================================
    // 8. CATALOGUE MÊME FAMILLE - exactement comme PHP query_same_family
    // ========================================
    const catalogueFiltres = [];
    if (mfId) {
      // PHP: SELECT DISTINCT PG_ID, PG_ALIAS, PG_NAME, PG_NAME_META, PG_PIC, PG_IMG
      // FROM PIECES_GAMME JOIN CATALOG_GAMME ON MC_PG_ID = PG_ID
      // WHERE PG_DISPLAY = 1 AND PG_LEVEL IN (1,2) AND MC_MF_ID = $mf_id AND MC_PG_ID != $pg_id ORDER BY MC_SORT

      const { data: catalogData } = await this.client
        .from('pieces_gamme')
        .select('pg_id, pg_name, pg_alias, pg_img')
        .eq('pg_display', 1)
        .in('pg_level', [1, 2])
        .neq('pg_id', pgIdNum);

      if (catalogData) {
        for (const item of catalogData) {
          const { data: gammeData } = await this.client
            .from('catalog_gamme')
            .select('mc_sort')
            .eq('mc_pg_id', item.pg_id)
            .eq('mc_mf_id', mfId)
            .single();

          if (gammeData) {
            catalogueFiltres.push({
              id: item.pg_id,
              name: item.pg_name,
              alias: item.pg_alias,
              image: item.pg_img,
              link: `/pieces/${item.pg_alias}-${item.pg_id}.html`,
              sort: gammeData.mc_sort,
            });
          }
        }
        // Tri par mc_sort comme PHP ORDER BY MC_SORT
        catalogueFiltres.sort((a, b) => a.sort - b.sort);
      }
    }

    // ========================================
    // 9. MOTORISATIONS (__CROSS_GAMME_CAR_NEW) - exactement comme PHP
    // ========================================
    console.log('🚗 Récupération motorisations exactement comme PHP...');

    // PHP: SELECT DISTINCT CGC_TYPE_ID, TYPE_NAME, TYPE_POWER_PS, TYPE_MONTH_FROM, TYPE_YEAR_FROM, TYPE_YEAR_TO,
    // MODELE_ID, MODELE_NAME, MARQUE_ID, MARQUE_NAME FROM __CROSS_GAMME_CAR_NEW
    // JOIN AUTO_TYPE ON TYPE_ID = CGC_TYPE_ID JOIN AUTO_MODELE ON MODELE_ID = TYPE_MODELE_ID
    // JOIN AUTO_MARQUE ON MARQUE_ID = MODELE_MARQUE_ID WHERE CGC_PG_ID = $pg_id AND CGC_LEVEL = 1
    // GROUP BY TYPE_MODELE_ID ORDER BY CGC_ID, MODELE_NAME, TYPE_NAME

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

      // GROUP BY TYPE_MODELE_ID comme PHP
      const processedModeles = new Set();

      for (const cross of crossGammeData) {
        if (processedModeles.has(cross.cgc_modele_id)) continue;
        processedModeles.add(cross.cgc_modele_id);

        // JOIN AUTO_TYPE
        const { data: typeData } = await this.client
          .from('auto_type')
          .select(
            'type_id, type_name, type_power_ps, type_month_from, type_year_from, type_year_to, type_modele_id',
          )
          .eq('type_id', cross.cgc_type_id)
          .eq('type_display', '1')
          .single();

        if (typeData) {
          // JOIN AUTO_MODELE
          const { data: modeleData } = await this.client
            .from('auto_modele')
            .select('modele_id, modele_name, modele_marque_id')
            .eq('modele_id', typeData.type_modele_id)
            .eq('modele_display', '1')
            .single();

          if (modeleData) {
            // JOIN AUTO_MARQUE
            const { data: marqueData } = await this.client
              .from('auto_marque')
              .select('marque_id, marque_name')
              .eq('marque_id', modeleData.modele_marque_id)
              .eq('marque_display', '1')
              .single();

            if (marqueData) {
              // Construction date exactement comme PHP
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
          }
        }
      }
    }

    console.log(
      `✅ Motorisations finales PHP exactes: ${motorisations.length}`,
    );

    // ========================================
    // 10. ÉQUIPEMENTIERS (__SEO_EQUIP_GAMME) - exactement comme PHP
    // ========================================
    // PHP: SELECT DISTINCT PM_ID, PM_NAME, SEG_CONTENT, PM_LOGO FROM __SEO_EQUIP_GAMME
    // JOIN PIECES_MARQUE ON PM_ID = SEG_PM_ID WHERE SEG_PG_ID = $pg_id

    const { data: equipGammeData } = await this.client
      .from('__seo_equip_gamme')
      .select('seg_pm_id, seg_content')
      .eq('seg_pg_id', pgIdNum)
      .not('seg_content', 'is', null)
      .order('seg_id', { ascending: true })
      .limit(4);

    const equipementiers = [];
    if (equipGammeData) {
      for (const equip of equipGammeData) {
        // JOIN PIECES_MARQUE
        const { data: marqueData } = await this.client
          .from('pieces_marque')
          .select('pm_id, pm_name, pm_logo')
          .eq('pm_id', equip.seg_pm_id)
          .eq('pm_display', 1)
          .single();

        if (marqueData) {
          equipementiers.push({
            pm_id: marqueData.pm_id,
            pm_name: marqueData.pm_name,
            pm_logo: marqueData.pm_logo,
            description: this.contentCleaner(equip.seg_content || ''),
          });
        }
      }
    }

    // ========================================
    // 11. BLOG ADVICE (__BLOG_ADVICE) - exactement comme PHP
    // ========================================
    // PHP: SELECT BA_ID, BA_H1, BA_ALIAS, BA_PREVIEW, BA_WALL, BA_UPDATE, PG_NAME, PG_ALIAS, PG_IMG, PG_WALL
    // FROM __BLOG_ADVICE JOIN PIECES_GAMME ON PG_ID = BA_PG_ID
    // WHERE BA_PG_ID = $pg_id ORDER BY BA_UPDATE DESC, BA_CREATE DESC LIMIT 1

    const { data: blogData, error: blogError } = await this.client
      .from('__blog_advice')
      .select('ba_id, ba_h1, ba_alias, ba_preview, ba_wall, ba_update')
      .eq('ba_pg_id', pgIdNum)
      .order('ba_update', { ascending: false })
      .order('ba_create', { ascending: false })
      .limit(1)
      .single();

    let guide = null;
    if (blogData && !blogError) {
      // H2 content optionnel comme PHP
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
        h2_content: h2Data && h2Data.length > 0 ? h2Data[0].ba2_content : null,
      };
    }

    // ========================================
    // 12. STRUCTURE FINALE EXACTEMENT COMME PHP
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
      sections: {
        conseils,
        informations,
      },
      catalogueFiltres,
      motorisations,
      equipementiers,
      guide,
      debug: {
        pgIdNum,
        mfId,
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
