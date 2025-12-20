import { Injectable } from '@nestjs/common';
import { GammeDataTransformerService } from './gamme-data-transformer.service';
import { GammeRpcService } from './gamme-rpc.service';
import { buildPieceVehicleUrlRaw } from '../../../common/utils/url-builder.utils';

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
    const pgLevel = pageData.pg_level;
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
    const cgcLevelStats = aggregatedData?.cgc_level_stats || {
      level_1: 0,
      level_2: 0,
      level_3: 0,
      level_5: 0,
      total: 0,
    };
    const motorisationsBlogRaw = aggregatedData?.motorisations_blog || [];

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

    // 🎯 RÈGLE SEO: G1/G2 (pg_level='1') = INDEX, G3 = NOINDEX
    // pg_level='1' = gammes prioritaires (G1) ou importantes (G2)
    // pg_level≠'1' = gammes secondaires (G3)
    const seoValidation = aggregatedData?.seo_validation || {
      family_count: 0,
      gamme_count: 0,
    };
    // pg_level est TEXT en BDD ('1' ou '2'), '1' = INDEX
    const isG1orG2 = String(pgLevel) === '1';
    const pageRobots = isG1orG2 ? 'index, follow' : 'noindex, nofollow';
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
    const motorisations = motorisationsEnriched.map(
      (item: any, index: number) => {
        const { fragment1, fragment2 } =
          this.rpcService.getSeoFragmentsByTypeId(
            item.type_id,
            seoFragments1,
            seoFragments2,
          );

        // Sélectionner une explication technique de manière rotative depuis informations
        const getExplication = (): string => {
          if (informations.length === 0) return '';

          // Utiliser type_id + index pour rotation équilibrée
          const rotationIndex = (item.type_id + index) % informations.length;
          const explication = informations[rotationIndex];

          // Reformuler pour intégrer naturellement
          if (!explication) return '';

          // Extraire la partie "pour..." si elle existe, sinon prendre tout
          const pourMatch = explication.match(/pour\s+(.+)/i);
          if (pourMatch) {
            return `, ${pourMatch[0]}`;
          }

          // Si commence par "La courroie...", extraire l'action principale
          if (
            explication.toLowerCase().includes('entraîne') ||
            explication.toLowerCase().includes('permet')
          ) {
            return ', pour assurer le bon fonctionnement des équipements';
          }

          return '';
        };

        // Note: getExplication() est appelé pour effet de bord potentiel mais le résultat n'est pas utilisé
        getExplication();

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
        // ✅ Utilise buildPieceVehicleUrlRaw centralisé

        // Construire la période
        const yearFrom = item.type_year_from || '';
        const yearTo = item.type_year_to || "aujourd'hui";
        const periode = `${yearFrom} - ${yearTo}`;

        // Construire le lien vers la page gamme avec véhicule
        // Format: /pieces/gamme-alias-ID/marque-alias-ID/modele-alias-ID/type-alias-ID.html
        // ✅ Utilise les alias de la DB (marque_alias, modele_alias, type_alias) au lieu de slugifier
        const link = buildPieceVehicleUrlRaw(
          { alias: pgAlias, id: pgIdNum },
          { alias: item.marque_alias || item.marque_name, id: item.marque_id },
          { alias: item.modele_alias || item.modele_name, id: item.modele_id },
          { alias: item.type_alias || item.type_name, id: item.type_id },
        );

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

        // Construire la description avec templates variés et cohérents grammaticalement
        const buildDescription = () => {
          const hasFragment1 =
            cleanedFragment1 && cleanedFragment1.trim().length > 3;
          const hasFragment2 =
            cleanedFragment2 && cleanedFragment2.trim().length > 3;

          // Vérifier si les fragments sont identiques ou très similaires
          const fragmentsAreSimilar =
            hasFragment1 &&
            hasFragment2 &&
            (cleanedFragment1 === cleanedFragment2 ||
              cleanedFragment1
                .toLowerCase()
                .startsWith(cleanedFragment2.toLowerCase().slice(0, 10)));

          // Utiliser les informations de la DB (__seo_gamme_info) comme finitions dynamiques
          // Ces informations sont déjà chargées dans 'informations' depuis la RPC
          const getFinitionFromDb = (): string => {
            if (informations.length === 0) {
              // Fallback si pas d'informations en DB
              return 'pour votre sécurité et le bon fonctionnement de votre véhicule.';
            }

            // Sélection rotative basée sur type_id + index
            const infoIndex = (item.type_id + index) % informations.length;
            const info = informations[infoIndex];

            if (!info || info.length < 10) {
              return 'pour votre sécurité et le bon fonctionnement de votre véhicule.';
            }

            // Extraire une partie pertinente de l'information
            let finition = info;

            // Chercher "pour" dans le texte et extraire à partir de là
            const pourIndex = info.toLowerCase().indexOf(' pour ');
            if (pourIndex > 0 && pourIndex < info.length - 20) {
              finition = info.substring(pourIndex + 1).trim();
              // S'assurer que ça commence par une minuscule
              finition = finition.charAt(0).toLowerCase() + finition.slice(1);
            } else {
              // Si la phrase commence par "Les plaquettes...", "L'usure...", etc.
              // On la garde mais on la reformule pour qu'elle s'intègre mieux
              if (info.match(/^(Les |L'|Il |En |Quand |Attention)/i)) {
                // Mettre la première lettre en minuscule pour l'intégrer après une virgule
                finition = info.charAt(0).toLowerCase() + info.slice(1);
              } else {
                // Chercher le verbe principal pour extraire la partie utile
                const verbMatch = info.match(
                  /(servent à|jouent|permettent|assurent|doivent être|sont)/i,
                );
                if (verbMatch && verbMatch.index) {
                  // Ajouter "les plaquettes de frein" devant pour donner un sujet
                  const afterVerb = info.substring(verbMatch.index).trim();
                  if (afterVerb.length > 15) {
                    finition = 'les plaquettes de frein ' + afterVerb;
                  }
                }
              }
            }

            // Ajouter un point final si nécessaire
            if (!finition.endsWith('.')) {
              finition = finition + '.';
            }

            return finition;
          };

          const finition = getFinitionFromDb();

          // Formater la finition pour la ponctuation correcte
          // Si la finition est une phrase longue, utiliser un point avant
          const isLongFinition = finition.length > 50;
          const separator = isLongFinition ? '. ' : ', ';
          const formattedFinition = isLongFinition
            ? finition.charAt(0).toUpperCase() + finition.slice(1)
            : finition;

          // Si fragments identiques, utiliser un seul fragment avec template amélioré
          if (fragmentsAreSimilar || (hasFragment1 && !hasFragment2)) {
            const fragment = cleanedFragment1;
            const capitalizedFragment =
              fragment.charAt(0).toUpperCase() + fragment.slice(1);
            const templateIndex = item.type_id % 5;

            switch (templateIndex) {
              case 0:
                return `${capitalizedFragment} les ${pgNameSite.toLowerCase()} ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch${separator}${formattedFinition}`;
              case 1:
                return `Pensez à ${fragment.toLowerCase()} avant installation${separator}${formattedFinition}`;
              case 2:
                return `${pgNameSite} ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch : ${fragment.toLowerCase()}. Pensez à vérifier avant montage${separator}${formattedFinition}`;
              case 3:
                return `Pour votre ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch, ${fragment.toLowerCase()}${separator}${formattedFinition}`;
              case 4:
                return `${capitalizedFragment} pour ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch${separator}${formattedFinition}`;
            }
          }

          // Templates variés basés sur type_id avec deux fragments distincts
          if (hasFragment1 && hasFragment2) {
            const templateIndex = item.type_id % 4;
            const cap1 =
              cleanedFragment1.charAt(0).toUpperCase() +
              cleanedFragment1.slice(1);
            const cap2 =
              cleanedFragment2.charAt(0).toUpperCase() +
              cleanedFragment2.slice(1);

            switch (templateIndex) {
              case 0:
                return `${cap2} les ${pgNameSite.toLowerCase()} ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch${separator}${formattedFinition}`;
              case 1:
                return `${cap1} pour ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch. ${cap2} avant installation${separator}${formattedFinition}`;
              case 2:
                return `${pgNameSite} ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch : ${cleanedFragment1.toLowerCase()}. Pensez à ${cleanedFragment2.toLowerCase()} avant montage${separator}${formattedFinition}`;
              case 3:
                return `Pour votre ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch, ${cleanedFragment1.toLowerCase()}${separator}${formattedFinition}`;
            }
          }

          // Sinon, description par défaut améliorée
          return `Achetez ${pgNameSite.toLowerCase()} ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch ${periode}, ${finition}`;
        };

        return {
          cgc_level: item.cgc_level || '1', // Niveau CGC (1=page gamme, 2=page marque, 3=page type)
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
      },
    );

    // Traitement motorisations blog (niveau 5)
    const motorisationsBlog = motorisationsBlogRaw.map((item: any) => {
      const marqueAlias =
        item.marque_alias ||
        item.marque_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const carImage =
        item.modele_pic && item.modele_pic !== 'no.webp'
          ? `${SUPABASE_URL}/constructeurs-automobiles/marques-modeles/${marqueAlias}/${item.modele_pic}`
          : `${SUPABASE_URL}/constructeurs-automobiles/marques-modeles/no.png`;

      const yearFrom = item.type_year_from || '';
      const yearTo = item.type_year_to || "aujourd'hui";
      const periode = `${yearFrom} - ${yearTo}`;

      const link = buildPieceVehicleUrlRaw(
        { alias: pgAlias, id: pgIdNum },
        { alias: item.marque_alias || item.marque_name, id: item.marque_id },
        { alias: item.modele_alias || item.modele_name, id: item.modele_id },
        { alias: item.type_alias || item.type_name, id: item.type_id },
      );

      return {
        cgc_level: item.cgc_level,
        type_id: item.type_id,
        type_name: item.type_name,
        puissance: `${item.type_power_ps} ch`,
        periode,
        modele_id: item.modele_id,
        modele_name: item.modele_name,
        marque_id: item.marque_id,
        marque_name: item.marque_name,
        image: carImage,
        link,
        title: `${item.marque_name} ${item.modele_name} ${item.type_name}`,
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
      // Alias pour compatibilité frontend
      catalogueMameFamille:
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
      informations:
        informations.length > 0
          ? {
              title: `Informations sur ${pgNameSite || 'ce produit'}`,
              items: informations,
            }
          : null,
      guideAchat,
      motorisationsBlog:
        motorisationsBlog.length > 0
          ? {
              title: 'Véhicules cités dans nos guides',
              items: motorisationsBlog,
            }
          : null,
      seoValidation: {
        familyCount: seoValidation.family_count,
        gammeCount: seoValidation.gamme_count,
        relfollow: String(pgRelfollow) === '1' ? 1 : 0,
        isIndexable: isG1orG2,
        robots: pageRobots,
        pgLevel: pageData.pg_level,
        pgRelfollow: pageData.pg_relfollow,
      },
      cgcLevelStats: {
        level1: cgcLevelStats.level_1,
        level2: cgcLevelStats.level_2,
        level3: cgcLevelStats.level_3,
        level5: cgcLevelStats.level_5,
        total: cgcLevelStats.total,
        description:
          'CGC_LEVEL: 1=motorisations grille, 2=page marque, 3=page type, 5=section blog',
      },
      // 🔗 SEO Switches pour maillage interne (ancres variées)
      seoSwitches: {
        verbs: seoFragments1
          .slice(0, 20)
          .map((s: any) => ({ id: s.sis_id, content: s.sis_content })),
        nouns: seoFragments2
          .slice(0, 20)
          .map((s: any) => ({ id: s.sis_id, content: s.sis_content })),
        verbCount: seoFragments1.length,
        nounCount: seoFragments2.length,
      },
      performance: {
        total_time_ms: totalTime,
        rpc_time_ms: timings.rpcTime,
        motorisations_count: motorisations.length,
        motorisations_blog_count: motorisationsBlog.length,
        catalogue_famille_count: catalogueFiltres.length,
        equipementiers_count: equipementiers.length,
        conseils_count: conseils.length,
        informations_count: informations.length,
        guide_available: guideAchat ? 1 : 0,
      },
    };
  }
}
