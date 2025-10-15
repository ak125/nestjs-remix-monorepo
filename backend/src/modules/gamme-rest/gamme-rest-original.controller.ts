import { Controller, Get, Param } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

@Controller('api/gamme-rest')
export class GammeRestController extends SupabaseBaseService {
  @Get(':pgId/page-data')
  async getPageData(@Param('pgId') pgId: string) {
    const pgIdNum = parseInt(pgId, 10);

    // REDIRECTION LOGIC (exactly like PHP)
    if (pgIdNum === 3940) {
      return {
        redirect: '/pieces/corps-papillon-158.html',
        status: 301,
      };
    }

    // QUERY SELECTOR (exactly like PHP)
    const { data: selectorData, error: selectorError } = await this.client
      .from('pieces_gamme')
      .select('pg_display, pg_name')
      .eq('pg_id', pgIdNum)
      .in('pg_level', [1, 2])
      .single();

    // Debug info
    console.log(`🔍 Debug pg_id=${pgIdNum}:`, { selectorData, selectorError });

    if (selectorError || !selectorData) {
      return {
        status: 410,
        error: 'Page not found',
        debug: { selectorError, selectorData },
      };
    }

    if (selectorData.pg_display != 1) {
      // Use != instead of !== to handle string/number
      return {
        status: 412,
        error: 'Page disabled',
        debug: {
          pg_display: selectorData.pg_display,
          pg_name: selectorData.pg_name,
        },
      };
    }

    // QUERY PAGE (like PHP but split into separate queries for Supabase)
    const { data: pageData, error: pageError } = await this.client
      .from('pieces_gamme')
      .select('pg_alias, pg_name, pg_name_meta, pg_relfollow, pg_img, pg_wall')
      .eq('pg_id', pgIdNum)
      .eq('pg_display', 1)
      .in('pg_level', [1, 2])
      .single();

    console.log('🔍 QUERY PAGE result:', { pageData, pageError });

    if (pageError || !pageData) {
      return {
        status: 410,
        error: 'Page data not found',
        debug: { pageError },
      };
    }

    // Get MF data from CATALOG_GAMME and CATALOG_FAMILY (like PHP JOIN)
    const { data: catalogData } = await this.client
      .from('catalog_gamme')
      .select('mc_mf_prime')
      .eq('mc_pg_id', pgIdNum)
      .single();

    let mfId, mfNameSite, mfNameMeta;
    if (catalogData) {
      const { data: familyData } = await this.client
        .from('catalog_family')
        .select('mf_id, mf_name, mf_name_meta')
        .eq('mf_id', catalogData.mc_mf_prime)
        .eq('mf_display', 1)
        .single();

      if (familyData) {
        mfId = familyData.mf_id;
        mfNameSite = familyData.mf_name;
        mfNameMeta = familyData.mf_name_meta;
      }
    }

    // Extract data exactly like PHP
    const pgNameSite = pageData.pg_name;
    const pgNameMeta = pageData.pg_name_meta;
    const pgAlias = pageData.pg_alias;
    const pgRelfollow = pageData.pg_relfollow;
    const pgPic = pageData.pg_img;
    const pgWall = pageData.pg_wall;

    // SEO & CONTENT (exactly like PHP)
    const { data: seoData } = await this.client
      .from('__seo_gamme')
      .select('sg_title, sg_descrip, sg_keywords, sg_h1, sg_content')
      .eq('sg_pg_id', pgIdNum)
      .single();

    let pageTitle, pageDescription, pageKeywords, pageH1, pageContent;

    if (seoData) {
      // Use SEO data (strip_tags like PHP)
      pageTitle = this.contentCleaner(seoData.sg_title || '');
      pageDescription = this.contentCleaner(seoData.sg_descrip || '');
      pageKeywords = this.contentCleaner(seoData.sg_keywords || '');
      pageH1 = this.contentCleaner(seoData.sg_h1 || '');
      pageContent = this.contentCleaner(seoData.sg_content || '');
    } else {
      // Default content (exactly like PHP else block)
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

    // Robot and canonical (exactly like PHP)
    const relfollow = pgRelfollow === 1 ? 1 : 0;
    const pageRobots = relfollow === 1 ? 'index, follow' : 'noindex, nofollow';
    const canonicalLink = 'pieces/' + pgAlias + '-' + pgIdNum + '.html';

    // CONSEILS SEO (exactly like PHP __SEO_GAMME_CONSEIL query)
    // Original PHP: SELECT SGC_TITLE, SGC_CONTENT FROM __SEO_GAMME_CONSEIL WHERE SGC_PG_ID = $pg_id ORDER BY SGC_ID
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

    // INFORMATIONS (exactly like PHP __SEO_GAMME_INFO query)
    // Original PHP: SELECT SGI_CONTENT FROM __SEO_GAMME_INFO WHERE SGI_PG_ID = $pg_id ORDER BY SGI_ID
    const { data: informationsData } = await this.client
      .from('__seo_gamme_info')
      .select('sgi_content')
      .eq('sgi_pg_id', pgIdNum)
      .order('sgi_id', { ascending: true });

    const informations = informationsData
      ? informationsData.map((info) => info.sgi_content)
      : [];

    // CATALOGUE SAME FAMILY (exactly like PHP query_same_family)
    // Original PHP: SELECT DISTINCT PG_ID ,PG_ALIAS, PG_NAME ,PG_NAME_URL ,PG_NAME_META , PG_PIC, PG_IMG
    // FROM PIECES_GAMME JOIN CATALOG_GAMME ON MC_PG_ID = PG_ID
    // WHERE PG_DISPLAY = 1 AND PG_LEVEL IN (1,2) AND MC_MF_ID = $mf_id AND MC_PG_ID != $pg_id ORDER BY MC_SORT
    const catalogueFiltres = [];
    if (mfId) {
      const { data: catalogData } = await this.client
        .from('pieces_gamme')
        .select('pg_id, pg_name, pg_alias, pg_img')
        .eq('pg_display', 1)
        .in('pg_level', [1, 2])
        .neq('pg_id', pgIdNum);

      if (catalogData) {
        // Filter by MF_ID through catalog_gamme relation
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
        // Sort by mc_sort like PHP ORDER BY MC_SORT
        catalogueFiltres.sort((a, b) => a.sort - b.sort);
      }
    }

    // MOTORISATIONS (exactly like PHP query_cross_gamme_car)
    // PHP: SELECT DISTINCT CGC_TYPE_ID, TYPE_NAME, TYPE_POWER_PS, TYPE_MONTH_FROM, TYPE_YEAR_FROM, TYPE_YEAR_TO,
    // MODELE_ID, MODELE_NAME, MARQUE_ID, MARQUE_NAME FROM __CROSS_GAMME_CAR_NEW
    // JOIN AUTO_TYPE ON TYPE_ID = CGC_TYPE_ID JOIN AUTO_MODELE ON MODELE_ID = TYPE_MODELE_ID
    // JOIN AUTO_MARQUE ON MARQUE_ID = MODELE_MARQUE_ID WHERE CGC_PG_ID = $pg_id AND CGC_LEVEL = 1
    // GROUP BY TYPE_MODELE_ID ORDER BY CGC_ID, MODELE_NAME, TYPE_NAME
    console.log('🔍 Récupération motorisations pour pg_id:', pgIdNum);

    // Get cross_gamme_car_new data first
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
      const processedModeles = new Set(); // Group by modele like PHP GROUP BY TYPE_MODELE_ID

      for (const cross of crossGammeData) {
        if (processedModeles.has(cross.cgc_modele_id)) continue;
        processedModeles.add(cross.cgc_modele_id);

        // Get type data
        const { data: typeData } = await this.client
          .from('auto_type')
          .select(
            'type_id, type_name, type_power_ps, type_month_from, type_year_from, type_year_to, type_modele_id',
          )
          .eq('type_id', cross.cgc_type_id)
          .eq('type_display', '1')
          .single();

        if (typeData) {
          // Get modele data
          const { data: modeleData } = await this.client
            .from('auto_modele')
            .select('modele_id, modele_name, modele_marque_id')
            .eq('modele_id', typeData.type_modele_id)
            .eq('modele_display', '1')
            .single();

          if (modeleData) {
            // Get marque data
            const { data: marqueData } = await this.client
              .from('auto_marque')
              .select('marque_id, marque_name')
              .eq('marque_id', modeleData.modele_marque_id)
              .eq('marque_display', '1')
              .single();

            if (marqueData) {
              // Build date string like PHP
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
    } else {
      console.log('❌ Aucune donnée trouvée dans __cross_gamme_car_new');
    }

    console.log(`✅ Motorisations finales: ${motorisations.length}`);

    // ÉQUIPEMENTIERS (simplified separate queries to avoid JOIN issues)
    // Based on PHP: SELECT DISTINCT PM_ID, PM_NAME, SEG_CONTENT, PM_LOGO FROM __SEO_EQUIP_GAMME
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
