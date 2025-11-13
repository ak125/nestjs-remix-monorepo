import { Injectable } from '@nestjs/common';
import { GammeDataTransformerService } from './gamme-data-transformer.service';
import { GammeRpcService } from './gamme-rpc.service';

/**
 * Service de construction de la réponse finale
 */
@Injectable()
export class GammeResponseBuilderService {
  constructor(
    private readonly transformer: GammeDataTransformerService,
    private readonly rpcService: GammeRpcService,
  ) {}

  /**
   * Construit la réponse complète RPC V2
   */
  async buildRpcV2Response(pgId: string) {
    const startTime = performance.now();
    const { aggregatedData, pageData, timings } = await this.rpcService.getPageDataRpcV2(pgId);

    const pgIdNum = parseInt(pgId, 10);
    const pgNameSite = pageData.pg_name;
    const pgNameMeta = pageData.pg_name_meta;
    const pgAlias = pageData.pg_alias;
    const pgRelfollow = pageData.pg_relfollow;
    const pgPic = pageData.pg_img;
    const pgWall = pageData.pg_wall;

    // Extraction données agrégées
    const catalogData = aggregatedData?.catalog;
    const seoData = aggregatedData?.seo;
    const conseilsRaw = aggregatedData?.conseils || [];
    const informationsRaw = aggregatedData?.informations || [];
    const equipementiersRaw = aggregatedData?.equipementiers || [];
    const blogData = aggregatedData?.blog;
    const catalogueFamilleRaw = aggregatedData?.catalogue_famille || [];
    const familleInfo = aggregatedData?.famille_info;
    const motorisationsEnriched = aggregatedData?.motorisations_enriched || [];
    const seoFragments1 = aggregatedData?.seo_fragments_1 || [];
    const seoFragments2 = aggregatedData?.seo_fragments_2 || [];

    // Traitement SEO
    let pageTitle, pageDescription, pageKeywords, pageH1, pageContent;
    if (seoData) {
      pageTitle = this.transformer.contentCleaner(seoData.sg_title || '');
      pageDescription = this.transformer.contentCleaner(seoData.sg_descrip || '');
      pageKeywords = this.transformer.contentCleaner(seoData.sg_keywords || '');
      pageH1 = this.transformer.contentCleaner(seoData.sg_h1 || '');
      pageContent = this.transformer.contentCleaner(seoData.sg_content || '');
    } else {
      const defaultSeo = this.transformer.generateDefaultSeo(pgNameSite, pgNameMeta);
      pageTitle = defaultSeo.title;
      pageDescription = defaultSeo.description;
      pageKeywords = defaultSeo.keywords;
      pageH1 = defaultSeo.h1;
      pageContent = defaultSeo.content;
    }

    const relfollow = pgRelfollow === 1 ? 1 : 0;
    const pageRobots = relfollow === 1 ? 'index, follow' : 'noindex, nofollow';
    const canonicalLink = `pieces/${pgAlias}-${pgIdNum}.html`;

    // Traitement données
    const conseils = this.transformer.processConseils(conseilsRaw);
    const informations = this.transformer.processInformations(informationsRaw);
    const catalogueFiltres = this.transformer.processCatalogueFamille(catalogueFamilleRaw);
    const equipementiers = this.transformer.processEquipementiers(equipementiersRaw);

    // Traitement motorisations
    const motorisations = motorisationsEnriched.map((item: any) => {
      const { fragment1, fragment2 } = this.rpcService.getSeoFragmentsByTypeId(
        item.type_id,
        seoFragments1,
        seoFragments2
      );
      
      return {
        cgc_type_id: item.type_id,
        type_name: item.type_name,
        type_power_ps: item.type_power_ps,
        type_year_from: item.type_year_from,
        type_year_to: item.type_year_to,
        modele_id: item.modele_id,
        modele_name: item.modele_name,
        marque_id: item.marque_id,
        marque_name: item.marque_name,
        title: this.transformer.contentCleaner(fragment2),
        content: this.transformer.contentCleaner(fragment1),
      };
    });

    // Guide d'achat
    const guideAchat = blogData ? {
      id: blogData.ba_id,
      title: this.transformer.contentCleaner(blogData.ba_h1 || ''),
      alias: blogData.ba_alias,
      preview: this.transformer.contentCleaner(blogData.ba_preview || ''),
      image: blogData.ba_wall,
      updated: blogData.ba_update,
    } : null;

    const totalTime = performance.now() - startTime;
    
    return {
      meta: {
        title: pageTitle,
        description: pageDescription,
        keywords: pageKeywords,
        robots: pageRobots,
        canonical: canonicalLink,
      },
      hero: {
        h1: pageH1,
        content: pageContent,
        image: pgPic,
        wall: pgWall,
        famille_info: familleInfo || null,
      },
      motorisations,
      catalogueFiltres: catalogueFiltres.length > 0 ? {
        title: familleInfo ? `Autres pièces de la famille ${familleInfo.mf_name}` : 'Pièces similaires',
        items: catalogueFiltres,
      } : null,
      equipementiers: equipementiers.length > 0 ? {
        title: 'Nos équipementiers',
        items: equipementiers,
      } : null,
      conseils: conseils.length > 0 ? {
        title: `Conseils d'entretien`,
        items: conseils,
      } : null,
      informations: informations.length > 0 ? informations : null,
      guideAchat,
      performance: {
        total_time_ms: totalTime,
        rpc_time_ms: timings.rpcTime,
        motorisations_count: motorisations.length,
        catalogue_famille_count: catalogueFiltres.length,
        equipementiers_count: equipementiers.length,
        conseils_count: conseils.length,
        informations_count: informations.length,
        guide_available: guideAchat ? 1 : 0,
      },
    };
  }
}
