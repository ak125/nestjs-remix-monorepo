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
    const { aggregatedData, pageData, timings } =
      await this.rpcService.getPageDataRpcV2(pgId);

    const pgIdNum = parseInt(pgId, 10);
    const pgNameSite = pageData.pg_name;
    const pgNameMeta = pageData.pg_name_meta;
    const pgAlias = pageData.pg_alias;
    const pgRelfollow = pageData.pg_relfollow;
    const pgPic = pageData.pg_img;
    const pgWall = pageData.pg_wall;

    // Extraction données agrégées
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
      pageDescription = this.transformer.contentCleaner(
        seoData.sg_descrip || '',
      );
      pageKeywords = this.transformer.contentCleaner(seoData.sg_keywords || '');
      pageH1 = this.transformer.contentCleaner(seoData.sg_h1 || '');
      pageContent = this.transformer.contentCleaner(seoData.sg_content || '');
    } else {
      const defaultSeo = this.transformer.generateDefaultSeo(
        pgNameSite,
        pgNameMeta,
      );
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
    const catalogueFiltres =
      this.transformer.processCatalogueFamille(catalogueFamilleRaw);
    const equipementiers =
      this.transformer.processEquipementiers(equipementiersRaw);

    // URL de base Supabase Storage
    const SUPABASE_URL =
      'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads';

    // Traitement motorisations
    const motorisations = motorisationsEnriched.map((item: any) => {
      const { fragment1, fragment2 } = this.rpcService.getSeoFragmentsByTypeId(
        item.type_id,
        seoFragments1,
        seoFragments2,
      );

      // Construire l'URL de l'image de la voiture en utilisant modele_pic de la DB
      let carImage = null;
      if (
        item.modele_pic &&
        item.modele_pic !== 'no.webp' &&
        item.modele_pic !== ''
      ) {
        // Utiliser marque_alias (slug déjà stocké en DB) et modele_pic (nom exact du fichier)
        const marqueAlias =
          item.marque_alias ||
          item.marque_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        carImage = `${SUPABASE_URL}/constructeurs-automobiles/marques-modeles/${marqueAlias}/${item.modele_pic}`;
      } else {
        // Image par défaut
        carImage = `${SUPABASE_URL}/constructeurs-automobiles/marques-modeles/no.png`;
      }

      // Slugify pour les URLs
      const slugify = (text: string): string => {
        return text
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      };

      // Construire la période
      const yearFrom = item.type_year_from || '';
      const yearTo = item.type_year_to || "aujourd'hui";
      const periode = `${yearFrom} - ${yearTo}`;

      // Construire le lien vers la page gamme avec véhicule
      // Format: /pieces/gamme-alias-ID/marque-ID/modele-ID/type-ID.html
      const marqueSlug = slugify(item.marque_name);
      const modeleSlug = slugify(item.modele_name);
      const typeSlug = slugify(item.type_name);
      const link = `/pieces/${pgAlias}-${pgIdNum}/${marqueSlug}-${item.marque_id}/${modeleSlug}-${item.modele_id}/${typeSlug}-${item.type_id}.html`;

      // Valider et nettoyer les fragments SEO
      const validateFragment = (frag: string, marqueName: string): string => {
        const cleaned = this.transformer.cleanSeoText(frag || '', marqueName);
        // Éviter fragments trop courts ou invalides
        if (
          cleaned.length < 10 ||
          cleaned.includes('undefined') ||
          cleaned.includes('null')
        ) {
          return '';
        }
        // Éviter duplications de mots consécutifs (ex: "contrôler contrôler")
        const words = cleaned.split(' ');
        const deduped = words.filter(
          (word, idx) => idx === 0 || word !== words[idx - 1],
        );
        return deduped.join(' ');
      };

      const cleanedFragment1 = validateFragment(
        fragment1 || '',
        item.marque_name,
      );
      const cleanedFragment2 = validateFragment(
        fragment2 || '',
        item.marque_name,
      );

      // Construire le titre complet : "[Gamme] [marque] [modèle] [type], [fragment1]"
      const buildTitle = () => {
        const hasFragment1 =
          cleanedFragment1 && cleanedFragment1.trim().length > 3;
        if (hasFragment1) {
          return `${pgNameSite} ${item.marque_name} ${item.modele_name} ${item.type_name}, ${cleanedFragment1}`;
        }
        return `${pgNameSite} ${item.marque_name} ${item.modele_name} ${item.type_name}`;
      };

      // Construire la description avec templates variés pour contenu plus naturel
      const buildDescription = () => {
        const hasFragment1 =
          cleanedFragment1 && cleanedFragment1.trim().length > 3;
        const hasFragment2 =
          cleanedFragment2 && cleanedFragment2.trim().length > 3;

        // Templates variés basés sur type_id pour éviter répétitions
        if (hasFragment1 && hasFragment2) {
          const templateIndex = item.type_id % 4;

          switch (templateIndex) {
            case 0:
              // Template original
              return `${cleanedFragment2} les ${pgNameSite.toLowerCase()} ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch et ${cleanedFragment1}.`;
            case 1:
              // Template inversé avec conseil
              return `${cleanedFragment1.charAt(0).toUpperCase() + cleanedFragment1.slice(1)} pour ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch. ${cleanedFragment2.charAt(0).toUpperCase() + cleanedFragment2.slice(1)} la pièce avant installation.`;
            case 2:
              // Template descriptif avec double point
              return `${pgNameSite} ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch : ${cleanedFragment1}. Pensez à ${cleanedFragment2.toLowerCase()} avant montage.`;
            case 3:
              // Template conversationnel
              return `Pour votre ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch, ${cleanedFragment1}. N'oubliez pas de ${cleanedFragment2.toLowerCase()}.`;
          }
        }

        // Si seulement fragment1 : "[fragment1] pour votre [marque] [modèle] [type] [ch] ch [période]"
        if (hasFragment1) {
          return `${cleanedFragment1.charAt(0).toUpperCase() + cleanedFragment1.slice(1)} pour votre ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch ${periode}. Qualité d'origine à prix bas.`;
        }

        // Sinon, description par défaut
        return `Achetez ${pgNameSite.toLowerCase()} ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch ${periode}, d'origine à prix bas.`;
      };

      return {
        cgc_type_id: item.type_id,
        type_name: item.type_name,
        type_power_ps: item.type_power_ps,
        puissance: `${item.type_power_ps} ch`,
        type_year_from: item.type_year_from,
        type_year_to: item.type_year_to,
        periode: periode,
        modele_id: item.modele_id,
        modele_name: item.modele_name,
        marque_id: item.marque_id,
        marque_name: item.marque_name,
        image: carImage,
        link: link,
        title: buildTitle(),
        content: buildDescription(),
        description: buildDescription(),
        advice: cleanedFragment2 || buildTitle(),
      };
    });

    // Guide d'achat
    const guideAchat = blogData
      ? {
          id: blogData.ba_id,
          title: this.transformer.contentCleaner(blogData.ba_h1 || ''),
          alias: blogData.ba_alias,
          preview: this.transformer.contentCleaner(blogData.ba_preview || ''),
          image: blogData.ba_wall
            ? `${SUPABASE_URL}/blog/${blogData.ba_wall}`
            : null,
          updated: blogData.ba_update,
        }
      : null;

    const totalTime = performance.now() - startTime;

    // URLs Supabase pour les images hero
    const imageUrl = pgPic
      ? `${SUPABASE_URL}/articles/gammes-produits/catalogue/${pgPic}`
      : null;
    const wallUrl = pgWall
      ? `${SUPABASE_URL}/articles/gammes-produits/wall/${pgWall}`
      : null;

    return {
      status: 200,
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
        pg_name: pgNameSite,
        pg_alias: pgAlias,
        image: imageUrl,
        wall: wallUrl,
        famille_info: familleInfo || null,
      },
      motorisations:
        motorisations.length > 0
          ? {
              title: `Motorisations compatibles`,
              items: motorisations,
            }
          : null,
      catalogueFiltres:
        catalogueFiltres.length > 0
          ? {
              title: familleInfo
                ? `Autres pièces de la famille ${familleInfo.mf_name}`
                : 'Pièces similaires',
              items: catalogueFiltres,
            }
          : null,
      equipementiers:
        equipementiers.length > 0
          ? {
              title: 'Nos équipementiers',
              items: equipementiers,
            }
          : null,
      conseils:
        conseils.length > 0
          ? {
              title: `Conseils d'entretien`,
              items: conseils,
            }
          : null,
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
